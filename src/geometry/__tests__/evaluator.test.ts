import { describe, it, expect } from 'vitest';
import {
  evaluateNode,
  compileEvaluator,
  reduceRepeatedFactorResidual,
} from '../evaluator';
import {
  createNumberNode,
  createSymbolNode,
  createOperatorNode,
  createRelationNode,
} from '../../math/ast';
import type { DomainObligation } from '../../contracts/expressions';

describe('Intersect V6 Allowlisted Numerical Evaluator', () => {
  it('evaluates basic arithmetic and rational numbers faithfully', () => {
    // 3 + 4 * 2 = 11
    const node = createOperatorNode('Add', [
      createNumberNode(3),
      createOperatorNode('Multiply', [createNumberNode(4), createNumberNode(2)]),
    ]);
    const res = evaluateNode(node, {});
    expect(res.valid).toBe(true);
    expect(res.value).toBe(11);
  });

  it('evaluates exact rationals without float drift', () => {
    const node = createNumberNode(0, '1/3', { num: '1', den: '3' });
    const res = evaluateNode(node, {});
    expect(res.valid).toBe(true);
    expect(res.value).toBeCloseTo(1 / 3, 10);
  });

  it('implements real root semantics for odd negative roots: (-8)^(1/3) == -2', () => {
    const node = createOperatorNode('Power', [
      createNumberNode(-8),
      createNumberNode(0, '1/3', { num: '1', den: '3' }),
    ]);
    const res = evaluateNode(node, {});
    expect(res.valid).toBe(true);
    expect(res.value).toBeCloseTo(-2, 10);
  });

  it('rejects even roots of negative numbers as invalid real domain', () => {
    // Sqrt(-4)
    const node = createOperatorNode('Sqrt', [createNumberNode(-4)]);
    const res = evaluateNode(node, {});
    expect(res.valid).toBe(false);
    if (!res.valid) {
      expect(res.reason).toBe('negative_radicand');
    }
  });

  it('detects division by zero as an explicit pole', () => {
    const node = createOperatorNode('Divide', [
      createNumberNode(1),
      createSymbolNode('x'),
    ]);
    const atZero = evaluateNode(node, { x: 0 });
    expect(atZero.valid).toBe(false);
    if (!atZero.valid) {
      expect(atZero.isPole).toBe(true);
      expect(atZero.reason).toBe('division_by_zero');
    }

    const atTwo = evaluateNode(node, { x: 2 });
    expect(atTwo.valid).toBe(true);
    expect(atTwo.value).toBe(0.5);
  });

  it('detects trig poles (tan(pi/2), sec(pi/2))', () => {
    const tanNode = createOperatorNode('Tan', [createNumberNode(Math.PI / 2)]);
    const res = evaluateNode(tanNode, {});
    expect(res.valid).toBe(false);
    if (!res.valid) {
      expect(res.isPole).toBe(true);
      expect(res.reason).toBe('trig_pole');
    }
  });

  it('detects nonpositive logarithm arguments as poles', () => {
    const logZero = createOperatorNode('Ln', [createNumberNode(0)]);
    const resZero = evaluateNode(logZero, {});
    expect(resZero.valid).toBe(false);
    if (!resZero.valid) {
      expect(resZero.isPole).toBe(true);
      expect(resZero.reason).toBe('log_nonpositive');
    }

    const logNeg = createOperatorNode('Ln', [createNumberNode(-5)]);
    const resNeg = evaluateNode(logNeg, {});
    expect(resNeg.valid).toBe(false);
  });

  it('enforces external domain obligations even if residual is simplified', () => {
    // residual: y - 1, but source obligation is x != 0
    const residual = createOperatorNode('Subtract', [createSymbolNode('y'), createNumberNode(1)]);
    const obligation: DomainObligation = {
      id: 'ob-1',
      kind: 'nonzero-denominator',
      target: createSymbolNode('x'),
      description: 'Denominator x != 0',
    };

    const compiled = compileEvaluator(residual, [obligation]);

    // At x = 2, y = 1 => valid, value = 0
    const validPt = compiled.evaluate(2, 1, 0);
    expect(validPt.valid).toBe(true);
    expect(validPt.value).toBe(0);

    // At x = 0, y = 1 => domain_violation!
    const excludedPt = compiled.evaluate(0, 1, 0);
    expect(excludedPt.valid).toBe(false);
    if (!excludedPt.valid) {
      expect(excludedPt.reason).toBe('domain_violation');
    }
  });

  it('reduces pure repeated factors: x^2 = 0 reduces to x = 0 for meshing', () => {
    const squaredRelation = createRelationNode(
      '=',
      createOperatorNode('Power', [createSymbolNode('x'), createNumberNode(2)]),
      createNumberNode(0),
    );
    const { meshingResidual, isReduced } = reduceRepeatedFactorResidual(squaredRelation);
    expect(isReduced).toBe(true);
    expect(meshingResidual).toEqual(createSymbolNode('x'));
  });
});
