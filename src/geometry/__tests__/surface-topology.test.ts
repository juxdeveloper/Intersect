import { describe, expect, it } from 'vitest';
import { parseCurveExpression } from '../../math/curve-parser';
import { extractImplicitSurface } from '../marching-cubes';
import { GEOMETRY_BUDGET_PRESETS } from '../../contracts/geometry';
import { EDGE_VERTICES, getEdgeMask, getTriangles } from '../marching-cubes-tables';

function mesh(expression: string) {
  const parsed = parseCurveExpression(expression);
  if (!parsed.success) throw new Error('Fixture must parse');
  return extractImplicitSurface(parsed.ast, [], {
    x: { min: -2.8, max: 2.8 }, y: { min: -2.8, max: 2.8 }, z: { min: -2.8, max: 2.8 },
  }, { ...GEOMETRY_BUDGET_PRESETS.auto, gridResolution: 24 });
}

describe('Refined surface integrity', () => {
  it('covers exactly the sign-changing edges in every one of the 256 cell configurations', () => {
    for (let configuration = 0; configuration < 256; configuration++) {
      const cuts = EDGE_VERTICES.flatMap(([a, b], edge) =>
        Boolean(configuration & (1 << a)) !== Boolean(configuration & (1 << b)) ? [edge] : []);
      const expectedMask = cuts.reduce((mask, edge) => mask | (1 << edge), 0);
      expect(getEdgeMask(configuration), `Edge mask for case ${configuration}`).toBe(expectedMask);
      const triangles = getTriangles(configuration);
      expect(triangles.length % 3).toBe(0);
      expect([...new Set(triangles)].sort((a, b) => a - b), `Triangle coverage for case ${configuration}`).toEqual(cuts);
    }
  });
  it('keeps every internal cylinder edge connected to exactly two faces', () => {
    const cylinder = mesh('x^2+y^2-4');
    const edges = new Map<string, { a: number; b: number; count: number }>();
    const id = (index: number) => Array.from(cylinder.positions.slice(index * 3, index * 3 + 3))
      .map((value) => value.toFixed(5)).join(',');
    for (let i = 0; i < cylinder.indices.length; i += 3) {
      for (let edge = 0; edge < 3; edge++) {
        const a = cylinder.indices[i + edge]!, b = cylinder.indices[i + (edge + 1) % 3]!;
        const key = [id(a), id(b)].sort().join('|');
        const record = edges.get(key) ?? { a, b, count: 0 };
        record.count++;
        edges.set(key, record);
      }
    }
    const open = [...edges.values()].filter(({ a, b, count }) => count !== 2
      && Math.abs(cylinder.positions[a * 3 + 2]!) < 2.79 && Math.abs(cylinder.positions[b * 3 + 2]!) < 2.79);
    expect(open, 'Internal edges expose holes or overlapping triangles').toHaveLength(0);
  });
});
