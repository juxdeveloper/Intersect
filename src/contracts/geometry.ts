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

export const GEOMETRY_PROTOCOL_VERSION = '1.1.0';

export type GeometryQualityPreset = 'auto' | 'low' | 'medium' | 'high' | 'draft' | 'default' | 'ultra';

/** Serializable camera metrics; geometry workers do not depend on Three.js. */
export interface GeometryView {
  readonly target: { readonly x: number; readonly y: number; readonly z: number };
  readonly distance: number;
  readonly verticalFov: number;
  readonly aspect: number;
  readonly viewportHeight: number;
}

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
  auto: {
    gridResolution: 144,
    maxVerticesPerMesh: 1_000_000,
    maxTrianglesPerMesh: 2_000_000,
    maxCurveSamples: 24_000,
    maxCurveSubdivisionDepth: 17,
    curveGeometricTolerance: 0.001,
    maxDurationMs: 20_000,
  },
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
  readonly view?: GeometryView;
  readonly customBudget?: Partial<GeometryBudget>;
}

export interface MeshDiagnostics {
  readonly evalCount: number;
  readonly cellsProcessed: number;
  readonly poleDiscardedCount: number;
  readonly durationMs: number;
  readonly approxResidualError?: number;
  readonly message?: string;
}

export interface MeshGeometryBuffer {
  readonly status: GeometryStatus;
  /** Flat [x0, y0, z0, x1, y1, z1, ...] in Float32Array */
  readonly positions: Float32Array;
  /** Flat [nx0, ny0, nz0, ...] in Float32Array */
  readonly normals: Float32Array;
  /** Triangle vertex indices in Uint32Array */
  readonly indices: Uint32Array;
  readonly vertexCount: number;
  readonly triangleCount: number;
  readonly boundingBox: WorldBounds | null;
  readonly diagnostics: MeshDiagnostics;
  /** Optional GeoGebra-style coordinate section guide curve segments [x1,y1,z1, x2,y2,z2, ...] */
  readonly guideCurvesPositions?: Float32Array;
}

export interface CurveDiagnostics {
  readonly subdivisions: number;
  readonly clippedSegments: number;
  readonly durationMs: number;
  readonly message?: string;
}

export interface CurveGeometryBuffer {
  readonly status: GeometryStatus;
  /** Flat [x0, y0, z0, x1, y1, z1, ...] in Float32Array */
  readonly positions: Float32Array;
  /** Double-precision parameter values corresponding to each sample in Float64Array */
  readonly tValues: Float64Array;
  /** Indices into positions where independent polyline segments begin in Uint32Array */
  readonly segmentBreaks: Uint32Array;
  readonly sampleCount: number;
  readonly segmentCount: number;
  readonly boundingBox: WorldBounds | null;
  readonly traversalOrientation: TraversalDirection;
  readonly isClosed: boolean;
  readonly isPeriodic: boolean;
  readonly diagnostics: CurveDiagnostics;
}

export interface GeometryResult {
  readonly jobId: string;
  readonly calculationId: string | number;
  readonly workerGeneration: number;
  readonly renderRegion: WorldBounds;
  readonly surfaceF: MeshGeometryBuffer;
  readonly surfaceG: MeshGeometryBuffer;
  readonly curve: CurveGeometryBuffer | null;
  readonly totalDurationMs: number;
  readonly budgetExhausted: boolean;
  readonly timestamp: number;
}

/* Worker Messages */

export type GeometryWorkerRequest =
  | GenerateGeometryWorkerRequest
  | CancelGeometryWorkerRequest
  | PingGeometryWorkerRequest;

export interface GenerateGeometryWorkerRequest {
  readonly type: 'generate-geometry';
  readonly request: GeometryRequest;
}

export interface CancelGeometryWorkerRequest {
  readonly type: 'cancel-geometry';
  readonly jobId: string;
  readonly reason?: string;
}

export interface PingGeometryWorkerRequest {
  readonly type: 'ping';
}

export type GeometryWorkerResponse =
  | GeometryResultResponse
  | GeometryPreviewResponse
  | GeometryProgressResponse
  | GeometryCancelledResponse
  | GeometryErrorResponse
  | GeometryPongResponse;

export interface GeometryResultResponse {
  readonly type: 'geometry-result';
  readonly result: GeometryResult;
}

/** A promptly rendered intermediate mesh; only geometry-result completes a job. */
export interface GeometryPreviewResponse {
  readonly type: 'geometry-preview';
  readonly result: GeometryResult;
}

export interface GeometryProgressResponse {
  readonly type: 'geometry-progress';
  readonly jobId: string;
  readonly stage: 'surface-f' | 'surface-g' | 'curve' | 'complete';
  readonly progress: number; // 0.0 to 1.0
}

export interface GeometryCancelledResponse {
  readonly type: 'geometry-cancelled';
  readonly jobId: string;
  readonly reason?: string;
}

export interface GeometryErrorResponse {
  readonly type: 'geometry-error';
  readonly jobId: string;
  readonly message: string;
  readonly details?: string;
}

export interface GeometryPongResponse {
  readonly type: 'pong';
}

/**
 * Helper to construct an empty/failed mesh buffer.
 */
export function createEmptyMeshBuffer(
  status: GeometryStatus,
  diagnostics: Partial<MeshDiagnostics> = {},
): MeshGeometryBuffer {
  return {
    status,
    positions: new Float32Array(0),
    normals: new Float32Array(0),
    indices: new Uint32Array(0),
    vertexCount: 0,
    triangleCount: 0,
    boundingBox: null,
    diagnostics: {
      evalCount: diagnostics.evalCount ?? 0,
      cellsProcessed: diagnostics.cellsProcessed ?? 0,
      poleDiscardedCount: diagnostics.poleDiscardedCount ?? 0,
      durationMs: diagnostics.durationMs ?? 0,
      message: diagnostics.message,
      approxResidualError: diagnostics.approxResidualError,
    },
  };
}

/**
 * Helper to construct an empty/failed curve buffer.
 */
export function createEmptyCurveBuffer(
  status: GeometryStatus,
  orientation: TraversalDirection = 'forward',
  diagnostics: Partial<CurveDiagnostics> = {},
): CurveGeometryBuffer {
  return {
    status,
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
      subdivisions: diagnostics.subdivisions ?? 0,
      clippedSegments: diagnostics.clippedSegments ?? 0,
      durationMs: diagnostics.durationMs ?? 0,
      message: diagnostics.message,
    },
  };
}
