/**
 * Geometry contracts for Intersect Phase V6.
 *
 * Defines typed, transferable, versioned geometry requests, mesh buffers,
 * curve samples, quality presets, budgets, and worker message envelopes.
 *
 * Architectural Invariants:
 * 1. ZERO THREE.JS OR GPU DEPENDENCY in this contract:
 *    Geometry produces pure typed ArrayBuffers (Float32Array, Uint32Array, Float64Array).
 * 2. EXPLICIT TRANSFER OWNERSHIP:
 *    Buffers are transferred across the Web Worker boundary using postMessage(msg, transferables).
 *    Detached ArrayBuffers are never reused.
 * 3. STALE RESULT PROTECTION:
 *    Every request carries calculationId, jobId, and workerGeneration.
 *    Any response that does not match active identifiers is discarded.
 * 4. MATHEMATICAL HONESTY:
 *    Geometry buffers represent approximate display samples only.
 *    Geometry never mutates the exact solver result or promotes numerical observations
 *    into mathematical proofs.
 */

import type { WorldBounds } from './bounds';
import type { ExpressionNode, DomainObligation } from './expressions';
import type { ExactCurve, TraversalDirection, CurveTraversalMetadata } from './curve';

export const GEOMETRY_PROTOCOL_VERSION = '1.0.0';

export type GeometryQualityPreset = 'low' | 'medium' | 'high' | 'draft' | 'default' | 'ultra';

export interface GeometryBudget {
  /** Grid cells per dimension for implicit surface marching cubes (e.g. 32, 64, 80, 100) */
  readonly gridResolution: number;
  /** Maximum allowable vertices per surface mesh */
  readonly maxVerticesPerMesh: number;
  /** Maximum allowable triangles per surface mesh */
  readonly maxTrianglesPerMesh: number;
  /** Maximum curve sample points across all segments */
  readonly maxCurveSamples: number;
  /** Maximum adaptive subdivision depth for curve sampling */
  readonly maxCurveSubdivisionDepth: number;
  /** Maximum allowable chord deviation for curve adaptive sampling (world space) */
  readonly curveGeometricTolerance: number;
  /** Maximum evaluation time in milliseconds before partial return */
  readonly maxDurationMs: number;
}

export const GEOMETRY_BUDGET_PRESETS: Record<GeometryQualityPreset, GeometryBudget> = {
  low: {
    gridResolution: 56,
    maxVerticesPerMesh: 200_000,
    maxTrianglesPerMesh: 400_000,
    maxCurveSamples: 3_000,
    maxCurveSubdivisionDepth: 8,
    curveGeometricTolerance: 0.03,
    maxDurationMs: 6_000,
  },
  medium: {
    gridResolution: 84,
    maxVerticesPerMesh: 450_000,
    maxTrianglesPerMesh: 900_000,
    maxCurveSamples: 7_000,
    maxCurveSubdivisionDepth: 11,
    curveGeometricTolerance: 0.008,
    maxDurationMs: 12_000,
  },
  high: {
    gridResolution: 112,
    maxVerticesPerMesh: 750_000,
    maxTrianglesPerMesh: 1_500_000,
    maxCurveSamples: 14_000,
    maxCurveSubdivisionDepth: 14,
    curveGeometricTolerance: 0.002,
    maxDurationMs: 20_000,
  },
  // Backward-compatible aliases
  draft: {
    gridResolution: 56,
    maxVerticesPerMesh: 200_000,
    maxTrianglesPerMesh: 400_000,
    maxCurveSamples: 3_000,
    maxCurveSubdivisionDepth: 8,
    curveGeometricTolerance: 0.03,
    maxDurationMs: 6_000,
  },
  default: {
    gridResolution: 84,
    maxVerticesPerMesh: 450_000,
    maxTrianglesPerMesh: 900_000,
    maxCurveSamples: 7_000,
    maxCurveSubdivisionDepth: 11,
    curveGeometricTolerance: 0.008,
    maxDurationMs: 12_000,
  },
  ultra: {
    gridResolution: 128,
    maxVerticesPerMesh: 1_000_000,
    maxTrianglesPerMesh: 2_000_000,
    maxCurveSamples: 20_000,
    maxCurveSubdivisionDepth: 16,
    curveGeometricTolerance: 0.001,
    maxDurationMs: 25_000,
  },
};

export type GeometryStatus =
  | 'success'
  | 'no-geometry-detected'
  | 'partial-budget-limited'
  | 'unsupported-evaluation'
  | 'cancelled'
  | 'error';

export interface SurfaceInputSpec {
  readonly id: string;
  readonly label: string;
  /** The residual expression F(x,y,z) = lhs - rhs */
  readonly residual: ExpressionNode;
  /** Real domain obligations (denominators != 0, radicands >= 0, etc.) */
  readonly domainObligations?: readonly DomainObligation[];
  /** Optional raw text for diagnostics */
  readonly rawInput?: string;
}

export interface CurveInputSpec {
  readonly paramSymbol: string;
  readonly xExpr: ExpressionNode | string;
  readonly yExpr: ExpressionNode | string;
  readonly zExpr: ExpressionNode | string;
  readonly exactCurve: ExactCurve;
  readonly traversal: CurveTraversalMetadata;
}

export interface GeometryRequest {
  readonly jobId: string;
  readonly calculationId: string | number;
  readonly workerGeneration: number;
  readonly surfaceF: SurfaceInputSpec;
  readonly surfaceG: SurfaceInputSpec;
  readonly curve?: CurveInputSpec | null;
  /** Fixed global calculation bounds, e.g. [-1000, 1000]^3 */
  readonly worldBounds: WorldBounds;
  /** Requested finite render view region, e.g. [-50, 50]^3 */
  readonly renderRegion: WorldBounds;
  readonly quality: GeometryQualityPreset;
  readonly customBudget?: Partial<GeometryBudget>;
}