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