/**
 * Bounded Marching Cubes implicit surface extractor for Intersect Phase V6.
 *
 * Implements:
 * 1. Streamlined slice-by-slice grid evaluation with minimal memory footprint (< 100 KB RAM).
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

interface CellCorner {
  readonly val: number;
  readonly valid: boolean;
  readonly isPole: boolean;
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