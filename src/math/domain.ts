/**
 * Real-domain symbolic obligation collector for Intersect.
 *
 * Traverses expression trees to collect domain conditions (such as non-zero denominators,
 * non-negative radicands, and strictly positive logarithm arguments) preserving original restrictions
 * even under subsequent algebraic transformations.
 */

import type { ExpressionNode, DomainObligation, DomainObligationKind } from '../contracts/expressions';
import {
  isOperatorNode,
  isRelationNode,
  isNumberNode,
  formatExpression,
  areExpressionsIdentical,
} from './ast';

/**
 * Checks if a power exponent indicates a real-domain root or denominator restriction.
 */
function inspectPowerRestrictions(
  expNode: ExpressionNode,
): { requiresNonNegativeBase: boolean; requiresNonZeroBase: boolean; requiresPositiveBase: boolean } {
  if (isNumberNode(expNode)) {
    const val = expNode.value;
    const rat = expNode.exactRational;

    const isNegative = val < 0 || (rat !== undefined && rat.num.startsWith('-'));

    if (rat) {
      const denBig = BigInt(rat.den.replace('-', ''));
      const isEvenRoot = denBig % 2n === 0n;
      return {
        requiresNonNegativeBase: isEvenRoot,
        requiresNonZeroBase: isNegative,
        requiresPositiveBase: false,
      };
    }

    const isInteger = Number.isInteger(val);
    if (!isInteger) {
      // General floating decimal power e.g. 0.5
      return {
        requiresNonNegativeBase: true,
        requiresNonZeroBase: isNegative,
        requiresPositiveBase: false,
      };
    }

    return {
      requiresNonNegativeBase: false,
      requiresNonZeroBase: isNegative,
      requiresPositiveBase: false,
    };
  }

  // Non-constant variable exponent e.g. x^y
  return {
    requiresNonNegativeBase: false,
    requiresNonZeroBase: false,
    requiresPositiveBase: true,
  };
}