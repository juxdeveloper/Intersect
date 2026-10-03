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
  type SurfaceInputSpec,
  GEOMETRY_BUDGET_PRESETS,
} from '../contracts/geometry';
import { extractImplicitSurface } from './marching-cubes';
import { sampleExactCurve } from './curve-sampler';
import { autoGeometryBudget } from './view-detail';
import { GeometryCache } from './geometry-cache';

function surfaceCacheKey(spec: SurfaceInputSpec, request: GeometryRequest, budget: GeometryBudget): string {
  return JSON.stringify(['surface', spec.residual, spec.domainObligations ?? [], request.renderRegion,
    budget.gridResolution, budget.maxVerticesPerMesh, budget.maxTrianglesPerMesh, budget.maxDurationMs]);
}

export function hasCachedSurfaces(request: GeometryRequest, cache: GeometryCache): boolean {
  const budget = resolveGeometryBudget(request);
  return Boolean(cache.get(surfaceCacheKey(request.surfaceF, request, budget))
    && cache.get(surfaceCacheKey(request.surfaceG, request, budget)));
}

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
  cache?: GeometryCache,
): GeometryResult {
  const startTime = Date.now();
  const budget = resolveGeometryBudget(request);

  const surface = (spec: GeometryRequest['surfaceF']) => {
    const key = surfaceCacheKey(spec, request, budget);
    const cached = cache?.get<ReturnType<typeof extractImplicitSurface>>(key);
    if (cached && !isCancelled?.()) return cached;
    const buffer = extractImplicitSurface(spec.residual, spec.domainObligations ?? [], request.renderRegion, budget, isCancelled);
    cache?.set(key, buffer);
    return buffer;
  };
  const surfaceF = surface(request.surfaceF);
  const surfaceG = surface(request.surfaceG);

  // 3. Exact Curve Sampling (if present)
  let curve = null;
  if (request.curve?.exactCurve) {
    const key = JSON.stringify(['curve', request.curve.exactCurve, request.renderRegion,
      budget.maxCurveSamples, budget.maxCurveSubdivisionDepth, budget.curveGeometricTolerance, budget.maxDurationMs]);
    curve = !isCancelled?.() ? cache?.get<ReturnType<typeof sampleExactCurve>>(key) ?? null : null;
    if (!curve) {
      curve = sampleExactCurve(request.curve.exactCurve, request.renderRegion, budget, isCancelled);
      cache?.set(key, curve);
    }
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
