import { describe, it, expect } from 'vitest';
import {
  negateEndpoint,
  reverseInterval,
  reverseDomain,
  createTraversalMetadata,
} from '../reversal';
import {
  createFiniteEndpoint,
  createInfiniteEndpoint,
  createInterval,
  type ParameterDomain,
} from '../../contracts';

describe('V5 Domain Reversal and Traversal Mathematics', () => {
  describe('Endpoint Negation', () => {
    it('correctly negates signed infinities', () => {
      const posInf = createInfiniteEndpoint('+');
      const negInf = createInfiniteEndpoint('-');

      const negatedPos = negateEndpoint(posInf);
      expect(negatedPos.kind).toBe('infinite');
      if (negatedPos.kind === 'infinite') {
        expect(negatedPos.sign).toBe('-');
      }

      const negatedNeg = negateEndpoint(negInf);
      expect(negatedNeg.kind).toBe('infinite');
      if (negatedNeg.kind === 'infinite') {
        expect(negatedNeg.sign).toBe('+');
      }
    });

    it('correctly negates zero without producing negative zero', () => {
      const zero = createFiniteEndpoint('0', 0);
      const negZero = negateEndpoint(zero);
      expect(negZero.kind).toBe('finite');
      if (negZero.kind === 'finite') {
        expect(negZero.exact).toBe('0');
        expect(negZero.numericApprox).toBe(0);
      }
    });

    it('correctly negates simple numbers and symbolic constants', () => {
      const piVal = createFiniteEndpoint('2*pi', 2 * Math.PI);
      const negPi = negateEndpoint(piVal);
      expect(negPi.kind).toBe('finite');
      if (negPi.kind === 'finite') {
        expect(negPi.exact).toBe('-2*pi');
        expect(negPi.numericApprox).toBeCloseTo(-2 * Math.PI);
      }

      const negFive = createFiniteEndpoint('-5', -5);
      const posFive = negateEndpoint(negFive);
      expect(posFive.kind).toBe('finite');
      if (posFive.kind === 'finite') {
        expect(posFive.exact).toBe('5');
        expect(posFive.numericApprox).toBe(5);
      }
    });

    it('correctly wraps compound expressions when negating', () => {
      const expr = createFiniteEndpoint('sqrt(3) + 1');
      const neg = negateEndpoint(expr);
      expect(neg.kind).toBe('finite');
      if (neg.kind === 'finite') {
        expect(neg.exact).toBe('-(sqrt(3) + 1)');
      }
    });
  });

  describe('Interval Reversal Policies', () => {
    it('1. Finite closed interval: preserves endpoints under reflection and negates under uniform', () => {
      const closed = createInterval(
        createFiniteEndpoint('0', 0),
        true,
        createFiniteEndpoint('10', 10),
        true,
      );

      // Finite reflection: [0, 10] -> [0, 10]
      const reflected = reverseInterval(closed, 'finite_reflection');
      expect(reflected.minInclusive).toBe(true);
      expect(reflected.maxInclusive).toBe(true);
      if (reflected.min.kind === 'finite' && reflected.max.kind === 'finite') {
        expect(reflected.min.exact).toBe('0');
        expect(reflected.max.exact).toBe('10');
      }

      // Uniform negation: [0, 10] -> [-10, 0]
      const uniform = reverseInterval(closed, 'uniform_negation');
      expect(uniform.minInclusive).toBe(true);
      expect(uniform.maxInclusive).toBe(true);
      if (uniform.min.kind === 'finite' && uniform.max.kind === 'finite') {
        expect(uniform.min.exact).toBe('-10');
        expect(uniform.max.exact).toBe('0');
      }
    });

    it('2. Half-open and open intervals: correctly swaps inclusion flags', () => {
      // [a, b) -> (a, b] under finite reflection
      const halfOpenRight = createInterval(
        createFiniteEndpoint('0', 0),
        true,
        createFiniteEndpoint('2*pi', 2 * Math.PI),
        false,
      );

      const revHalfOpen = reverseInterval(halfOpenRight, 'finite_reflection');
      expect(revHalfOpen.minInclusive).toBe(false); // min is now open!
      expect(revHalfOpen.maxInclusive).toBe(true);  // max is now closed!
      if (revHalfOpen.min.kind === 'finite' && revHalfOpen.max.kind === 'finite') {
        expect(revHalfOpen.min.exact).toBe('0');
        expect(revHalfOpen.max.exact).toBe('2*pi');
      }

      // (a, b] -> [a, b) under finite reflection
      const halfOpenLeft = createInterval(
        createFiniteEndpoint('0', 0),
        false,
        createFiniteEndpoint('5', 5),
        true,
      );
      const revHalfOpenLeft = reverseInterval(halfOpenLeft, 'finite_reflection');
      expect(revHalfOpenLeft.minInclusive).toBe(true);
      expect(revHalfOpenLeft.maxInclusive).toBe(false);

      // (a, b) -> (a, b) under finite reflection
      const open = createInterval(
        createFiniteEndpoint('-1', -1),
        false,
        createFiniteEndpoint('1', 1),
        false,
      );
      const revOpen = reverseInterval(open, 'finite_reflection');
      expect(revOpen.minInclusive).toBe(false);
      expect(revOpen.maxInclusive).toBe(false);
    });

    it('3. Half-infinite interval and full real line: handles signed infinities cleanly', () => {
      // [0, +inf) -> (-inf, 0] under uniform negation
      const halfInf = createInterval(
        createFiniteEndpoint('0', 0),
        true,
        createInfiniteEndpoint('+'),
        false,
      );
      const revHalfInf = reverseInterval(halfInf, 'uniform_negation');
      expect(revHalfInf.min.kind).toBe('infinite');
      if (revHalfInf.min.kind === 'infinite') {
        expect(revHalfInf.min.sign).toBe('-');
      }
      expect(revHalfInf.minInclusive).toBe(false); // -inf is never inclusive
      expect(revHalfInf.maxInclusive).toBe(true);  // 0 is inclusive
      if (revHalfInf.max.kind === 'finite') {
        expect(revHalfInf.max.exact).toBe('0');
      }

      // (-inf, 5) -> (-5, +inf)
      const leftInf = createInterval(
        createInfiniteEndpoint('-'),
        false,
        createFiniteEndpoint('5', 5),
        false,
      );
      const revLeftInf = reverseInterval(leftInf, 'uniform_negation');
      expect(revLeftInf.minInclusive).toBe(false);
      expect(revLeftInf.maxInclusive).toBe(false);
      if (revLeftInf.min.kind === 'finite') {
        expect(revLeftInf.min.exact).toBe('-5');
      }
      expect(revLeftInf.max.kind).toBe('infinite');

      // (-inf, +inf) -> (-inf, +inf)
      const fullLine = createInterval(
        createInfiniteEndpoint('-'),
        false,
        createInfiniteEndpoint('+'),
        false,
      );
      const revFullLine = reverseInterval(fullLine, 'uniform_negation');
      expect(revFullLine.min.kind).toBe('infinite');
      expect(revFullLine.max.kind).toBe('infinite');
      expect(revFullLine.minInclusive).toBe(false);
      expect(revFullLine.maxInclusive).toBe(false);
    });
  });

  describe('Domain Reversal with Multiple Intervals and Holes', () => {
    it('4. Reverses interval ordering for unions to preserve directional traversal across gaps', () => {
      // Canonical domain with hole at 0: [-1000, -1] U [1, 1000]
      const domainWithHole: ParameterDomain = {
        intervals: [
          createInterval(
            createFiniteEndpoint('-1000', -1000),
            true,
            createFiniteEndpoint('-1', -1),
            true,
          ),
          createInterval(
            createFiniteEndpoint('1', 1),
            true,
            createFiniteEndpoint('1000', 1000),
            true,
          ),
        ],
      };

      const { domain: revDomain, policyUsed } = reverseDomain(domainWithHole);
      expect(policyUsed).toBe('uniform_negation');
      expect(revDomain.intervals.length).toBe(2);

      // In increasing reverse parameter u, the transformed first interval comes from the second original interval
      // [1, 1000] -> [-1000, -1]
      const first = revDomain.intervals[0]!;
      expect(first.min.kind).toBe('finite');
      expect(first.max.kind).toBe('finite');
      if (first.min.kind === 'finite' && first.max.kind === 'finite') {
        expect(first.min.exact).toBe('-1000');
        expect(first.max.exact).toBe('-1');
      }

      // [-1000, -1] -> [1, 1000]
      const second = revDomain.intervals[1]!;
      expect(second.min.kind).toBe('finite');
      expect(second.max.kind).toBe('finite');
      if (second.min.kind === 'finite' && second.max.kind === 'finite') {
        expect(second.min.exact).toBe('1');
        expect(second.max.exact).toBe('1000');
      }

      // Traversal gap between -1 and 1 is preserved and not bridged
      expect(first.maxInclusive).toBe(true);
      expect(second.minInclusive).toBe(true);
    });

    it('5. Periodic cylinder-plane example: [0, 2*pi) reflects to (0, 2*pi]', () => {
      const periodicDomain: ParameterDomain = {
        intervals: [
          createInterval(
            createFiniteEndpoint('0', 0),
            true,
            createFiniteEndpoint('2*pi', 2 * Math.PI),
            false,
          ),
        ],
      };

      const { domain: revDomain, policyUsed } = reverseDomain(periodicDomain, true);
      expect(policyUsed).toBe('finite_reflection');
      expect(revDomain.intervals.length).toBe(1);

      const inv = revDomain.intervals[0]!;
      expect(inv.minInclusive).toBe(false); // (0
      expect(inv.maxInclusive).toBe(true);  // 2*pi]
      if (inv.min.kind === 'finite' && inv.max.kind === 'finite') {
        expect(inv.min.exact).toBe('0');
        expect(inv.max.exact).toBe('2*pi');
      }
    });

    it('6. Repeated toggling Forward -> Reverse -> Forward restores canonical domain without drift', () => {
      const canonicalDomain: ParameterDomain = {
        intervals: [
          createInterval(
            createFiniteEndpoint('0', 0),
            true,
            createFiniteEndpoint('2*pi', 2 * Math.PI),
            false,
          ),
        ],
      };

      // 1st toggle: Forward -> Reverse
      const { domain: revDomain } = reverseDomain(canonicalDomain, true);
      // 2nd toggle: Reverse -> Forward (using finite reflection policy again)
      const { domain: restoredDomain } = reverseDomain(revDomain, true);

      expect(restoredDomain.intervals.length).toBe(1);
      const restored = restoredDomain.intervals[0]!;
      expect(restored.minInclusive).toBe(true);
      expect(restored.maxInclusive).toBe(false);
      if (restored.min.kind === 'finite' && restored.max.kind === 'finite') {
        expect(restored.min.exact).toBe('0');
        expect(restored.max.exact).toBe('2*pi');
      }
    });
  });

  describe('Traversal Metadata Contract', () => {
    it('creates accurate metadata for canonical forward curve', () => {
      const domain: ParameterDomain = {
        intervals: [
          createInterval(
            createFiniteEndpoint('0', 0),
            true,
            createFiniteEndpoint('2*pi', 2 * Math.PI),
            false,
          ),
        ],
      };

      const meta = createTraversalMetadata({
        orientation: 'forward',
        policyUsed: 'identity',
        domain,
        isClosed: true,
        isPeriodic: true,
        period: '2*pi',
      });

      expect(meta.orientation).toBe('forward');
      expect(meta.parameterMapping.type).toBe('identity');
      expect(meta.parameterMapping.formula).toBe('t = t');
      expect(meta.isClosed).toBe(true);
      expect(meta.isPeriodic).toBe(true);
      expect(meta.period).toBe('2*pi');
      expect(meta.segmentCount).toBe(1);
      expect(meta.disjointGapsPreserved).toBe(false);
    });

    it('creates accurate metadata for reversed curve with preserved gap warning', () => {
      const domain: ParameterDomain = {
        intervals: [
          createInterval(
            createFiniteEndpoint('-10', -10),
            true,
            createFiniteEndpoint('-1', -1),
            true,
          ),
          createInterval(
            createFiniteEndpoint('1', 1),
            true,
            createFiniteEndpoint('10', 10),
            true,
          ),
        ],
      };

      const meta = createTraversalMetadata({
        orientation: 'reverse',
        policyUsed: 'uniform_negation',
        domain,
        isClosed: false,
        isPeriodic: false,
      });

      expect(meta.orientation).toBe('reverse');
      expect(meta.parameterMapping.type).toBe('uniform_negation');
      expect(meta.parameterMapping.formula).toBe('t = -u');
      expect(meta.isClosed).toBe(false);
      expect(meta.segmentCount).toBe(2);
      expect(meta.disjointGapsPreserved).toBe(true);
    });
  });
});
