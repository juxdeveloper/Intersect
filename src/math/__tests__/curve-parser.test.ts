import { describe, it, expect } from 'vitest';
import { parseCurveExpression } from '../curve-parser';
import { compileEvaluator } from '../../geometry/evaluator';

describe('Intersect V11 Lightweight Curve Expression Parser', () => {
  it('parses basic polynomial and monomial expressions', () => {
    const res = parseCurveExpression('t^2 + 3*t - 5', 't');
    if (!res.success) console.error(res.error);
    expect(res.success).toBe(true);
    if (!res.success) return;

    const fn = compileEvaluator(res.ast);
    // t = 2 => 4 + 6 - 5 = 5
    expect(fn.evaluateT(2).value).toBe(5);
  });

  it('parses trigonometric and circular curves', () => {
    const resX = parseCurveExpression('2*cos(t)', 't');
    const resY = parseCurveExpression('2*sin(t)', 't');
    expect(resX.success).toBe(true);
    expect(resY.success).toBe(true);
    if (!resX.success || !resY.success) return;

    const fnX = compileEvaluator(resX.ast);
    const fnY = compileEvaluator(resY.ast);

    // At t = 0: x = 2, y = 0
    expect(fnX.evaluateT(0).value).toBeCloseTo(2, 6);
    expect(fnY.evaluateT(0).value).toBeCloseTo(0, 6);

    // At t = pi/2: x = 0, y = 2
    expect(fnX.evaluateT(Math.PI / 2).value).toBeCloseTo(0, 6);
    expect(fnY.evaluateT(Math.PI / 2).value).toBeCloseTo(2, 6);
  });

  it('supports implicit multiplication syntax (2 cos t, 2t, 3(t+1))', () => {
    const res1 = parseCurveExpression('2 cos t', 't');
    expect(res1.success).toBe(true);
    if (res1.success) {
      const fn1 = compileEvaluator(res1.ast);
      expect(fn1.evaluateT(0).value).toBeCloseTo(2, 6);
    }

    const res2 = parseCurveExpression('2t + 1', 't');
    expect(res2.success).toBe(true);
    if (res2.success) {
      const fn2 = compileEvaluator(res2.ast);
      expect(fn2.evaluateT(3).value).toBe(7);
    }

    const res3 = parseCurveExpression('3(t + 2)', 't');
    expect(res3.success).toBe(true);
    if (res3.success) {
      const fn3 = compileEvaluator(res3.ast);
      expect(fn3.evaluateT(2).value).toBe(12);
    }
  });

  it('parses composite expressions with pi, sqrt, and fractions', () => {
    const res = parseCurveExpression('3*sqrt(2)*cos(t + pi/4)', 't');
    if (!res.success) console.error('composite error:', res.error);
    expect(res.success).toBe(true);
    if (!res.success) return;

    const fn = compileEvaluator(res.ast);
    // At t = 0: 3*sqrt(2)*cos(pi/4) = 3*sqrt(2)*(1/sqrt(2)) = 3
    expect(fn.evaluateT(0).value).toBeCloseTo(3, 5);
  });

  it('parses rational expressions and detects poles correctly', () => {
    const res = parseCurveExpression('1/t', 't');
    expect(res.success).toBe(true);
    if (!res.success) return;

    const fn = compileEvaluator(res.ast);
    expect(fn.evaluateT(2).value).toBeCloseTo(0.5, 6);
    expect(fn.evaluateT(0).valid).toBe(false);
  });

  it('parses python-style power notation t**2', () => {
    const res = parseCurveExpression('t**3 - 4*t**2 + 2', 't');
    expect(res.success).toBe(true);
    if (!res.success) return;

    const fn = compileEvaluator(res.ast);
    // t = 2 => 8 - 16 + 2 = -6
    expect(fn.evaluateT(2).value).toBe(-6);
  });

  it('handles negative unary prefix and fractions', () => {
    const res = parseCurveExpression('-3*sin(t)', 't');
    if (!res.success) console.error('negative prefix error:', res.error);
    expect(res.success).toBe(true);
    if (!res.success) return;

    const fn = compileEvaluator(res.ast);
    expect(fn.evaluateT(Math.PI / 2).value).toBeCloseTo(-3, 6);
  });
});
