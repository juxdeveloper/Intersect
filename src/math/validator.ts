/**
 * Semantic validation and classification for parsed surface equations in Intersect.
 */

import type {
  ExpressionNode,
  EquationClassification,
  EquationDiagnostic,
} from '../contracts/expressions';
import {
  createNumberNode,
  createOperatorNode,
  isRelationNode,
  isNumberNode,
  isSymbolNode,
  isOperatorNode,
  extractSymbols,
  areExpressionsIdentical,
} from './ast';

export interface ValidatedEquation {
  readonly lhs: ExpressionNode;
  readonly rhs: ExpressionNode;
  readonly residual: ExpressionNode;
  readonly classification: EquationClassification;
  readonly variables: readonly ('x' | 'y' | 'z')[];
}

export interface ValidationSuccess {
  readonly success: true;
  readonly equation: ValidatedEquation;
}

export interface ValidationFailure {
  readonly success: false;
  readonly diagnostic: EquationDiagnostic;
}

export type ValidationResult = ValidationSuccess | ValidationFailure;

/**
 * Checks if an expression tree contains any relation node (e.g. nested '=')
 */
function containsRelation(node: ExpressionNode): boolean {
  if (isRelationNode(node)) return true;
  if (isOperatorNode(node)) {
    return node.args.some(containsRelation);
  }
  return false;
}

/**
 * Evaluates constant numeric expressions without variables to determine equality.
 */
function evaluateConstantEquality(lhs: ExpressionNode, rhs: ExpressionNode): boolean {
  if (areExpressionsIdentical(lhs, rhs)) {
    return true;
  }

  if (isNumberNode(lhs) && isNumberNode(rhs)) {
    if (lhs.exactRational && rhs.exactRational) {
      return (
        lhs.exactRational.num === rhs.exactRational.num &&
        lhs.exactRational.den === rhs.exactRational.den
      );
    }
    return lhs.value === rhs.value;
  }

  // Symbol comparison for constants
  if (isSymbolNode(lhs) && isSymbolNode(rhs)) {
    return lhs.name === rhs.name;
  }

  return false;
}

/**
 * Validates a parsed AST for surface equation rules:
 * - Exactly one equality relation, or a standalone expression representing `expr = 0`.
 * - Rejects chained equalities (e.g. x = y = z).
 * - Extracts surface variables (subset of x, y, z).
 * - Forms the zero-residual (lhs - rhs) preserving all domain restrictions.
 * - Classifies standard equations vs constant identities (0 = 0) vs contradictions (1 = 0).
 */
export function validateAndClassifyEquation(
  ast: ExpressionNode,
  rawInput: string,
  surface: 'surfaceF' | 'surfaceG',
): ValidationResult {
  let lhs: ExpressionNode;
  let rhs: ExpressionNode;

  if (isRelationNode(ast)) {
    if (ast.relation !== '=') {
      return {
        success: false,
        diagnostic: {
          surface,
          reasonCode: 'inequality_not_supported',
          message: `Inequalities ('${ast.relation}') are not supported for surface equations. Surfaces must be defined by an equality relation '=' or standalone expression.`,
          rawInput,
        },
      };
    }

    // Check for chained equalities: e.g. x = y = z
    if (containsRelation(ast.lhs) || containsRelation(ast.rhs)) {
      return {
        success: false,
        diagnostic: {
          surface,
          reasonCode: 'malformed_equality',
          message: `Chained equalities (e.g. 'x = y = z') are not supported. Each surface equation must contain exactly one '=' relation.`,
          rawInput,
        },
      };
    }

    lhs = ast.lhs;
    rhs = ast.rhs;
  } else {
    // Standalone expression: expr = 0 convention
    lhs = ast;
    rhs = createNumberNode(0, '0', { num: '0', den: '1' });
  }

  // Build zero residual: lhs - rhs without algebraic cancellation
  let residual: ExpressionNode;
  if (isNumberNode(rhs) && rhs.value === 0) {
    residual = lhs;
  } else if (isNumberNode(lhs) && lhs.value === 0) {
    residual = createOperatorNode('Negate', [rhs]);
  } else {
    residual = createOperatorNode('Subtract', [lhs, rhs]);
  }

  // Extract variables present
  const allSymbols = new Set<string>([
    ...extractSymbols(lhs),
    ...extractSymbols(rhs),
  ]);

  const recognizedVars: ('x' | 'y' | 'z')[] = [];
  if (allSymbols.has('x')) recognizedVars.push('x');
  if (allSymbols.has('y')) recognizedVars.push('y');
  if (allSymbols.has('z')) recognizedVars.push('z');

  // Classify equation
  let classification: EquationClassification = 'standard';
  if (recognizedVars.length === 0) {
    const isEquivalent = evaluateConstantEquality(lhs, rhs);
    classification = isEquivalent ? 'constant-identity' : 'constant-contradiction';
  }

  return {
    success: true,
    equation: {
      lhs,
      rhs,
      residual,
      classification,
      variables: recognizedVars,
    },
  };
}
