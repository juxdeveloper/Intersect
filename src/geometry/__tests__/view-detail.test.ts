import { describe, expect, it } from 'vitest';
import { autoGeometryBudget, visibleRenderRegion } from '../view-detail';
import { extractImplicitSurface } from '../marching-cubes';
import { GEOMETRY_BUDGET_PRESETS, type GeometryView } from '../../contracts/geometry';
import { parseCurveExpression } from '../../math/curve-parser';

const view = (distance: number, target = { x: 0, y: 0, z: 0 }): GeometryView => ({
  distance, target, verticalFov: 45, aspect: 1.6, viewportHeight: 800,
});

describe('Camera-driven geometry detail', () => {
  it('tightens visible cells and curve tolerance while retaining finite budgets', () => {
    const far = autoGeometryBudget(view(40));
    const near = autoGeometryBudget(view(4));
    expect(near.gridResolution).toBeGreaterThan(far.gridResolution);
    expect(visibleRenderRegion(view(4)).x.max).toBeLessThan(visibleRenderRegion(view(40)).x.max);
    expect(near.curveGeometricTolerance).toBeLessThanOrEqual(far.curveGeometricTolerance);
    expect(autoGeometryBudget(view(0.0001)).gridResolution).toBeLessThanOrEqual(192);
    expect(autoGeometryBudget(view(0.0001)).curveGeometricTolerance).toBeGreaterThan(0);
  });

  it('keeps fractional regions nondegenerate near the global navigation boundary', () => {
    const region = visibleRenderRegion(view(0.4, { x: 1000, y: -1000, z: 999.9 }));
    for (const axis of [region.x, region.y, region.z]) {
      expect(axis.min).toBeGreaterThanOrEqual(-1000);
      expect(axis.max).toBeLessThanOrEqual(1000);
      expect(axis.max).toBeGreaterThan(axis.min);
    }
  });

  it('reduces cylinder silhouette error at close zoom compared with the previous High', () => {
    const parsed = parseCurveExpression('x^2+y^2-4');
    if (!parsed.success) throw new Error('Cylinder fixture must parse');
    const residual = parsed.ast;
    const legacy = extractImplicitSurface(residual, [], {
      x: { min: -50, max: 50 }, y: { min: -50, max: 50 }, z: { min: -50, max: 50 },
    }, GEOMETRY_BUDGET_PRESETS.high);
    const camera = view(4);
    const refined = extractImplicitSurface(residual, [], visibleRenderRegion(camera), autoGeometryBudget(camera));
    const error = (positions: Float32Array) => {
      let maximum = 0;
      for (let i = 0; i < positions.length; i += 3) {
        maximum = Math.max(maximum, Math.abs(Math.hypot(positions[i]!, positions[i + 1]!) - 2));
      }
      return maximum;
    };
    expect(refined.status).toBe('success');
    expect(error(refined.positions)).toBeLessThan(error(legacy.positions) * 0.1);
  }, 30000);
});
