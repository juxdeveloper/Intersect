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

/**
 * Collects all unique symbol names from an expression tree.
 */
export function extractSymbols(node: ExpressionNode): Set<string> {
  const symbols = new Set<string>();

  function walk(current: ExpressionNode) {
    if (isSymbolNode(current)) {
      symbols.add(current.name);
    } else if (isOperatorNode(current)) {
      for (const child of current.args) {
        walk(child);
      }
    } else if (isRelationNode(current)) {
      walk(current.lhs);
      walk(current.rhs);
    }
  }

  walk(node);
  return symbols;
}

/**
 * Checks whether two expressions are structurally and value-identical.
 */
export function areExpressionsIdentical(a: ExpressionNode, b: ExpressionNode): boolean {
  if (a.type !== b.type) return false;

  if (isNumberNode(a) && isNumberNode(b)) {
    if (a.exactRational && b.exactRational) {
      return a.exactRational.num === b.exactRational.num && a.exactRational.den === b.exactRational.den;
    }
    return a.value === b.value;
  }

  if (isSymbolNode(a) && isSymbolNode(b)) {
    return a.name === b.name;
  }

  if (isOperatorNode(a) && isOperatorNode(b)) {
    if (a.op !== b.op || a.args.length !== b.args.length) return false;
    for (let i = 0; i < a.args.length; i++) {
      if (!areExpressionsIdentical(a.args[i]!, b.args[i]!)) return false;
    }
    return true;
  }

  if (isRelationNode(a) && isRelationNode(b)) {
    return (
      a.relation === b.relation &&
      areExpressionsIdentical(a.lhs, b.lhs) &&
      areExpressionsIdentical(a.rhs, b.rhs)
    );
  }

  return false;
}

/**
 * Formats an ExpressionNode into standard mathematical text notation.
 */
export function formatExpression(node: ExpressionNode): string {
  switch (node.type) {
    case 'number':
      return node.exactText ?? node.value.toString();
    case 'symbol':
      return node.name;
    case 'apply': {
      const { op, args } = node;
      if (op === 'Add') {
        return args.map(formatExpression).join(' + ');
      }
      if (op === 'Subtract') {
        if (args.length === 2) {
          return `${formatExpression(args[0]!)} - ${formatExpression(args[1]!)}`;
        }
        return `-${formatExpression(args[0]!)}`;
      }
      if (op === 'Negate') {
        const inner = formatExpression(args[0]!);
        return isOperatorNode(args[0]!) ? `-(${inner})` : `-${inner}`;
      }
      if (op === 'Multiply') {
        return args
          .map((arg) => (isOperatorNode(arg) && arg.op === 'Add' ? `(${formatExpression(arg)})` : formatExpression(arg)))
          .join(' * ');
      }
      if (op === 'Divide' && args.length === 2) {
        const n = isOperatorNode(args[0]!) ? `(${formatExpression(args[0]!)})` : formatExpression(args[0]!);
        const d = isOperatorNode(args[1]!) ? `(${formatExpression(args[1]!)})` : formatExpression(args[1]!);
        return `${n} / ${d}`;
      }
      if (op === 'Power' && args.length === 2) {
        const base = isOperatorNode(args[0]!) ? `(${formatExpression(args[0]!)})` : formatExpression(args[0]!);
        return `${base}^${formatExpression(args[1]!)}`;
      }
      if (op === 'Sqrt' && args.length === 1) {
        return `sqrt(${formatExpression(args[0]!)})`;
      }
      if (op === 'Abs' && args.length === 1) {
        return `|${formatExpression(args[0]!)}|`;
      }
      return `${op.toLowerCase()}(${args.map(formatExpression).join(', ')})`;
    }
    case 'relation':
      return `${formatExpression(node.lhs)} ${node.relation} ${formatExpression(node.rhs)}`;
    case 'mathjson':
      return JSON.stringify(node.data);
  }
}
