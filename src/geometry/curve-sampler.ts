/**
 * Adaptive error-controlled curve sampler for Intersect Phase V6.
 *
 * Implements:
 * 1. Strict parameter interval ordering and traversal direction preservation from V5.
 * 2. Multi-point chord deviation testing (midpoint + 1/3 + 2/3 interior points)
 *    to prevent aliasing on oscillatory curves (e.g. sin(2*pi*t)).
 * 3. 3D Liang-Barsky box clipping against finite render region with exact parameter refinement.
 * 4. Explicit preservation of domain gaps, excluded points, and entry/exit segment breaks.
 * 5. Bounded numerical window policy for infinite parameter domains with partial coverage metadata.
 * 6. Closed-loop preservation if and only if V5 established endpoint identification.
 */

import type { WorldBounds } from '../contracts/bounds';
import type { ExpressionNode } from '../contracts/expressions';
import type { ExactCurve, TraversalDirection } from '../contracts/curve';
import type {
  GeometryBudget,
  CurveGeometryBuffer,
  GeometryStatus,
} from '../contracts/geometry';
import { parseCurveExpression } from '../math/curve-parser';
import { compileEvaluator, type CompiledEvaluator } from './evaluator';

interface SamplePoint {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly t: number;
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
 * Perpendicular distance from 3D point Q to line segment AB.
 */
function pointToSegmentDistance(
  qx: number,
  qy: number,
  qz: number,
  ax: number,
  ay: number,
  az: number,
  bx: number,
  by: number,
  bz: number,
): number {
  const vx = bx - ax;
  const vy = by - ay;
  const vz = bz - az;

  const wx = qx - ax;
  const wy = qy - ay;
  const wz = qz - az;

  const c1 = wx * vx + wy * vy + wz * vz;
  const c2 = vx * vx + vy * vy + vz * vz;

  if (c2 < 1e-14) {
    return Math.sqrt(wx * wx + wy * wy + wz * wz);
  }

  if (c1 <= 0) {
    return Math.sqrt(wx * wx + wy * wy + wz * wz);
  }
  if (c2 <= c1) {
    const dx = qx - bx;
    const dy = qy - by;
    const dz = qz - bz;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }

  const b = c1 / c2;
  const px = ax + b * vx;
  const py = ay + b * vy;
  const pz = az + b * vz;

  const rx = qx - px;
  const ry = qy - py;
  const rz = qz - pz;
  return Math.sqrt(rx * rx + ry * ry + rz * rz);
}

/**
 * 3D Liang-Barsky line-box clipping.
 * Returns visible parameter fractions [u1, u2] in [0, 1] intersecting renderRegion, or null if outside.
 */
function clipSegmentToBox(
  p1x: number,
  p1y: number,
  p1z: number,
  p2x: number,
  p2y: number,
  p2z: number,
  box: WorldBounds,
): [number, number] | null {
  let u1 = 0.0;
  let u2 = 1.0;

  const dx = p2x - p1x;
  const dy = p2y - p1y;
  const dz = p2z - p1z;

  const p: readonly [number, number, number, number, number, number] = [
    -dx,
    dx,
    -dy,
    dy,
    -dz,
    dz,
  ];
  const q: readonly [number, number, number, number, number, number] = [
    p1x - box.x.min,
    box.x.max - p1x,
    p1y - box.y.min,
    box.y.max - p1y,
    p1z - box.z.min,
    box.z.max - p1z,
  ];

  for (let i = 0; i < 6; i++) {
    const pi = p[i]!;
    const qi = q[i]!;

    if (Math.abs(pi) < 1e-14) {
      if (qi < 0) return null; // Parallel and outside
    } else {
      const t = qi / pi;
      if (pi < 0) {
        if (t > u2) return null;
        if (t > u1) u1 = t;
      } else {
        if (t < u1) return null;
        if (t < u2) u2 = t;
      }
    }
  }

  if (u1 > u2) return null;
  return [Math.max(0, u1), Math.min(1, u2)];
}

/**
 * Evaluator bundle for the 3 curve components x(t), y(t), z(t).
 */
class CurveEvaluator {
  private readonly evalX: CompiledEvaluator;
  private readonly evalY: CompiledEvaluator;
  private readonly evalZ: CompiledEvaluator;

  constructor(xNode: ExpressionNode, yNode: ExpressionNode, zNode: ExpressionNode) {
    this.evalX = compileEvaluator(xNode);
    this.evalY = compileEvaluator(yNode);
    this.evalZ = compileEvaluator(zNode);
  }

  evaluate(t: number): SamplePoint | null {
    const rx = this.evalX.evaluateT(t);
    if (!rx.valid) return null;
    const ry = this.evalY.evaluateT(t);
    if (!ry.valid) return null;
    const rz = this.evalZ.evaluateT(t);
    if (!rz.valid) return null;

    if (!Number.isFinite(rx.value) || !Number.isFinite(ry.value) || !Number.isFinite(rz.value)) {
      return null;
    }

    return { x: rx.value, y: ry.value, z: rz.value, t };
  }
}

/**
 * Samples the active exact curve within the requested finite render region and budget.
 */
export function sampleExactCurve(
  curve: ExactCurve,
  renderRegion: WorldBounds,
  budget: GeometryBudget,
  isCancelled?: () => boolean,
): CurveGeometryBuffer {
  const startTime = Date.now();
  const orientation: TraversalDirection = curve.traversal?.orientation ?? curve.direction;
  const paramSymbol = curve.paramSymbol || (orientation === 'reverse' ? 'u' : 't');

  // Parse components to AST ExpressionNodes
  const xRes = parseCurveExpression(curve.x, paramSymbol);
  const yRes = parseCurveExpression(curve.y, paramSymbol);
  const zRes = parseCurveExpression(curve.z, paramSymbol);

  if (!xRes.success || !yRes.success || !zRes.success) {
    return {
      status: 'unsupported-evaluation',
      positions: new Float32Array(0),
      tValues: new Float64Array(0),
      segmentBreaks: new Uint32Array(0),
      sampleCount: 0,
      segmentCount: 0,
      boundingBox: null,
      traversalOrientation: orientation,
      isClosed: false,
      isPeriodic: false,
      diagnostics: {
        subdivisions: 0,
        clippedSegments: 0,
        durationMs: Date.now() - startTime,
        message: `Failed to parse curve expression: ${[!xRes.success && xRes.error, !yRes.success && yRes.error, !zRes.success && zRes.error].filter(Boolean).join('; ')}`,
      },
    };
  }

  const evaluator = new CurveEvaluator(xRes.ast, yRes.ast, zRes.ast);

  const posList: number[] = [];
  const tList: number[] = [];
  const breakList: number[] = [];

  let subdivisions = 0;
  let clippedSegments = 0;
  let budgetExhausted = false;
  let infiniteDomainClamped = false;

  const intervals = curve.domain.intervals;
  if (intervals.length === 0) {
    return {
      status: 'no-geometry-detected',
      positions: new Float32Array(0),
      tValues: new Float64Array(0),
      segmentBreaks: new Uint32Array(0),
      sampleCount: 0,
      segmentCount: 0,
      boundingBox: null,
      traversalOrientation: orientation,
      isClosed: false,
      isPeriodic: false,
      diagnostics: {
        subdivisions: 0,
        clippedSegments: 0,
        durationMs: Date.now() - startTime,
        message: 'Empty parameter domain',
      },
    };
  }

  // Iterate over intervals in strict parameter order
  for (const interval of intervals) {
    if (isCancelled?.()) {
      return {
        status: 'cancelled',
        positions: new Float32Array(0),
        tValues: new Float64Array(0),
        segmentBreaks: new Uint32Array(0),
        sampleCount: 0,
        segmentCount: 0,
        boundingBox: null,
        traversalOrientation: orientation,
        isClosed: false,
        isPeriodic: false,
        diagnostics: {
          subdivisions,
          clippedSegments,
          durationMs: Date.now() - startTime,
          message: 'Operation cancelled',
        },
      };
    }

    // Determine finite numerical bounds for this interval
    let tMin: number;
    let tMax: number;

    if (interval.min.kind === 'finite') {
      tMin = interval.min.numericApprox ?? parseFloat(interval.min.exact);
      if (!interval.minInclusive) {
        tMin += 1e-6;
      }
    } else {
      // Infinite lower bound: clamped to bounded window (Section 7.D)
      tMin = -100;
      infiniteDomainClamped = true;
    }

    if (interval.max.kind === 'finite') {
      tMax = interval.max.numericApprox ?? parseFloat(interval.max.exact);
      if (!interval.maxInclusive) {
        tMax -= 1e-6;
      }
    } else {
      // Infinite upper bound: clamped to bounded window (Section 7.D)
      tMax = 100;
      infiniteDomainClamped = true;
    }

    if (tMin >= tMax) continue;

    // Disconnected interval segment: start a new polyline segment
    let inActiveSegment = false;

    // Adaptive subdivision helper
    function sampleIntervalSubdivision(tA: number, tB: number, depth: number) {
      if (budgetExhausted) return;

      const pA = evaluator.evaluate(tA);
      const pB = evaluator.evaluate(tB);

      if (!pA && !pB) {
        // Entire interval invalid or domain gap
        inActiveSegment = false;
        return;
      }

      if (!pA || !pB) {
        // Discontinuity / singularity boundary: isolate if depth allows
        if (depth < budget.maxCurveSubdivisionDepth) {
          const tMid = (tA + tB) * 0.5;
          subdivisions++;
          sampleIntervalSubdivision(tA, tMid, depth + 1);
          sampleIntervalSubdivision(tMid, tB, depth + 1);
        } else {
          inActiveSegment = false;
        }
        return;
      }

      // Both pA and pB are valid. Check anti-aliasing multi-point chord deviation (Section 7.B)
      const tMid = (tA + tB) * 0.5;
      const t13 = tA + (tB - tA) * (1 / 3);
      const t23 = tA + (tB - tA) * (2 / 3);

      const pMid = evaluator.evaluate(tMid);
      const p13 = evaluator.evaluate(t13);
      const p23 = evaluator.evaluate(t23);

      if (!pMid || !p13 || !p23) {
        // Interior pole / singularity
        if (depth < budget.maxCurveSubdivisionDepth) {
          subdivisions++;
          sampleIntervalSubdivision(tA, tMid, depth + 1);
          sampleIntervalSubdivision(tMid, tB, depth + 1);
        } else {
          inActiveSegment = false;
        }
        return;
      }

      const dMid = pointToSegmentDistance(pMid.x, pMid.y, pMid.z, pA.x, pA.y, pA.z, pB.x, pB.y, pB.z);
      const d13 = pointToSegmentDistance(p13.x, p13.y, p13.z, pA.x, pA.y, pA.z, pB.x, pB.y, pB.z);
      const d23 = pointToSegmentDistance(p23.x, p23.y, p23.z, pA.x, pA.y, pA.z, pB.x, pB.y, pB.z);

      const maxDeviation = Math.max(dMid, d13, d23);

      if (maxDeviation > budget.curveGeometricTolerance && depth < budget.maxCurveSubdivisionDepth) {
        subdivisions++;
        sampleIntervalSubdivision(tA, tMid, depth + 1);
        sampleIntervalSubdivision(tMid, tB, depth + 1);
        return;
      }

      // Segment [pA, pB] accepted. Now clip against finite renderRegion (Section 7.C)
      const clip = clipSegmentToBox(pA.x, pA.y, pA.z, pB.x, pB.y, pB.z, renderRegion);
      if (!clip) {
        // Outside renderRegion
        inActiveSegment = false;
        clippedSegments++;
        return;
      }

      const [u1, u2] = clip;

      // Check if entering or already in active segment
      if (u1 > 0 || !inActiveSegment) {
        // Entry vertex
        const tEntry = tA + u1 * (tB - tA);
        const pEntry = u1 > 0 ? (evaluator.evaluate(tEntry) ?? pA) : pA;

        // Record segment break
        breakList.push(posList.length / 3);
        posList.push(pEntry.x, pEntry.y, pEntry.z);
        tList.push(tEntry);
        inActiveSegment = true;
      }

      // Exit vertex
      const tExit = tA + u2 * (tB - tA);
      const pExit = u2 < 1 ? (evaluator.evaluate(tExit) ?? pB) : pB;

      posList.push(pExit.x, pExit.y, pExit.z);
      tList.push(tExit);

      if (u2 < 1) {
        // Exited box
        inActiveSegment = false;
        clippedSegments++;
      }

      // Check sample budget
      if (posList.length / 3 >= budget.maxCurveSamples) {
        budgetExhausted = true;
      }
    }

    // Coarse initial division to seed adaptive sampling with high fidelity
    const K = budget.curveGeometricTolerance <= 0.003 ? 192 : budget.curveGeometricTolerance <= 0.01 ? 96 : 48;
    const step = (tMax - tMin) / K;
    for (let k = 0; k < K; k++) {
      if (budgetExhausted) break;
      const subA = tMin + k * step;
      const subB = k === K - 1 ? tMax : tMin + (k + 1) * step;
      sampleIntervalSubdivision(subA, subB, 0);
    }
  }

  const sampleCount = posList.length / 3;
  const positions = new Float32Array(posList);
  const tValues = new Float64Array(tList);
  const segmentBreaks = new Uint32Array(breakList);

  const boundingBox = computeBoundingBox(positions, sampleCount);

  let status: GeometryStatus = 'success';
  if (sampleCount === 0) {
    status = 'no-geometry-detected';
  } else if (budgetExhausted) {
    status = 'partial-budget-limited';
  }

  const isClosed = curve.traversal?.isClosed ?? false;
  const isPeriodic = curve.traversal?.isPeriodic ?? false;

  return {
    status,
    positions,
    tValues,
    segmentBreaks,
    sampleCount,
    segmentCount: breakList.length,
    boundingBox,
    traversalOrientation: orientation,
    isClosed,
    isPeriodic,
    diagnostics: {
      subdivisions,
      clippedSegments,
      durationMs: Date.now() - startTime,
      message: budgetExhausted
        ? 'Curve sampling reached configured sample budget limit.'
        : infiniteDomainClamped
          ? 'Infinite parameter domain sampled within bounded window [-100, 100].'
          : sampleCount === 0
            ? 'Curve does not enter requested finite render region.'
            : 'Curve sampled successfully.',
    },
  };
}
