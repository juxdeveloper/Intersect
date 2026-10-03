import { describe, expect, it } from 'vitest';
import { compileEvaluator, evaluateNode } from '../evaluator';
import { compileGridEvaluator } from '../grid-evaluator';
import { createNumberNode as n, createSymbolNode as s, createOperatorNode as op } from '../../math/ast';
import type { ExpressionNode, DomainObligation } from '../../contracts/expressions';

describe('Optimized evaluation preserves interpreter semantics', () => {
  const unary = ['Negate', 'Sqrt', 'Abs', 'Sin', 'Cos', 'Tan', 'Sec', 'Csc', 'Cot',
    'ArcSin', 'ArcCos', 'ArcTan', 'Sinh', 'Cosh', 'Tanh', 'Exp', 'Ln', 'Log'];
  const values = [-Infinity, -1e308, -1000, -8, -Math.PI / 2, -1 - 2e-12, -1 - 5e-13,
    -1, -1e-12, -5e-13, -0, 0, 5e-13, 1e-12, 1, 1 + 5e-13, 1 + 2e-12,
    Math.PI / 2, 8, 1000, 1e308, Infinity, NaN];

  for (const name of unary) it(`preserves ${name} at real-domain and overflow boundaries`, () => {
    const node = op(name, [s('x')]);
    const compiled = compileEvaluator(node);
    for (const x of values) expect(compiled.evaluate(x, 0, 0)).toEqual(evaluateNode(node, { x, y: 0, z: 0, t: 0, u: 0 }));
  });

  it('preserves arithmetic order, signed zero, exact roots, invalid arity, and diagnostics', () => {
    const nodes: ExpressionNode[] = [
      ...['Add', 'Subtract', 'Multiply', 'Divide', 'Root'].map((name) => op(name, [s('x'), s('y')])),
      op('Add', []), op('Multiply', []), op('Subtract', [s('x')]), op('Sin', []),
      op('Power', [s('x'), n(0, '1/3', { num: '1', den: '3' })]),
      op('Power', [s('x'), op('Divide', [n(1), n(3)])]),
      op('Power', [s('x'), op('Divide', [n(0.5), n(3)])]),
      op('Power', [s('x'), s('y')]), op('Unknown', [s('x')]), s('missing'),
      op('Add', [n(1e308), s('x'), n(-1e308), s('y')]),
      { type: 'relation', relation: '=', lhs: s('x'), rhs: s('y') },
      { type: 'mathjson', data: ['Sin', 'x'] },
    ];
    for (const node of nodes) {
      const compiled = compileEvaluator(node);
      for (const x of values) for (const y of [-3, -0, 0, 3, 1e308]) {
        expect(compiled.evaluate(x, y, 0)).toEqual(evaluateNode(node, { x, y, z: 0, t: 0, u: 0 }));
      }
    }
  });

  it('preserves parameter aliases and source obligations on otherwise unused coordinates', () => {
    const node = op('Add', [s('t'), s('u')]);
    for (const t of values) expect(compileEvaluator(node).evaluateT(t)).toEqual(evaluateNode(node, { x: 0, y: 0, z: 0, t, u: t }));
    const obligations: DomainObligation[] = [{ id: 'source-denominator', kind: 'nonzero-denominator',
      target: s('z'), description: 'Retain the original denominator exclusion.' }];
    const compiled = compileEvaluator(s('x'), obligations);
    expect([...compiled.dependencies].sort()).toEqual(['x', 'z']);
    expect(compiled.evaluateNumeric).toBeUndefined();
    expect(compiled.evaluate(1, 0, 0)).toMatchObject({ valid: false, isPole: true, reason: 'domain_violation' });
    expect(compiled.evaluate(1, 0, 2)).toEqual({ valid: true, value: 1 });
  });

  it('caches one/two-axis subtrees without changing coordinate arithmetic or values', () => {
    const bounds = { x: { min: -8.13241, max: 7.38492 }, y: { min: -4.723, max: 6.284 }, z: { min: -3.38, max: 2.11 } };
    const resolution = 19;
    const nodes = [
      op('Subtract', [s('z'), op('Add', [s('x'), s('y')])]),
      op('Add', [op('Power', [s('x'), n(2)]), op('Power', [s('y'), n(2)]), op('Power', [s('z'), n(2)])]),
      op('Subtract', [op('Sin', [op('Multiply', [s('x'), s('z')])]), op('Cos', [op('Add', [s('y'), s('z')])])]),
      op('Divide', [s('y'), op('Subtract', [s('x'), s('z')])]),
    ];
    for (const node of nodes) {
      const cached = compileGridEvaluator(node, bounds, resolution)!;
      for (let i = resolution; i >= 0; i--) for (let j = 0; j <= resolution; j++) for (let k = 0; k <= resolution; k += 2) {
        const env = { x: bounds.x.min + i * ((bounds.x.max - bounds.x.min) / resolution),
          y: bounds.y.min + j * ((bounds.y.max - bounds.y.min) / resolution),
          z: bounds.z.min + k * ((bounds.z.max - bounds.z.min) / resolution) };
        const expected = evaluateNode(node, env);
        if (expected.valid) expect(cached(i, j, k)).toBe(expected.value);
        else expect(Number.isFinite(cached(i, j, k))).toBe(false);
      }
    }
  });
});
