/**
 * Abstract syntax tree (AST) construction and inspection helpers for Intersect expressions.
 */

import type {
  ExpressionNode,
  NumberLiteralNode,
  SymbolNode,
  OperatorNode,
  EquationRelationNode,
} from '../contracts/expressions';
import { parseExactDecimalToRational, type ExactRational } from './rational';

export function createNumberNode(
  value: number,
  exactText?: string,
  exactRational?: ExactRational,
): NumberLiteralNode {
  let rational = exactRational;
  if (!rational && exactText !== undefined) {
    try {
      rational = parseExactDecimalToRational(exactText);
    } catch {
      // Fallback if parsing fails
    }
  } else if (!rational && Number.isFinite(value)) {
    try {
      rational = parseExactDecimalToRational(value.toString());
    } catch {
      // Fallback
    }
  }

  return {
    type: 'number',
    value,
    exactText: exactText ?? value.toString(),
    exactRational: rational,
  };
}

export function createSymbolNode(name: string, isConstant?: boolean): SymbolNode {
  const constantNames = new Set(['pi', 'Pi', 'e', 'E', 'ExponentialE']);
  return {
    type: 'symbol',
    name,
    isConstant: isConstant ?? constantNames.has(name),
  };
}

export function createOperatorNode(
  op: string,
  args: readonly ExpressionNode[],
): OperatorNode {
  return {
    type: 'apply',
    op,
    args,
  };
}

export function createRelationNode(
  relation: '=' | '<=' | '>=' | '<' | '>',
  lhs: ExpressionNode,
  rhs: ExpressionNode,
): EquationRelationNode {
  return {
    type: 'relation',
    relation,
    lhs,
    rhs,
  };
}

export function isNumberNode(node: ExpressionNode): node is NumberLiteralNode {
  return node.type === 'number';
}

export function isSymbolNode(node: ExpressionNode): node is SymbolNode {
  return node.type === 'symbol';
}

export function isOperatorNode(node: ExpressionNode): node is OperatorNode {
  return node.type === 'apply';
}

export function isRelationNode(node: ExpressionNode): node is EquationRelationNode {
  return node.type === 'relation';
}

/**
 * Computes maximum tree depth of an expression.
 */
export function measureTreeDepth(node: ExpressionNode): number {
  switch (node.type) {
    case 'number':
    case 'symbol':
      return 1;
    case 'apply': {
      if (node.args.length === 0) return 1;
      let maxChild = 0;
      for (const child of node.args) {
        const d = measureTreeDepth(child);
        if (d > maxChild) maxChild = d;
      }
      return 1 + maxChild;
    }
    case 'relation':
      return 1 + Math.max(measureTreeDepth(node.lhs), measureTreeDepth(node.rhs));
    case 'mathjson':
      return 1;
  }
}

/**
 * Counts total number of AST nodes.
 */
export function countNodes(node: ExpressionNode): number {
  switch (node.type) {
    case 'number':
    case 'symbol':
      return 1;
    case 'apply':
      return 1 + node.args.reduce((sum, child) => sum + countNodes(child), 0);
    case 'relation':
      return 1 + countNodes(node.lhs) + countNodes(node.rhs);
    case 'mathjson':
      return 1;
  }
}