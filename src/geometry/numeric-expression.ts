import type { ExpressionNode } from '../contracts/expressions';
import type { EvalEnv } from './evaluator';

export const REAL_DOMAIN_EPSILON = 1e-12;
export type NumericExpression = (env: EvalEnv) => number;

/** Compile allowlisted AST nodes into closures, never executable input strings.
 * Invalid numeric paths return NaN and are diagnosed by the original interpreter.
 */
export function compileNumericExpression(
  node: ExpressionNode,
  cache?: (node: ExpressionNode, evaluate: NumericExpression) => NumericExpression,
): NumericExpression | null {
  const result = compileNode(node, cache);
  return result && cache ? cache(node, result) : result;
}

function compileNode(
  node: ExpressionNode,
  cache?: (node: ExpressionNode, evaluate: NumericExpression) => NumericExpression,
): NumericExpression | null {
  if (node.type === 'number') {
    const value = node.exactRational
      ? Number(node.exactRational.num) / Number(node.exactRational.den) : node.value;
    return () => Number.isFinite(value) ? value : NaN;
  }
  if (node.type === 'symbol') {
    const name = node.name, lower = name.toLowerCase();
    if (lower === 'pi' || lower === 'π') return () => Math.PI;
    if (lower === 'e' || lower === 'exponentiale') return () => Math.E;
    return (env) => env[name] ?? env[lower] ?? NaN;
  }
  if (node.type === 'relation') {
    const left = compileNumericExpression(node.lhs, cache), right = compileNumericExpression(node.rhs, cache);
    if (!left || !right) return null;
    return (env) => left(env) - right(env);
  }
  if (node.type !== 'apply') return null;
  const compiled = node.args.map((arg) => compileNumericExpression(arg, cache));
  if (compiled.some((arg) => !arg)) return null;
  const args = compiled as NumericExpression[];
  const a = args[0], b = args[1];
  const finite = (value: number) => Number.isFinite(value) ? value : NaN;
  const binary = (operation: (left: number, right: number) => number): NumericExpression | null => {
    if (args.length !== 2 || !a || !b) return null;
    return (env) => {
      const left = a(env), right = b(env);
      return Number.isFinite(left) && Number.isFinite(right) ? finite(operation(left, right)) : NaN;
    };
  };
  const unary = (operation: (value: number) => number): NumericExpression | null => {
    if (args.length !== 1 || !a) return null;
    return (env) => { const value = a(env); return Number.isFinite(value) ? finite(operation(value)) : NaN; };
  };
  switch (node.op) {
    case 'Add':
    case 'Multiply': {
      const multiply = node.op === 'Multiply';
      if (args.length === 2) return binary(multiply ? (x, y) => x * y : (x, y) => 0 + x + y);
      return (env) => {
        let value = multiply ? 1 : 0;
        for (const arg of args) {
          const next = arg(env);
          if (!Number.isFinite(next)) return NaN;
          value = multiply ? value * next : value + next;
        }
        return finite(value);
      };
    }
    case 'Subtract': return args.length === 1 ? unary((x) => -x) : binary((x, y) => x - y);
    case 'Negate': return unary((x) => -x);
    case 'Divide': return binary((x, y) => Math.abs(y) < REAL_DOMAIN_EPSILON ? NaN : x / y);
    case 'Power': {
      const exponent = node.args[1];
      let rational: { p: number; q: number } | null = null;
      if (exponent?.type === 'number') {
        if (exponent.exactRational) rational = { p: Number(exponent.exactRational.num), q: Number(exponent.exactRational.den) };
        else if (Number.isInteger(exponent.value)) rational = { p: exponent.value, q: 1 };
      } else if (exponent?.type === 'apply' && exponent.op === 'Divide' && exponent.args.length === 2) {
        const numerator = exponent.args[0], denominator = exponent.args[1];
        if (numerator?.type === 'number' && denominator?.type === 'number'
          && Number.isInteger(numerator.value) && Number.isInteger(denominator.value)
          && denominator.value !== 0) rational = { p: numerator.value, q: denominator.value };
      }
      if (rational && (!Number.isFinite(rational.p) || !Number.isFinite(rational.q) || rational.q === 0)) rational = null;
      return binary((base, power) => {
        if (Math.abs(base) < REAL_DOMAIN_EPSILON) {
          if (power < -REAL_DOMAIN_EPSILON) return NaN;
          return Math.abs(power) < REAL_DOMAIN_EPSILON ? 1 : 0;
        }
        if (base > 0) return Math.pow(base, power);
        if (rational && Math.abs(rational.q) % 2 === 1) {
          return (Math.abs(rational.p) % 2 === 1 ? -1 : 1) * Math.pow(-base, rational.p / rational.q);
        }
        return Number.isInteger(power) ? Math.pow(base, power) : NaN;
      });
    }
    case 'Root': return binary((base, degree) => {
      if (!Number.isInteger(degree) || degree === 0) return NaN;
      if (base >= 0) return Math.pow(base, 1 / degree);
      return Math.abs(degree) % 2 === 1 ? -Math.pow(-base, 1 / degree) : NaN;
    });
    case 'Sqrt': return unary((x) => x < -REAL_DOMAIN_EPSILON ? NaN : Math.sqrt(Math.max(0, x)));
    case 'Abs': return unary(Math.abs);
    case 'Sin': return unary(Math.sin);
    case 'Cos': return unary(Math.cos);
    case 'Tan': return unary((x) => Math.abs(Math.cos(x)) < REAL_DOMAIN_EPSILON ? NaN : Math.tan(x));
    case 'Sec': return unary((x) => Math.abs(Math.cos(x)) < REAL_DOMAIN_EPSILON ? NaN : 1 / Math.cos(x));
    case 'Csc': return unary((x) => Math.abs(Math.sin(x)) < REAL_DOMAIN_EPSILON ? NaN : 1 / Math.sin(x));
    case 'Cot': return unary((x) => Math.abs(Math.sin(x)) < REAL_DOMAIN_EPSILON ? NaN : Math.cos(x) / Math.sin(x));
    case 'ArcSin': return unary((x) => Math.abs(x) > 1 + REAL_DOMAIN_EPSILON ? NaN : Math.asin(Math.max(-1, Math.min(1, x))));
    case 'ArcCos': return unary((x) => Math.abs(x) > 1 + REAL_DOMAIN_EPSILON ? NaN : Math.acos(Math.max(-1, Math.min(1, x))));
    case 'ArcTan': return unary(Math.atan);
    case 'Sinh': return unary(Math.sinh);
    case 'Cosh': return unary(Math.cosh);
    case 'Tanh': return unary(Math.tanh);
    case 'Exp': return unary(Math.exp);
    case 'Ln':
    case 'Log': return unary((x) => x <= REAL_DOMAIN_EPSILON ? NaN : Math.log(x));
    default: return null;
  }
}

/** Include source obligations: an excluded coordinate still affects valid sampling. */
export function expressionDependencies(nodes: readonly ExpressionNode[]): ReadonlySet<string> {
  const result = new Set<string>();
  const visit = (node: ExpressionNode) => {
    if (node.type === 'symbol') result.add(node.name.toLowerCase());
    else if (node.type === 'relation') { visit(node.lhs); visit(node.rhs); }
    else if (node.type === 'apply') node.args.forEach(visit);
    else if (node.type === 'mathjson') for (const axis of ['x', 'y', 'z']) result.add(axis);
  };
  nodes.forEach(visit);
  return result;
}
