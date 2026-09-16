/**
 * Mathematical input parser for Intersect using MathLive Compute Engine.
 *
 * Design constraints:
 * - Uses Compute Engine to parse LaTeX and math strings into structured MathJSON expressions.
 * - Parses with form: 'raw' and parseNumbers: 'rational' to PRESERVE source structure,
 *   exact decimal rationals, and domain restrictions without premature algebraic simplification
 *   (e.g. x/x is not cancelled to 1; 0*x is not simplified to 0).
 * - Enforces conservative length and AST complexity bounds.
 * - Detects incomplete placeholders, syntax errors, and unsupported notation.
 */

import { ComputeEngine } from '@cortex-js/compute-engine';
import type {
  ExpressionNode,
  EquationDiagnostic,
  DiagnosticReasonCode,
} from '../contracts/expressions';
import {
  createNumberNode,
  createSymbolNode,
  createOperatorNode,
  createRelationNode,
  measureTreeDepth,
  countNodes,
} from './ast';
import { simplifyFraction, type ExactRational } from './rational';
import { checkInputSize, MAX_TREE_DEPTH, MAX_NODE_COUNT } from './limits';

// Singleton ComputeEngine instance
const ce = new ComputeEngine();

export interface ParseResultSuccess {
  readonly success: true;
  readonly ast: ExpressionNode;
  readonly rawInput: string;
}

export interface ParseResultFailure {
  readonly success: false;
  readonly diagnostic: EquationDiagnostic;
}

export type ParseResult = ParseResultSuccess | ParseResultFailure;

/**
 * Extracts exact integer numerator and denominator strings from a MathJSON number representation.
 */
function extractExactRationalFromMathJson(json: unknown): ExactRational | null {
  if (typeof json === 'number') {
    if (!Number.isFinite(json)) return null;
    return simplifyFraction(json.toString(), '1');
  }

  if (typeof json === 'string') {
    const num = Number(json);
    if (!Number.isFinite(num)) return null;
    return simplifyFraction(json, '1');
  }

  if (json && typeof json === 'object') {
    if ('num' in (json as Record<string, unknown>)) {
      const numStr = String((json as Record<string, unknown>).num);
      return simplifyFraction(numStr, '1');
    }

    if (Array.isArray(json)) {
      const op = json[0];
      if (op === 'Rational' && json.length >= 3) {
        const n = extractExactRationalFromMathJson(json[1]);
        const d = extractExactRationalFromMathJson(json[2]);
        if (n && d && d.num !== '0') {
          // n.num/n.den / (d.num/d.den) = (n.num * d.den) / (n.den * d.num)
          const finalNum = (BigInt(n.num) * BigInt(d.den)).toString();
          const finalDen = (BigInt(n.den) * BigInt(d.num)).toString();
          return simplifyFraction(finalNum, finalDen);
        }
      }

      if (op === 'Negate' && json.length === 2) {
        const inner = extractExactRationalFromMathJson(json[1]);
        if (inner) {
          const isNeg = inner.num.startsWith('-');
          const negatedNum = isNeg ? inner.num.slice(1) : `-${inner.num}`;
          return { num: negatedNum, den: inner.den };
        }
      }
    }
  }

  return null;
}

/**
 * Normalizes recognized constants and variable symbols.
 */
function normalizeSymbolName(
  rawName: string,
  allowedParam?: string,
): {
  normalized: string;
  isConstant: boolean;
  isReserved: boolean;
  isValid: boolean;
} {
  const lower = rawName.toLowerCase();

  if (rawName === 'pi' || rawName === 'Pi' || lower === 'pi') {
    return { normalized: 'pi', isConstant: true, isReserved: false, isValid: true };
  }

  if (
    rawName === 'e' ||
    rawName === 'E' ||
    rawName === 'ExponentialE' ||
    rawName === 'exponentiale'
  ) {
    return { normalized: 'e', isConstant: true, isReserved: false, isValid: true };
  }

  if (
    allowedParam &&
    (rawName === allowedParam || lower === allowedParam.toLowerCase())
  ) {
    return { normalized: allowedParam, isConstant: false, isReserved: false, isValid: true };
  }

  if (rawName === 'x' || rawName === 'y' || rawName === 'z') {
    return { normalized: rawName, isConstant: false, isReserved: false, isValid: true };
  }

  if (rawName === 't' && !allowedParam) {
    return { normalized: 't', isConstant: false, isReserved: true, isValid: false };
  }

  return { normalized: rawName, isConstant: false, isReserved: false, isValid: false };
}

/**
 * Maps allowlisted MathJSON operators to our project's standardized operator names.
 */
const ALLOWED_OPERATORS: Record<string, string> = {
  Add: 'Add',
  Subtract: 'Subtract',
  Negate: 'Negate',
  Multiply: 'Multiply',
  InvisibleOperator: 'Multiply',
  Divide: 'Divide',
  Power: 'Power',
  Sqrt: 'Sqrt',
  Root: 'Root',
  Abs: 'Abs',
  Sin: 'Sin',
  Cos: 'Cos',
  Tan: 'Tan',
  Sec: 'Sec',
  Csc: 'Csc',
  Cot: 'Cot',
  Arcsin: 'ArcSin',
  Arccos: 'ArcCos',
  Arctan: 'ArcTan',
  Sinh: 'Sinh',
  Cosh: 'Cosh',
  Tanh: 'Tanh',
  Exp: 'Exp',
  Ln: 'Ln',
  Log: 'Ln', // Default 1-arg log is natural log
};

export interface ParseMathInputOptions {
  readonly allowedParam?: string;
}

/**
 * Parses user input LaTeX or math notation into an ExpressionNode AST.
 */
export function parseMathInput(
  rawInput: string,
  surface: 'surfaceF' | 'surfaceG',
  options?: ParseMathInputOptions,
): ParseResult {
  // 1. Initial size checks
  const sizeError = checkInputSize(rawInput, surface);
  if (sizeError) {
    return { success: false, diagnostic: sizeError };
  }

  // 2. Parse with ComputeEngine using 'raw' form and 'rational' numbers to avoid canonical loss
  let boxedExpr;
  try {
    boxedExpr = ce.parse(rawInput, {
      form: 'raw',
      parseNumbers: 'rational',
      strict: false,
    });
  } catch (err) {
    return {
      success: false,
      diagnostic: {
        surface,
        reasonCode: 'internal_adapter_error',
        message: `Parser internal error: ${err instanceof Error ? err.message : String(err)}`,
        rawInput,
      },
    };
  }

  // 3. Inspect parser diagnostics and error nodes
  if (boxedExpr.errors && boxedExpr.errors.length > 0) {
    const firstErr = boxedExpr.errors[0];
    const sourceOffsets = firstErr?.sourceOffsets
      ? ([firstErr.sourceOffsets[0], firstErr.sourceOffsets[1]] as const)
      : undefined;

    // Check error kind
    const errJson = firstErr?.json;
    let reasonCode: DiagnosticReasonCode = 'parse_error';
    let message = 'Could not parse mathematical expression.';

    if (Array.isArray(errJson) && errJson.length > 1) {
      const code = String(errJson[1]).replace(/'/g, '');
      if (code === 'missing') {
        reasonCode = 'incomplete_placeholder';
        message = 'Incomplete mathematical expression (missing argument, exponent, or operand).';
      } else if (code === 'unexpected-operator') {
        reasonCode = 'parse_error';
        message = 'Syntax error: unexpected operator or missing operand.';
      } else if (code === 'unexpected-command') {
        reasonCode = 'unsupported_function';
        message = 'Unsupported LaTeX command or unrecognized function.';
      }
    }

    return {
      success: false,
      diagnostic: {
        surface,
        reasonCode,
        message,
        rawInput,
        sourceOffsets,
      },
    };
  }

  const rawJson = boxedExpr.json;
  if (rawJson === 'Nothing' || rawJson === null || rawJson === undefined) {
    return {
      success: false,
      diagnostic: {
        surface,
        reasonCode: 'empty_input',
        message: `${surface === 'surfaceF' ? 'Surface F' : 'Surface G'} equation cannot be empty.`,
        rawInput,
      },
    };
  }

  // 4. Recursive conversion from MathJSON to project ExpressionNode AST
  function convertNode(json: unknown): { node?: ExpressionNode; diagnostic?: EquationDiagnostic } {
    // A. Check for error nodes embedded in tree
    if (Array.isArray(json) && json[0] === 'Error') {
      const code = json[1] ? String(json[1]).replace(/'/g, '') : '';
      let reasonCode: DiagnosticReasonCode = 'parse_error';
      let message = 'Syntax error in mathematical input.';
      if (code === 'missing') {
        reasonCode = 'incomplete_placeholder';
        message = 'Incomplete mathematical expression (missing operand or argument).';
      } else if (code === 'unexpected-command') {
        reasonCode = 'unsupported_function';
        message = 'Unsupported LaTeX command or function.';
      }
      return {
        diagnostic: {
          surface,
          reasonCode,
          message,
          rawInput,
        },
      };
    }

    // B. Numbers and exact rationals
    const rational = extractExactRationalFromMathJson(json);
    if (rational !== null) {
      const numVal = Number(rational.num) / Number(rational.den);
      const exactText =
        rational.den === '1' ? rational.num : `${rational.num}/${rational.den}`;
      return { node: createNumberNode(numVal, exactText, rational) };
    }

    // C. Symbols
    if (typeof json === 'string') {
      const { normalized, isConstant, isReserved, isValid } = normalizeSymbolName(
        json,
        options?.allowedParam,
      );
      if (isReserved) {
        return {
          diagnostic: {
            surface,
            reasonCode: 'reserved_symbol',
            message: `Symbol 't' is reserved for curve parameterization in future phases. Surface equations must be defined in real variables x, y, z.`,
            rawInput,
          },
        };
      }
      if (!isValid) {
        return {
          diagnostic: {
            surface,
            reasonCode: 'unknown_symbol',
            message: `Unknown symbol or unresolved parameter '${json}'. Valid surface variables are x, y, z and constants pi, e.`,
            rawInput,
          },
        };
      }
      return { node: createSymbolNode(normalized, isConstant) };
    }

    // D. Function application / compound operators
    if (Array.isArray(json)) {
      if (json.length === 0) {
        return {
          diagnostic: {
            surface,
            reasonCode: 'parse_error',
            message: 'Empty operator node in parsed tree.',
            rawInput,
          },
        };
      }

      const op = String(json[0]);

      // Unpack Delimiter grouping parentheses (e.g. ["Delimiter", expr])
      if (op === 'Delimiter') {
        if (json.length < 2) {
          return {
            diagnostic: {
              surface,
              reasonCode: 'incomplete_placeholder',
              message: 'Empty parentheses or bracket grouping.',
              rawInput,
            },
          };
        }
        return convertNode(json[1]);
      }

      // Relations
      if (op === 'Equal') {
        if (json.length !== 3) {
          return {
            diagnostic: {
              surface,
              reasonCode: 'malformed_equality',
              message: 'Malformed equality: expected exactly two sides around equal sign.',
              rawInput,
            },
          };
        }
        const lhsRes = convertNode(json[1]);
        if (lhsRes.diagnostic) return lhsRes;
        const rhsRes = convertNode(json[2]);
        if (rhsRes.diagnostic) return rhsRes;

        return { node: createRelationNode('=', lhsRes.node!, rhsRes.node!) };
      }

      // Reject inequalities as surface relations
      if (
        op === 'Less' ||
        op === 'LessEqual' ||
        op === 'Greater' ||
        op === 'GreaterEqual' ||
        op === 'NotEqual'
      ) {
        return {
          diagnostic: {
            surface,
            reasonCode: 'inequality_not_supported',
            message: `Inequalities (e.g. '<', '<=', '>', '>=') are not supported for surface equations. Surfaces must be defined by an equality relation '=' or standalone expression.`,
            rawInput,
          },
        };
      }

      // Check allowlisted operators
      const standardOp = ALLOWED_OPERATORS[op];
      if (!standardOp) {
        // Specific diagnostic for known calculus / discrete constructs
        const unsupportedConstructs: Record<string, string> = {
          Integrate: 'Integrals are not supported in surface equations.',
          Sum: 'Series and summation (\\sum) are not supported in surface equations.',
          Product: 'Products (\\prod) are not supported in surface equations.',
          Limit: 'Limits (\\lim) are not supported in surface equations.',
          Derivative: 'Derivatives are not supported in surface equations.',
          Differential: 'Differentials are not supported in surface equations.',
          Matrix: 'Matrices and vectors are not supported in surface equations.',
          List: 'Lists or bracketed arrays are not supported in surface equations.',
          Set: 'Set notation is not supported in surface equations.',
          Tuple: 'Tuples or sequences are not supported in surface equations.',
          Sequence: 'Comma-separated sequences are not supported in surface equations.',
          Piecewise: 'Piecewise surface equations are not supported in V2.',
          Factorial: 'Factorials are not supported in surface equations.',
        };

        const explanation =
          unsupportedConstructs[op] ??
          `Unsupported mathematical function or operator '${op}'. Supported functions: +, -, *, /, powers, sqrt, trig, inverse trig, hyperbolic, exp, ln, abs.`;

        return {
          diagnostic: {
            surface,
            reasonCode: unsupportedConstructs[op] ? 'unsupported_construct' : 'unsupported_operator',
            message: explanation,
            rawInput,
          },
        };
      }

      // Convert child arguments
      const childNodes: ExpressionNode[] = [];
      for (let i = 1; i < json.length; i++) {
        const childRes = convertNode(json[i]);
        if (childRes.diagnostic) return childRes;
        childNodes.push(childRes.node!);
      }

      return { node: createOperatorNode(standardOp, childNodes) };
    }

    return {
      diagnostic: {
        surface,
        reasonCode: 'parse_error',
        message: `Unrecognized AST node structure: ${typeof json}`,
        rawInput,
      },
    };
  }

  const converted = convertNode(rawJson);
  if (converted.diagnostic) {
    return { success: false, diagnostic: converted.diagnostic };
  }

  const ast = converted.node!;

  // 5. Complexity verification
  const depth = measureTreeDepth(ast);
  if (depth > MAX_TREE_DEPTH) {
    return {
      success: false,
      diagnostic: {
        surface,
        reasonCode: 'excessive_depth',
        message: `Expression nesting depth (${depth}) exceeds safety limit of ${MAX_TREE_DEPTH} levels.`,
        rawInput,
      },
    };
  }

  const nodeCount = countNodes(ast);
  if (nodeCount > MAX_NODE_COUNT) {
    return {
      success: false,
      diagnostic: {
        surface,
        reasonCode: 'excessive_depth',
        message: `Expression node count (${nodeCount}) exceeds safety limit of ${MAX_NODE_COUNT} nodes.`,
        rawInput,
      },
    };
  }

  return {
    success: true,
    ast,
    rawInput,
  };
}

/**
 * Parses a parameter-dependent curve coordinate expression (e.g. "2 cos t", "t^2", "sin(2*pi*t)").
 */
export function parseCurveExpression(
  rawInput: string,
  paramSymbol = 't',
): { success: true; ast: ExpressionNode } | { success: false; error: string } {
  const res = parseMathInput(rawInput, 'surfaceF', { allowedParam: paramSymbol });
  if (res.success) {
    return { success: true, ast: res.ast };
  }
  return { success: false, error: res.diagnostic.message };
}
