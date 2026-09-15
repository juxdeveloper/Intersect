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

/**
 * Traverses an expression tree and collects all symbolic domain obligations.
 */
export function collectDomainObligations(
  root: ExpressionNode,
  prefix: string = 'dom',
): DomainObligation[] {
  const obligations: DomainObligation[] = [];
  let counter = 1;

  function addObligation(kind: DomainObligationKind, target: ExpressionNode, description: string) {
    // Deduplicate against existing obligations with identical kind and target
    const alreadyExists = obligations.some(
      (existing) => existing.kind === kind && areExpressionsIdentical(existing.target, target),
    );
    if (alreadyExists) return;

    obligations.push({
      id: `${prefix}-${counter++}`,
      kind,
      target,
      description,
    });
  }

  function walk(node: ExpressionNode) {
    if (isOperatorNode(node)) {
      const { op, args } = node;

      if (op === 'Divide' && args.length >= 2) {
        const den = args[1]!;
        // Denominator cannot be zero
        addObligation(
          'nonzero-denominator',
          den,
          `Denominator must be non-zero: ${formatExpression(den)} ≠ 0`,
        );
      } else if (op === 'Sqrt' && args.length >= 1) {
        const radicand = args[0]!;
        addObligation(
          'nonnegative-radicand',
          radicand,
          `Square root argument must be non-negative: ${formatExpression(radicand)} ≥ 0`,
        );
      } else if (op === 'Root' && args.length >= 2) {
        const radicand = args[0]!;
        const order = args[1]!;
        if (isNumberNode(order) && Number.isInteger(order.value) && order.value % 2 === 0) {
          addObligation(
            'nonnegative-radicand',
            radicand,
            `Even root argument must be non-negative: ${formatExpression(radicand)} ≥ 0`,
          );
        }
      } else if (op === 'Power' && args.length >= 2) {
        const base = args[0]!;
        const exp = args[1]!;
        const { requiresNonNegativeBase, requiresNonZeroBase, requiresPositiveBase } =
          inspectPowerRestrictions(exp);

        if (requiresPositiveBase) {
          addObligation(
            'positive-base',
            base,
            `Variable power base must be strictly positive: ${formatExpression(base)} > 0`,
          );
        } else {
          if (requiresNonNegativeBase) {
            addObligation(
              'nonnegative-radicand',
              base,
              `Fractional power base must be non-negative: ${formatExpression(base)} ≥ 0`,
            );
          }
          if (requiresNonZeroBase) {
            addObligation(
              'nonzero-denominator',
              base,
              `Negative power base must be non-zero: ${formatExpression(base)} ≠ 0`,
            );
          }
        }
      } else if ((op === 'Ln' || op === 'Log') && args.length >= 1) {
        const arg = args[0]!;
        addObligation(
          'positive-argument',
          arg,
          `Logarithm argument must be strictly positive: ${formatExpression(arg)} > 0`,
        );
      } else if ((op === 'Tan' || op === 'Sec') && args.length >= 1) {
        const arg = args[0]!;
        addObligation(
          'nonzero-cosine',
          arg,
          `Domain requires cos(${formatExpression(arg)}) ≠ 0`,
        );
      } else if ((op === 'Cot' || op === 'Csc') && args.length >= 1) {
        const arg = args[0]!;
        addObligation(
          'nonzero-sine',
          arg,
          `Domain requires sin(${formatExpression(arg)}) ≠ 0`,
        );
      } else if ((op === 'ArcSin' || op === 'ArcCos') && args.length >= 1) {
        const arg = args[0]!;
        addObligation(
          'bounded-interval-closed',
          arg,
          `Domain requires -1 ≤ ${formatExpression(arg)} ≤ 1`,
        );
      }

      // Recurse into children
      for (const child of args) {
        walk(child);
      }
    } else if (isRelationNode(node)) {
      walk(node.lhs);
      walk(node.rhs);
    }
  }

  walk(root);
  return obligations;
}
