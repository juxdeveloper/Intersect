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

function evaluateOperator(
  op: string,
  args: readonly ExpressionNode[],
  env: EvalEnv,
): EvalOutcome {
  switch (op) {
    case 'Add': {
      let sum = 0;
      for (const arg of args) {
        const res = evaluateNode(arg, env);
        if (!res.valid) return res;
        sum += res.value;
      }
      return makeFiniteOutcome(sum);
    }

    case 'Subtract': {
      if (args.length === 1) {
        const arg0 = args[0];
        if (!arg0) return { valid: false, value: NaN, isPole: false, reason: 'unsupported_op' };
        const res = evaluateNode(arg0, env);
        if (!res.valid) return res;
        return { valid: true, value: -res.value };
      }
      if (args.length !== 2) {
        return { valid: false, value: NaN, isPole: false, reason: 'unsupported_op' };
      }
      const arg0 = args[0];
      const arg1 = args[1];
      if (!arg0 || !arg1) return { valid: false, value: NaN, isPole: false, reason: 'unsupported_op' };

      const a = evaluateNode(arg0, env);
      if (!a.valid) return a;
      const b = evaluateNode(arg1, env);
      if (!b.valid) return b;
      const diff = a.value - b.value;
      return makeFiniteOutcome(diff);
    }

    case 'Negate': {
      const arg0 = args[0];
      if (args.length !== 1 || !arg0) {
        return { valid: false, value: NaN, isPole: false, reason: 'unsupported_op' };
      }
      const a = evaluateNode(arg0, env);
      if (!a.valid) return a;
      return { valid: true, value: -a.value };
    }

    case 'Multiply': {
      let prod = 1;
      for (const arg of args) {
        const res = evaluateNode(arg, env);
        if (!res.valid) return res;
        prod *= res.value;
      }
      return makeFiniteOutcome(prod);
    }

    case 'Divide': {
      const arg0 = args[0];
      const arg1 = args[1];
      if (args.length !== 2 || !arg0 || !arg1) {
        return { valid: false, value: NaN, isPole: false, reason: 'unsupported_op' };
      }
      const num = evaluateNode(arg0, env);
      if (!num.valid) return num;
      const den = evaluateNode(arg1, env);
      if (!den.valid) return den;

      if (Math.abs(den.value) < EPSILON_ZERO) {
        return {
          valid: false,
          value: den.value >= 0 ? Infinity : -Infinity,
          isPole: true,
          reason: 'division_by_zero',
        };
      }
      const quotient = num.value / den.value;
      return makeFiniteOutcome(quotient);
    }

    case 'Power': {
      const arg0 = args[0];
      const arg1 = args[1];
      if (args.length !== 2 || !arg0 || !arg1) {
        return { valid: false, value: NaN, isPole: false, reason: 'unsupported_op' };
      }
      const baseRes = evaluateNode(arg0, env);
      if (!baseRes.valid) return baseRes;
      const expRes = evaluateNode(arg1, env);
      if (!expRes.valid) return expRes;

      const base = baseRes.value;
      const exp = expRes.value;

      if (Math.abs(base) < EPSILON_ZERO) {
        if (exp < -EPSILON_ZERO) {
          return {
            valid: false,
            value: Infinity,
            isPole: true,
            reason: 'division_by_zero',
          };
        }
        if (Math.abs(exp) < EPSILON_ZERO) {
          return { valid: true, value: 1 };
        }
        return { valid: true, value: 0 };
      }

      if (base > 0) {
        const val = Math.pow(base, exp);
        return makeFiniteOutcome(val);
      }

      // Negative base: check real root semantics
      const ratInfo = inspectRationalExponent(arg1);
      if (ratInfo) {
        const { p, q } = ratInfo;
        if (Math.abs(q) % 2 === 1) {
          // Odd root: real-valued!
          const positivePower = Math.pow(-base, p / q);
          const sign = Math.abs(p) % 2 === 1 ? -1 : 1;
          const val = sign * positivePower;
          return makeFiniteOutcome(val);
        }
      }

      // Integer exponent fallback
      if (Number.isInteger(exp)) {
        const val = Math.pow(base, exp);
        return makeFiniteOutcome(val);
      }

      // Even fractional or non-rational power of negative base -> complex/invalid in real domain
      return {
        valid: false,
        value: NaN,
        isPole: false,
        reason: 'negative_radicand',
      };
    }

    case 'Sqrt': {
      const arg0 = args[0];
      if (args.length !== 1 || !arg0) {
        return { valid: false, value: NaN, isPole: false, reason: 'unsupported_op' };
      }
      const a = evaluateNode(arg0, env);
      if (!a.valid) return a;
      if (a.value < -EPSILON_ZERO) {
        return {
          valid: false,
          value: NaN,
          isPole: false,
          reason: 'negative_radicand',
        };
      }
      const val = Math.sqrt(Math.max(0, a.value));
      return makeFiniteOutcome(val);
    }

    case 'Root': {
      const arg0 = args[0];
      const arg1 = args[1];
      if (args.length !== 2 || !arg0 || !arg1) {
        return { valid: false, value: NaN, isPole: false, reason: 'unsupported_op' };
      }
      const baseRes = evaluateNode(arg0, env);
      if (!baseRes.valid) return baseRes;
      const degRes = evaluateNode(arg1, env);
      if (!degRes.valid) return degRes;

      const base = baseRes.value;
      const deg = degRes.value;

      if (!Number.isInteger(deg) || deg === 0) {
        return { valid: false, value: NaN, isPole: false, reason: 'unsupported_op' };
      }

      if (base >= 0) {
        const val = Math.pow(base, 1 / deg);
        return makeFiniteOutcome(val);
      }

      // Negative base
      if (Math.abs(deg) % 2 === 1) {
        const val = -Math.pow(-base, 1 / deg);
        return makeFiniteOutcome(val);
      }

      return {
        valid: false,
        value: NaN,
        isPole: false,
        reason: 'negative_radicand',
      };
    }

    case 'Abs': {
      const arg0 = args[0];
      if (args.length !== 1 || !arg0) {
        return { valid: false, value: NaN, isPole: false, reason: 'unsupported_op' };
      }
      const a = evaluateNode(arg0, env);
      if (!a.valid) return a;
      return { valid: true, value: Math.abs(a.value) };
    }

    case 'Sin': {
      const arg0 = args[0];
      if (args.length !== 1 || !arg0) {
        return { valid: false, value: NaN, isPole: false, reason: 'unsupported_op' };
      }
      const a = evaluateNode(arg0, env);
      if (!a.valid) return a;
      return { valid: true, value: Math.sin(a.value) };
    }

    case 'Cos': {
      const arg0 = args[0];
      if (args.length !== 1 || !arg0) {
        return { valid: false, value: NaN, isPole: false, reason: 'unsupported_op' };
      }
      const a = evaluateNode(arg0, env);
      if (!a.valid) return a;
      return { valid: true, value: Math.cos(a.value) };
    }

    case 'Tan': {
      const arg0 = args[0];
      if (args.length !== 1 || !arg0) {
        return { valid: false, value: NaN, isPole: false, reason: 'unsupported_op' };
      }
      const a = evaluateNode(arg0, env);
      if (!a.valid) return a;
      const cosVal = Math.cos(a.value);
      if (Math.abs(cosVal) < EPSILON_ZERO) {
        return {
          valid: false,
          value: Math.sin(a.value) >= 0 ? Infinity : -Infinity,
          isPole: true,
          reason: 'trig_pole',
        };
      }
      const val = Math.tan(a.value);
      return makeFiniteOutcome(val);
    }

    case 'Sec': {
      const arg0 = args[0];
      if (args.length !== 1 || !arg0) {
        return { valid: false, value: NaN, isPole: false, reason: 'unsupported_op' };
      }
      const a = evaluateNode(arg0, env);
      if (!a.valid) return a;
      const cosVal = Math.cos(a.value);
      if (Math.abs(cosVal) < EPSILON_ZERO) {
        return {
          valid: false,
          value: cosVal >= 0 ? Infinity : -Infinity,
          isPole: true,
          reason: 'trig_pole',
        };
      }
      return { valid: true, value: 1 / cosVal };
    }

    case 'Csc': {
      const arg0 = args[0];
      if (args.length !== 1 || !arg0) {
        return { valid: false, value: NaN, isPole: false, reason: 'unsupported_op' };
      }
      const a = evaluateNode(arg0, env);
      if (!a.valid) return a;
      const sinVal = Math.sin(a.value);
      if (Math.abs(sinVal) < EPSILON_ZERO) {
        return {
          valid: false,
          value: sinVal >= 0 ? Infinity : -Infinity,
          isPole: true,
          reason: 'trig_pole',
        };
      }
      return { valid: true, value: 1 / sinVal };
    }

    case 'Cot': {
      const arg0 = args[0];
      if (args.length !== 1 || !arg0) {
        return { valid: false, value: NaN, isPole: false, reason: 'unsupported_op' };
      }
      const a = evaluateNode(arg0, env);
      if (!a.valid) return a;
      const sinVal = Math.sin(a.value);
      if (Math.abs(sinVal) < EPSILON_ZERO) {
        return {
          valid: false,
          value: sinVal >= 0 ? Infinity : -Infinity,
          isPole: true,
          reason: 'trig_pole',
        };
      }
      return { valid: true, value: Math.cos(a.value) / sinVal };
    }

    case 'ArcSin': {
      const arg0 = args[0];
      if (args.length !== 1 || !arg0) {
        return { valid: false, value: NaN, isPole: false, reason: 'unsupported_op' };
      }
      const a = evaluateNode(arg0, env);
      if (!a.valid) return a;
      if (Math.abs(a.value) > 1 + EPSILON_ZERO) {
        return {
          valid: false,
          value: NaN,
          isPole: false,
          reason: 'domain_violation',
        };
      }
      return { valid: true, value: Math.asin(Math.max(-1, Math.min(1, a.value))) };
    }

    case 'ArcCos': {
      const arg0 = args[0];
      if (args.length !== 1 || !arg0) {
        return { valid: false, value: NaN, isPole: false, reason: 'unsupported_op' };
      }
      const a = evaluateNode(arg0, env);
      if (!a.valid) return a;
      if (Math.abs(a.value) > 1 + EPSILON_ZERO) {
        return {
          valid: false,
          value: NaN,
          isPole: false,
          reason: 'domain_violation',
        };
      }
      return { valid: true, value: Math.acos(Math.max(-1, Math.min(1, a.value))) };
    }

    case 'ArcTan': {
      const arg0 = args[0];
      if (args.length !== 1 || !arg0) {
        return { valid: false, value: NaN, isPole: false, reason: 'unsupported_op' };
      }
      const a = evaluateNode(arg0, env);
      if (!a.valid) return a;
      return { valid: true, value: Math.atan(a.value) };
    }

    case 'Sinh': {
      const arg0 = args[0];
      if (args.length !== 1 || !arg0) {
        return { valid: false, value: NaN, isPole: false, reason: 'unsupported_op' };
      }
      const a = evaluateNode(arg0, env);
      if (!a.valid) return a;
      const val = Math.sinh(a.value);
      return makeFiniteOutcome(val);
    }

    case 'Cosh': {
      const arg0 = args[0];
      if (args.length !== 1 || !arg0) {
        return { valid: false, value: NaN, isPole: false, reason: 'unsupported_op' };
      }
      const a = evaluateNode(arg0, env);
      if (!a.valid) return a;
      const val = Math.cosh(a.value);
      return makeFiniteOutcome(val);
    }

    case 'Tanh': {
      const arg0 = args[0];
      if (args.length !== 1 || !arg0) {
        return { valid: false, value: NaN, isPole: false, reason: 'unsupported_op' };
      }
      const a = evaluateNode(arg0, env);
      if (!a.valid) return a;
      return { valid: true, value: Math.tanh(a.value) };
    }

    case 'Exp': {
      const arg0 = args[0];
      if (args.length !== 1 || !arg0) {
        return { valid: false, value: NaN, isPole: false, reason: 'unsupported_op' };
      }
      const a = evaluateNode(arg0, env);
      if (!a.valid) return a;
      const val = Math.exp(a.value);
      return makeFiniteOutcome(val);
    }

    case 'Ln':
    case 'Log': {
      const arg0 = args[0];
      if (args.length !== 1 || !arg0) {
        return { valid: false, value: NaN, isPole: false, reason: 'unsupported_op' };
      }
      const a = evaluateNode(arg0, env);
      if (!a.valid) return a;
      if (a.value <= EPSILON_ZERO) {
        return {
          valid: false,
          value: -Infinity,
          isPole: true,
          reason: 'log_nonpositive',
        };
      }
      const val = Math.log(a.value);
      return makeFiniteOutcome(val);
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

/**
 * Checks all real domain obligations (denominators != 0, radicands >= 0, etc.) at point env.
 */
export function verifyDomainObligations(
  obligations: readonly DomainObligation[],
  env: EvalEnv,
): { valid: boolean; failedObligation?: DomainObligation } {
  for (const ob of obligations) {
    const res = evaluateNode(ob.target, env);
    if (!res.valid) {
      return { valid: false, failedObligation: ob };
    }
    const val = res.value;

    switch (ob.kind) {
      case 'nonzero-denominator':
        if (Math.abs(val) < EPSILON_ZERO) {
          return { valid: false, failedObligation: ob };
        }
        break;
      case 'nonnegative-radicand':
        if (val < -EPSILON_ZERO) {
          return { valid: false, failedObligation: ob };
        }
        break;
      case 'positive-argument':
      case 'positive-base':
        if (val <= EPSILON_ZERO) {
          return { valid: false, failedObligation: ob };
        }
        break;
      case 'nonzero-cosine':
        if (Math.abs(Math.cos(val)) < EPSILON_ZERO) {
          return { valid: false, failedObligation: ob };
        }
        break;
      case 'nonzero-sine':
        if (Math.abs(Math.sin(val)) < EPSILON_ZERO) {
          return { valid: false, failedObligation: ob };
        }
        break;
      default:
        break;
    }
  }
  return { valid: true };
}

/**
 * Reduces pure repeated factors / even powers for implicit meshing.
 * e.g., (x)^2 = 0 or (x - y)^2 = 0 reduces to (x - y) = 0 for meshing,
 * which possesses standard sign changes, while retaining all original domain restrictions.
 */
export function reduceRepeatedFactorResidual(node: ExpressionNode): {
  meshingResidual: ExpressionNode;
  isReduced: boolean;
} {
  // Check if relation lhs = rhs with rhs = 0
  let expr = node;
  if (node.type === 'relation') {
    if (node.rhs.type === 'number' && Math.abs(node.rhs.value) < EPSILON_ZERO) {
      expr = node.lhs;
    }
  }

  // Check Power(base, 2k)
  if (expr.type === 'apply' && expr.op === 'Power' && expr.args.length === 2) {
    const baseNode = expr.args[0];
    const expNode = expr.args[1];
    if (
      baseNode &&
      expNode &&
      expNode.type === 'number' &&
      Number.isInteger(expNode.value) &&
      expNode.value > 0 &&
      expNode.value % 2 === 0
    ) {
      return { meshingResidual: baseNode, isReduced: true };
    }
  }

  // Check Abs(base)
  if (expr.type === 'apply' && expr.op === 'Abs' && expr.args.length === 1) {
    const baseNode = expr.args[0];
    if (baseNode) {
      return { meshingResidual: baseNode, isReduced: true };
    }
  }

  return { meshingResidual: node, isReduced: false };
}

/**
 * High-performance compiled evaluator closure for grid/batch point sampling.
 * Evaluates points in tight loops with cached domain obligation checks.
 */
export interface CompiledEvaluator {
  evaluate(x: number, y: number, z: number): EvalOutcome;
  evaluateT(t: number): EvalOutcome;
}

export function compileEvaluator(
  residualNode: ExpressionNode,
  domainObligations: readonly DomainObligation[] = [],
): CompiledEvaluator {
  const env: MutableEvalEnv = { x: 0, y: 0, z: 0, t: 0, u: 0 };

  return {
    evaluate(x: number, y: number, z: number): EvalOutcome {
      env.x = x;
      env.y = y;
      env.z = z;

      // 1. Check domain obligations
      if (domainObligations.length > 0) {
        const domCheck = verifyDomainObligations(domainObligations, env);
        if (!domCheck.valid) {
          return {
            valid: false,
            value: NaN,
            isPole: true,
            reason: 'domain_violation',
          };
        }
      }

      // 2. Evaluate residual
      return evaluateNode(residualNode, env);
    },

    evaluateT(t: number): EvalOutcome {
      env.t = t;
      env.u = t;

      if (domainObligations.length > 0) {
        const domCheck = verifyDomainObligations(domainObligations, env);
        if (!domCheck.valid) {
          return {
            valid: false,
            value: NaN,
            isPole: true,
            reason: 'domain_violation',
          };
        }
      }

      return evaluateNode(residualNode, env);
    },
  };
}
