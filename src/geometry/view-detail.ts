import type { WorldBounds } from '../contracts/bounds';
import { GEOMETRY_BUDGET_PRESETS, type GeometryBudget, type GeometryView } from '../contracts/geometry';

/** Keep a padded neighborhood of the camera target, including perspective depth. */
export function visibleRenderRegion(view: GeometryView): WorldBounds {
  const tangent = Math.tan(view.verticalFov * Math.PI / 360);
  const halfSpan = Math.max(0.25, Math.min(400,
    view.distance * (0.35 + tangent * Math.max(1, view.aspect)) * 1.1));
  const axis = (center: number) => ({
    min: Math.max(-1000, center - halfSpan),
    max: Math.min(1000, center + halfSpan),
  });
  return { x: axis(view.target.x), y: axis(view.target.y), z: axis(view.target.z) };
}

/** Refine after zoom, bounded independently of user input and screen resolution. */
export function autoGeometryBudget(view?: GeometryView): GeometryBudget {
  const base = GEOMETRY_BUDGET_PRESETS.auto;
  if (!view) return base;
  const zoom = Math.max(1, 40 / Math.max(0.1, view.distance));
  const screenBoost = Math.max(0, Math.log2(Math.max(1, view.viewportHeight / 800)));
  const level = Math.min(3, Math.floor(Math.log2(zoom) + screenBoost));
  const worldPerPixel = 2 * view.distance * Math.tan(view.verticalFov * Math.PI / 360)
    / Math.max(100, view.viewportHeight);
  return {
    ...base,
    gridResolution: Math.min(192, 144 + 16 * level),
    curveGeometricTolerance: Math.max(0.00001, Math.min(0.001, worldPerPixel * 0.25)),
  };
}
