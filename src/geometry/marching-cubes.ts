/**
 * Bounded Marching Cubes implicit surface extractor for Intersect Phase V6.
 *
 * Implements:
 * 1. Slice-by-slice evaluation with bounded subtree caches and rolling edge storage.
 * 2. Deterministic exact-zero sample handling without division-by-zero or coordinate drifting.
 * 3. Pole and discontinuity rejection (prevents false sheets at poles like 1/x = 0).
 * 4. Safe symbolic power reduction for repeated factors (e.g. x^2 = 0).
 * 5. Domain obligation checks preserving source exclusions (e.g. (x^2-1)/(x-1) = y).
 * 6. Central-difference analytic normals with face-normal fallbacks at singularities.
 * 7. Bounded allocation and execution limits with explicit partial completion diagnostics.
 */

import type { WorldBounds } from '../contracts/bounds';
import type { ExpressionNode, DomainObligation } from '../contracts/expressions';
import type {
  GeometryBudget,
  MeshGeometryBuffer,
  GeometryStatus,
} from '../contracts/geometry';
import {
  compileEvaluator,
  reduceRepeatedFactorResidual,
  type CompiledEvaluator,
} from './evaluator';
import {
  getEdgeMask,
  getTriangles,
  getEdgeVertices,
} from './marching-cubes-tables';
import { generateCoordinateGuides } from './guide-curves';
import { compileGridEvaluator } from './grid-evaluator';

interface CellCorner {
  val: number;
  valid: boolean;
  isPole: boolean;
}

/**
 * Computes bounding box from a flat Float32Array of positions [x0, y0, z0, ...].
 */
function computeBoundingBox(positions: Float32Array, count: number): WorldBounds | null {
  if (count === 0) return null;
  const p0 = positions[0];
  const p1 = positions[1];
  const p2 = positions[2];
  if (p0 === undefined || p1 === undefined || p2 === undefined) return null;

  let minX = p0;
  let maxX = p0;
  let minY = p1;
  let maxY = p1;
  let minZ = p2;
  let maxZ = p2;

  for (let i = 0; i < count; i++) {
    const idx = i * 3;
    const x = positions[idx];
    const y = positions[idx + 1];
    const z = positions[idx + 2];
    if (x !== undefined && y !== undefined && z !== undefined) {
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
      if (z < minZ) minZ = z;
      if (z > maxZ) maxZ = z;
    }
  }

  return {
    x: { min: minX, max: maxX },
    y: { min: minY, max: maxY },
    z: { min: minZ, max: maxZ },
  };
}

/**
 * Extracts the implicit surface zero level set F(x,y,z) = 0 within renderRegion.
 */
export function extractImplicitSurface(
  residualNode: ExpressionNode,
  domainObligations: readonly DomainObligation[] = [],
  renderRegion: WorldBounds,
  budget: GeometryBudget,
  isCancelled?: () => boolean,
): MeshGeometryBuffer {
  const startTime = Date.now();

  // 1. Safe repeated factor / even power reduction (Section 6.B)
  const { meshingResidual } = reduceRepeatedFactorResidual(residualNode);
  const evaluator: CompiledEvaluator = compileEvaluator(meshingResidual, domainObligations);

  const minX = renderRegion.x.min;
  const maxX = renderRegion.x.max;
  const minY = renderRegion.y.min;
  const maxY = renderRegion.y.max;
  const minZ = renderRegion.z.min;
  const maxZ = renderRegion.z.max;

  const N = Math.max(16, Math.min(200, budget.gridResolution));
  const Nx = N;
  const Ny = N;
  const Nz = N;

  const dx = (maxX - minX) / Nx;
  const dy = (maxY - minY) / Ny;
  const dz = (maxZ - minZ) / Nz;

  const normalDelta = Math.max(1e-4, 1e-4 * Math.max(dx, dy, dz));

  // Dynamic growable vertex and index buffers
  let posCapacity = 10_000 * 3;
  let normCapacity = 10_000 * 3;
  let idxCapacity = 20_000 * 3;

  let positions = new Float32Array(posCapacity);
  let normals = new Float32Array(normCapacity);
  let indices = new Uint32Array(idxCapacity);

  let vertexCount = 0;
  let triangleCount = 0;

  // Only adjacent Z layers share edges. Rolling typed caches retain identical
  // welding and vertex order without a large global hash map.
  const edgeLayerSize = (N + 1) * (N + 1);
  const horizontalEdges = new Int32Array(4 * edgeLayerSize).fill(-1);
  const verticalEdges = new Int32Array(edgeLayerSize).fill(-1);
  const corners: CellCorner[] = Array.from({ length: 8 }, () => ({ val: 0, valid: false, isPole: false }));
  const cornerPos: [number, number, number][] = Array.from({ length: 8 }, () => [0, 0, 0]);
  const edgeVertexIndices = new Int32Array(12);
  const getCorner = (index: number) => corners[index]!;
  const getCornerPos = (index: number) => cornerPos[index]!;

  let evalCount = 0;
  let cellsProcessed = 0;
  let poleDiscardedCount = 0;
  let budgetExhausted = false;

  function ensureVertexCapacity(additional: number) {
    if ((vertexCount + additional) * 3 > posCapacity) {
      posCapacity = Math.max(posCapacity * 2, (vertexCount + additional) * 6);
      normCapacity = posCapacity;
      const newPos = new Float32Array(posCapacity);
      newPos.set(positions);
      positions = newPos;

      const newNorm = new Float32Array(normCapacity);
      newNorm.set(normals);
      normals = newNorm;
    }
  }

  function ensureIndexCapacity(additional: number) {
    if ((triangleCount + additional) * 3 > idxCapacity) {
      idxCapacity = Math.max(idxCapacity * 2, (triangleCount + additional) * 6);
      const newIdx = new Uint32Array(idxCapacity);
      newIdx.set(indices);
      indices = newIdx;
    }
  }

  // Slice-based grid evaluation to bound working memory
  const sliceSize = (Nx + 1) * (Ny + 1);
  const slice0Val = new Float64Array(sliceSize);
  const slice0Valid = new Uint8Array(sliceSize); // 1 = valid, 0 = invalid
  const slice0Pole = new Uint8Array(sliceSize); // 1 = isPole, 0 = not

  const slice1Val = new Float64Array(sliceSize);
  const slice1Valid = new Uint8Array(sliceSize);
  const slice1Pole = new Uint8Array(sliceSize);

  const variesX = evaluator.dependencies.has('x');
  const variesY = evaluator.dependencies.has('y');
  const variesZ = evaluator.dependencies.has('z');
  const fastEvaluate = evaluator.evaluateNumeric;
  const evaluateGrid = fastEvaluate ? compileGridEvaluator(meshingResidual, renderRegion, N) : null;

  function evaluateSlice(
    zCoord: number,
    vals: Float64Array,
    valids: Uint8Array,
    poles: Uint8Array,
    zIndex: number,
  ) {
    let idx = 0;
    for (let j = 0; j <= Ny; j++) {
      if (j > 0 && !variesY) {
        vals.copyWithin(idx, 0, Nx + 1);
        valids.copyWithin(idx, 0, Nx + 1);
        poles.copyWithin(idx, 0, Nx + 1);
        idx += Nx + 1;
        continue;
      }
      const yCoord = minY + j * dy;
      for (let i = 0; i <= Nx; i++) {
        if (i > 0 && !variesX) {
          vals[idx] = vals[idx - 1]!;
          valids[idx] = valids[idx - 1]!;
          poles[idx] = poles[idx - 1]!;
          idx++;
          continue;
        }
        const xCoord = minX + i * dx;
        // Successful scalar evaluation is allocation-free; invalid samples retain
        // the original interpreter's exact domain and pole diagnostics.
        if (fastEvaluate) {
          const value = evaluateGrid ? evaluateGrid(i, j, zIndex) : fastEvaluate(xCoord, yCoord, zCoord);
          if (Number.isFinite(value)) {
            evalCount++;
            vals[idx] = value; valids[idx] = 1; poles[idx] = 0;
            idx++;
            continue;
          }
        }
        const res = evaluator.evaluate(xCoord, yCoord, zCoord);
        evalCount++;
        if (res.valid) {
          vals[idx] = res.value;
          valids[idx] = 1;
          poles[idx] = 0;
        } else {
          vals[idx] = NaN;
          valids[idx] = 0;
          poles[idx] = res.isPole ? 1 : 0;
        }
        idx++;
      }
    }
  }

  // Pre-evaluate z = 0 slice
  evaluateSlice(minZ, slice0Val, slice0Valid, slice0Pole, 0);

  // Main marching cubes loop over z slices
  sliceLoop: for (let k = 0; k < Nz; k++) {
    if (isCancelled?.()) {
      return {
        status: 'cancelled',
        positions: new Float32Array(0),
        normals: new Float32Array(0),
        indices: new Uint32Array(0),
        vertexCount: 0,
        triangleCount: 0,
        boundingBox: null,
        diagnostics: {
          evalCount,
          cellsProcessed,
          poleDiscardedCount,
          durationMs: Date.now() - startTime,
          message: 'Operation cancelled',
        },
      };
    }

    // Check duration budget
    if (Date.now() - startTime > budget.maxDurationMs) {
      budgetExhausted = true;
      break sliceLoop;
    }

    const z1 = minZ + (k + 1) * dz;
    if (variesZ) evaluateSlice(z1, slice1Val, slice1Valid, slice1Pole, k + 1);
    else {
      slice1Val.set(slice0Val);
      slice1Valid.set(slice0Valid);
      slice1Pole.set(slice0Pole);
    }

    const nextLayerOffset = ((k + 1) & 1) * edgeLayerSize;
    horizontalEdges.fill(-1, nextLayerOffset, nextLayerOffset + edgeLayerSize);
    horizontalEdges.fill(-1, 2 * edgeLayerSize + nextLayerOffset, 3 * edgeLayerSize + nextLayerOffset);
    verticalEdges.fill(-1);
    const z0 = minZ + k * dz;

    // Process all cells in this layer
    for (let j = 0; j < Ny; j++) {
      const y0 = minY + j * dy;
      const y1 = y0 + dy;

      for (let i = 0; i < Nx; i++) {
        cellsProcessed++;
        const x0 = minX + i * dx;
        const x1 = x0 + dx;

        // Indices into slice arrays
        const idx00 = j * (Nx + 1) + i;
        const idx10 = j * (Nx + 1) + (i + 1);
        const idx11 = (j + 1) * (Nx + 1) + (i + 1);
        const idx01 = (j + 1) * (Nx + 1) + i;

        // Reject empty cells using typed arrays before allocating any corner objects.
        const cubeIndex =
          (slice0Valid[idx00] && slice0Val[idx00]! >= 0 ? 1 : 0) |
          (slice0Valid[idx10] && slice0Val[idx10]! >= 0 ? 2 : 0) |
          (slice0Valid[idx11] && slice0Val[idx11]! >= 0 ? 4 : 0) |
          (slice0Valid[idx01] && slice0Val[idx01]! >= 0 ? 8 : 0) |
          (slice1Valid[idx00] && slice1Val[idx00]! >= 0 ? 16 : 0) |
          (slice1Valid[idx10] && slice1Val[idx10]! >= 0 ? 32 : 0) |
          (slice1Valid[idx11] && slice1Val[idx11]! >= 0 ? 64 : 0) |
          (slice1Valid[idx01] && slice1Val[idx01]! >= 0 ? 128 : 0);
        if (cubeIndex === 0 || cubeIndex === 255) continue;

        // Reuse corner storage for occupied cells; empty cells allocate nothing.
        const offsets = [idx00, idx10, idx11, idx01];
        for (let c = 0; c < 8; c++) {
          const offset = offsets[c & 3]!;
          const corner = corners[c]!;
          corner.val = (c < 4 ? slice0Val : slice1Val)[offset]!;
          corner.valid = (c < 4 ? slice0Valid : slice1Valid)[offset] === 1;
          corner.isPole = (c < 4 ? slice0Pole : slice1Pole)[offset] === 1;
        }

        const edgeMask = getEdgeMask(cubeIndex);
        if (edgeMask === 0) continue;

        // Check if any cut edge connects to an invalid or pole corner (Section 6.B)
        let edgeCrossingInvalid = false;
        for (let e = 0; e < 12; e++) {
          if ((edgeMask & (1 << e)) !== 0) {
            const [vA, vB] = getEdgeVertices(e);
            const cornerA = getCorner(vA);
            const cornerB = getCorner(vB);
            if (!cornerA.valid || !cornerB.valid || cornerA.isPole || cornerB.isPole) {
              edgeCrossingInvalid = true;
              poleDiscardedCount++;
              break;
            }
          }
        }
        if (edgeCrossingInvalid) {
          continue;
        }

        for (let c = 0; c < 8; c++) {
          const position = cornerPos[c]!;
          position[0] = c === 1 || c === 2 || c === 5 || c === 6 ? x1 : x0;
          position[1] = c === 2 || c === 3 || c === 6 || c === 7 ? y1 : y0;
          position[2] = c >= 4 ? z1 : z0;
        }

        // Mid-edge pole and jump check:
        // For rational poles like 1/x = 0, opposite signs can occur across the pole without a true zero.
        let hasPoleJump = false;
        for (let e = 0; e < 12; e++) {
          if ((edgeMask & (1 << e)) !== 0) {
            const [vA, vB] = getEdgeVertices(e);
            const pA = getCornerPos(vA);
            const pB = getCornerPos(vB);
            const midX = (pA[0] + pB[0]) * 0.5;
            const midY = (pA[1] + pB[1]) * 0.5;
            const midZ = (pA[2] + pB[2]) * 0.5;

            const midValue = fastEvaluate?.(midX, midY, midZ);
            const midEval = midValue !== undefined && Number.isFinite(midValue)
              ? { value: midValue, valid: true, isPole: false }
              : evaluator.evaluate(midX, midY, midZ);
            evalCount++;
            if (!midEval.valid || midEval.isPole) {
              hasPoleJump = true;
              poleDiscardedCount++;
              break;
            }

            // If corner values have huge jump and midpoint diverges:
            const valA = getCorner(vA).val;
            const valB = getCorner(vB).val;
            if (
              (valA > 50 && valB < -50 && Math.abs(midEval.value) > 100) ||
              (valA < -50 && valB > 50 && Math.abs(midEval.value) > 100)
            ) {
              hasPoleJump = true;
              poleDiscardedCount++;
              break;
            }
          }
        }
        if (hasPoleJump) {
          continue;
        }

        // Interpolate vertices along cut edges

        for (let e = 0; e < 12; e++) {
          if ((edgeMask & (1 << e)) !== 0) {
            // Compute canonical global edge key for vertex reuse across adjacent cells
            let axis = 0;
            let ex = i;
            let ey = j;
            let ez = k;

            switch (e) {
              case 0: axis = 0; ex = i; ey = j; ez = k; break;
              case 1: axis = 1; ex = i + 1; ey = j; ez = k; break;
              case 2: axis = 0; ex = i; ey = j + 1; ez = k; break;
              case 3: axis = 1; ex = i; ey = j; ez = k; break;
              case 4: axis = 0; ex = i; ey = j; ez = k + 1; break;
              case 5: axis = 1; ex = i + 1; ey = j; ez = k + 1; break;
              case 6: axis = 0; ex = i; ey = j + 1; ez = k + 1; break;
              case 7: axis = 1; ex = i; ey = j; ez = k + 1; break;
              case 8: axis = 2; ex = i; ey = j; ez = k; break;
              case 9: axis = 2; ex = i + 1; ey = j; ez = k; break;
              case 10: axis = 2; ex = i + 1; ey = j + 1; ez = k; break;
              case 11: axis = 2; ex = i; ey = j + 1; ez = k; break;
            }

            const cache = axis === 2 ? verticalEdges : horizontalEdges;
            const edgeKey = (axis === 2 ? 0 : (axis * 2 + (ez & 1)) * edgeLayerSize) + ey * (N + 1) + ex;
            const existingVIdx = cache[edgeKey]!;

            if (existingVIdx !== -1) {
              edgeVertexIndices[e] = existingVIdx;
              continue;
            }

            const [vA, vB] = getEdgeVertices(e);
            const pA = getCornerPos(vA);
            const pB = getCornerPos(vB);
            const valA = getCorner(vA).val;
            const valB = getCorner(vB).val;

            // Deterministic interpolation fraction t
            let t = 0.5;
            const denom = valB - valA;
            if (Math.abs(valA) < 1e-12) {
              t = 0;
            } else if (Math.abs(valB) < 1e-12) {
              t = 1;
            } else if (Math.abs(denom) > 1e-14) {
              t = -valA / denom;
              if (t < 0) t = 0;
              if (t > 1) t = 1;
            }

            const px = pA[0] + t * (pB[0] - pA[0]);
            const py = pA[1] + t * (pB[1] - pA[1]);
            const pz = pA[2] + t * (pB[2] - pA[2]);

            // Normal vector via central difference gradient
            const evXp = evaluator.evaluate(px + normalDelta, py, pz);
            const evXm = evaluator.evaluate(px - normalDelta, py, pz);
            const evYp = evaluator.evaluate(px, py + normalDelta, pz);
            const evYm = evaluator.evaluate(px, py - normalDelta, pz);
            const evZp = evaluator.evaluate(px, py, pz + normalDelta);
            const evZm = evaluator.evaluate(px, py, pz - normalDelta);
            evalCount += 6;

            let nx = 0;
            let ny = 0;
            let nz = 1;

            if (evXp.valid && evXm.valid && evYp.valid && evYm.valid && evZp.valid && evZm.valid) {
              const gx = (evXp.value - evXm.value) / (2 * normalDelta);
              const gy = (evYp.value - evYm.value) / (2 * normalDelta);
              const gz = (evZp.value - evZm.value) / (2 * normalDelta);
              const len = Math.sqrt(gx * gx + gy * gy + gz * gz);
              if (len > 1e-9 && Number.isFinite(len)) {
                nx = gx / len;
                ny = gy / len;
                nz = gz / len;
              }
            }

            // Append vertex
            ensureVertexCapacity(1);
            const vIdx = vertexCount;
            const offset = vIdx * 3;
            positions[offset] = px;
            positions[offset + 1] = py;
            positions[offset + 2] = pz;

            normals[offset] = nx;
            normals[offset + 1] = ny;
            normals[offset + 2] = nz;

            vertexCount++;
            edgeVertexIndices[e] = vIdx;
            cache[edgeKey] = vIdx;

            // Check vertex budget limit
            if (vertexCount >= budget.maxVerticesPerMesh) {
              budgetExhausted = true;
              break sliceLoop;
            }
          }
        }

        // Emit triangles from TRI_TABLE
        const triList = getTriangles(cubeIndex);
        const numTris = Math.floor(triList.length / 3);

        if (numTris > 0) {
          ensureIndexCapacity(numTris);
          for (let tIdx = 0; tIdx < triList.length; tIdx += 3) {
            const e0 = triList[tIdx];
            const e1 = triList[tIdx + 1];
            const e2 = triList[tIdx + 2];

            if (e0 !== undefined && e1 !== undefined && e2 !== undefined) {
              const idx0 = edgeVertexIndices[e0];
              const idx1 = edgeVertexIndices[e1];
              const idx2 = edgeVertexIndices[e2];

              // Validate triangle non-degeneracy
              if (
                idx0 !== undefined &&
                idx1 !== undefined &&
                idx2 !== undefined &&
                idx0 !== idx1 &&
                idx1 !== idx2 &&
                idx0 !== idx2
              ) {
                // Compute geometric face normal from positions
                const p0x = positions[idx0 * 3]!;
                const p0y = positions[idx0 * 3 + 1]!;
                const p0z = positions[idx0 * 3 + 2]!;

                const p1x = positions[idx1 * 3]!;
                const p1y = positions[idx1 * 3 + 1]!;
                const p1z = positions[idx1 * 3 + 2]!;

                const p2x = positions[idx2 * 3]!;
                const p2y = positions[idx2 * 3 + 1]!;
                const p2z = positions[idx2 * 3 + 2]!;

                const v10x = p1x - p0x;
                const v10y = p1y - p0y;
                const v10z = p1z - p0z;

                const v20x = p2x - p0x;
                const v20y = p2y - p0y;
                const v20z = p2z - p0z;

                const fnx = v10y * v20z - v10z * v20y;
                const fny = v10z * v20x - v10x * v20z;
                const fnz = v10x * v20y - v10y * v20x;

                // Average vertex normal
                const avgNx = normals[idx0 * 3]! + normals[idx1 * 3]! + normals[idx2 * 3]!;
                const avgNy = normals[idx0 * 3 + 1]! + normals[idx1 * 3 + 1]! + normals[idx2 * 3 + 1]!;
                const avgNz = normals[idx0 * 3 + 2]! + normals[idx1 * 3 + 2]! + normals[idx2 * 3 + 2]!;

                const dot = fnx * avgNx + fny * avgNy + fnz * avgNz;

                let finalIdx1 = idx1;
                let finalIdx2 = idx2;
                if (dot < 0) {
                  // Invert winding so face normal points along vertex normal
                  finalIdx1 = idx2;
                  finalIdx2 = idx1;
                }

                const iOffset = triangleCount * 3;
                indices[iOffset] = idx0;
                indices[iOffset + 1] = finalIdx1;
                indices[iOffset + 2] = finalIdx2;
                triangleCount++;

                if (triangleCount >= budget.maxTrianglesPerMesh) {
                  budgetExhausted = true;
                  break sliceLoop;
                }
              }
            }
          }
        }
      }
    }

    // Cycle slices: copy slice1 to slice0
    slice0Val.set(slice1Val);
    slice0Valid.set(slice1Valid);
    slice0Pole.set(slice1Pole);
  }

  const durationMs = Date.now() - startTime;

  // Trim arrays to actual used sizes
  const finalPositions = positions.slice(0, vertexCount * 3);
  const finalNormals = normals.slice(0, vertexCount * 3);
  const finalIndices = indices.slice(0, triangleCount * 3);

  const boundingBox = computeBoundingBox(finalPositions, vertexCount);

  let status: GeometryStatus = 'success';
  if (triangleCount === 0) {
    status = 'no-geometry-detected';
  } else if (budgetExhausted) {
    status = 'partial-budget-limited';
  }

  // Calculate approximate residual error across vertices
  let approxResidualError: number | undefined;
  if (vertexCount > 0) {
    const testSampleCount = Math.min(20, vertexCount);
    let maxRes = 0;
    for (let s = 0; s < testSampleCount; s++) {
      const idx = Math.floor((s * vertexCount) / testSampleCount) * 3;
      const x = finalPositions[idx];
      const y = finalPositions[idx + 1];
      const z = finalPositions[idx + 2];
      if (x !== undefined && y !== undefined && z !== undefined) {
        const ev = evaluator.evaluate(x, y, z);
        if (ev.valid) {
          const absRes = Math.abs(ev.value);
          if (absRes > maxRes) maxRes = absRes;
        }
      }
    }
    approxResidualError = maxRes;
  }

  // Generate subtle coordinate section guide curves (Section 4.C)
  let guideCurvesPositions: Float32Array | undefined;
  if (triangleCount > 0 && boundingBox) {
    const guides = generateCoordinateGuides(finalPositions, finalIndices, boundingBox);
    if (guides.segmentCount > 0) {
      guideCurvesPositions = guides.positions;
    }
  }

  return {
    status,
    positions: finalPositions,
    normals: finalNormals,
    indices: finalIndices,
    vertexCount,
    triangleCount,
    boundingBox,
    guideCurvesPositions,
    diagnostics: {
      evalCount,
      cellsProcessed,
      poleDiscardedCount,
      durationMs,
      approxResidualError,
      message: budgetExhausted
        ? 'Surface extraction reached configured budget limit; returning partial mesh.'
        : triangleCount === 0
          ? 'No zero level set detected within requested finite render region.'
          : 'Surface extracted successfully.',
    },
  };
}
