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