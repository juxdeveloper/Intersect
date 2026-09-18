/**
 * Finite, allowlisted numerical expression evaluator for Intersect Phase V6.
 *
 * Implements strict real-valued evaluation over structured AST ExpressionNodes
 * without eval(), new Function(), or user code generation.
 *
 * Key Mathematical Semantics:
 * 1. REAL ROOT SEMANTICS:
 *    Odd roots of negative real numbers (e.g. (-8)^(1/3)) evaluate to real -2,
 *    matching the project-wide SymPy/Python builder contract.
 * 2. EXPLICIT DOMAIN OBLIGATIONS:
 *    Original denominator, radical, and logarithm restrictions are enforced
 *    even if the stored residual was algebraically simplified (e.g. x/x=1 retains x != 0).
 * 3. POLE & DISCONTINUITY DETECTION:
 *    Evaluator explicitly distinguishes poles (division by zero, tan(pi/2)) and domain exclusions
 *    from valid zero crossings.
 * 4. REPEATED-FACTOR REDUCTION:
 *    Identifies even powers (base^(2k)=0) and |base|=0, providing an odd-sign-changing
 *    reduced residual for marching cubes while retaining all original domain restrictions.
 */

import type { ExpressionNode, DomainObligation } from '../contracts/expressions';

export interface EvalEnv {
  readonly x?: number;
  readonly y?: number;
  readonly z?: number;
  readonly t?: number;
  readonly u?: number;
  readonly [symbol: string]: number | undefined;
}

export interface MutableEvalEnv {
  x?: number;
  y?: number;
  z?: number;
  t?: number;
  u?: number;
  [symbol: string]: number | undefined;
}

export type EvalOutcome =
  | { readonly valid: true; readonly value: number; readonly isPole?: false }
  | {
      readonly valid: false;
      readonly value: number; // NaN or +/-Infinity
      readonly isPole: boolean;
      readonly reason:
        | 'division_by_zero'
        | 'negative_radicand'
        | 'log_nonpositive'
        | 'trig_pole'
        | 'domain_violation'
        | 'non_finite'
        | 'unknown_symbol'
        | 'unsupported_op';
    };

const EPSILON_ZERO = 1e-12;

export function makeFiniteOutcome(val: number): EvalOutcome {
  if (Number.isFinite(val)) {
    return { valid: true, value: val };
  }
  return {
    valid: false,
    value: val,
    isPole: false,
    reason: 'non_finite',
  };
}

/**
 * Checks whether an exponent corresponds to an exact fraction with odd denominator.
 */
function inspectRationalExponent(node: ExpressionNode): {
  isRational: boolean;
  p: number;
  q: number;
} | null {
  if (node.type === 'number') {
    if (node.exactRational) {
      const p = Number(node.exactRational.num);
      const q = Number(node.exactRational.den);
      if (Number.isFinite(p) && Number.isFinite(q) && q !== 0) {
        return { isRational: true, p, q };
      }
    }
    // Check if integer
    if (Number.isInteger(node.value)) {
      return { isRational: true, p: node.value, q: 1 };
    }
  } else if (node.type === 'apply' && node.op === 'Divide' && node.args.length === 2) {
    const numNode = node.args[0];
    const denNode = node.args[1];
    if (
      numNode &&
      denNode &&
      numNode.type === 'number' &&
      denNode.type === 'number' &&
      Number.isInteger(numNode.value) &&
      Number.isInteger(denNode.value) &&
      denNode.value !== 0
    ) {
      return { isRational: true, p: numNode.value, q: denNode.value };
    }
  }
  return null;
}

/**
 * Evaluates an AST ExpressionNode at a single point with strict real-domain semantics.
 */
export function evaluateNode(node: ExpressionNode, env: EvalEnv): EvalOutcome {
  switch (node.type) {
    case 'number': {
      if (node.exactRational) {
        const val = Number(node.exactRational.num) / Number(node.exactRational.den);
        return makeFiniteOutcome(val);
      }
      return makeFiniteOutcome(node.value);
    }

    case 'symbol': {
      const sym = node.name.toLowerCase();
      if (sym === 'pi' || sym === 'π') {
        return { valid: true, value: Math.PI };
      }
      if (sym === 'e' || sym === 'exponentiale') {
        return { valid: true, value: Math.E };
      }
      const val = env[node.name] ?? env[sym];
      if (val === undefined || !Number.isFinite(val)) {
        return {
          valid: false,
          value: NaN,
          isPole: false,
          reason: 'unknown_symbol',
        };
      }
      return { valid: true, value: val };
    }

    case 'relation': {
      // Evaluate residual lhs - rhs
      const left = evaluateNode(node.lhs, env);
      if (!left.valid) return left;
      const right = evaluateNode(node.rhs, env);
      if (!right.valid) return right;
      const diff = left.value - right.value;
      return makeFiniteOutcome(diff);
    }

    case 'apply': {
      return evaluateOperator(node.op, node.args, env);
    }

    default:
      return {
        valid: false,
        value: NaN,
        isPole: false,
        reason: 'unsupported_op',
      };
  }
}