/**
 * Core geometry generation pipeline for Intersect Phase V6.
 *
 * Coordinates surface meshing for Surface F and Surface G alongside curve sampling.
 * Can be run in a dedicated Web Worker or synchronously in-process.
 */

import {
  type GeometryRequest,
  type GeometryResult,
  type GeometryBudget,
  GEOMETRY_BUDGET_PRESETS,
} from '../contracts/geometry';
import { extractImplicitSurface } from './marching-cubes';
import { sampleExactCurve } from './curve-sampler';
import { autoGeometryBudget } from './view-detail';

/**
 * Resolves the effective GeometryBudget from the requested preset and custom overrides.
 */
export function resolveGeometryBudget(request: GeometryRequest): GeometryBudget {
  const basePreset = request.quality === 'auto'
    ? autoGeometryBudget(request.view)
    : GEOMETRY_BUDGET_PRESETS[request.quality] ?? GEOMETRY_BUDGET_PRESETS.default;
  if (!request.customBudget) {
    return basePreset;
  }
  return {
    gridResolution: request.customBudget.gridResolution ?? basePreset.gridResolution,
    maxVerticesPerMesh: request.customBudget.maxVerticesPerMesh ?? basePreset.maxVerticesPerMesh,
    maxTrianglesPerMesh: request.customBudget.maxTrianglesPerMesh ?? basePreset.maxTrianglesPerMesh,
    maxCurveSamples: request.customBudget.maxCurveSamples ?? basePreset.maxCurveSamples,
    maxCurveSubdivisionDepth:
      request.customBudget.maxCurveSubdivisionDepth ?? basePreset.maxCurveSubdivisionDepth,
    curveGeometricTolerance:
      request.customBudget.curveGeometricTolerance ?? basePreset.curveGeometricTolerance,
    maxDurationMs: request.customBudget.maxDurationMs ?? basePreset.maxDurationMs,
  };
}

/**
 * Executes complete geometry generation for Surface F, Surface G, and optional Exact Curve.
 */
export function generateGeometry(
  request: GeometryRequest,
  isCancelled?: () => boolean,
): GeometryResult {
  const startTime = Date.now();
  const budget = resolveGeometryBudget(request);

  // 1. Surface F Extraction
  const surfaceF = extractImplicitSurface(
    request.surfaceF.residual,
    request.surfaceF.domainObligations ?? [],
    request.renderRegion,
    budget,
    isCancelled,
  );

  // 2. Surface G Extraction
  const surfaceG = extractImplicitSurface(
    request.surfaceG.residual,
    request.surfaceG.domainObligations ?? [],
    request.renderRegion,
    budget,
    isCancelled,
  );

  // 3. Exact Curve Sampling (if present)
  let curve = null;
  if (request.curve?.exactCurve) {
    curve = sampleExactCurve(
      request.curve.exactCurve,
      request.renderRegion,
      budget,
      isCancelled,
    );
  }

  const totalDurationMs = Date.now() - startTime;
  const budgetExhausted =
    surfaceF.status === 'partial-budget-limited' ||
    surfaceG.status === 'partial-budget-limited' ||
    curve?.status === 'partial-budget-limited';

  return {
    jobId: request.jobId,
    calculationId: request.calculationId,
    workerGeneration: request.workerGeneration,
    renderRegion: request.renderRegion,
    surfaceF,
    surfaceG,
    curve,
    totalDurationMs,
    budgetExhausted,
    timestamp: Date.now(),
  };
}
