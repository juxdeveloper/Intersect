import type { GeometryRequest, GeometryResult } from '../contracts/geometry';
import { GeometryCache } from './geometry-cache';
import { generateGeometry, resolveGeometryBudget, hasCachedSurfaces } from './geometry-generator';

/** Auto shows fresh geometry promptly, then refines to its unchanged final budget. */
export function runGeometryJob(
  request: GeometryRequest,
  cache: GeometryCache,
  publish: (type: 'geometry-preview' | 'geometry-result', result: GeometryResult) => void,
  isCancelled: () => boolean = () => false,
): void {
  if (request.quality === 'auto' && resolveGeometryBudget(request).gridResolution > 64
    && !hasCachedSurfaces(request, cache)) {
    const preview = generateGeometry({ ...request, customBudget: {
      ...request.customBudget,
      gridResolution: 64,
    } }, isCancelled, cache);
    if (isCancelled()) return;
    publish('geometry-preview', preview);
  }
  const result = generateGeometry(request, isCancelled, cache);
  if (!isCancelled()) publish('geometry-result', result);
}
