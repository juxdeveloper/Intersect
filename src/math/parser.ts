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