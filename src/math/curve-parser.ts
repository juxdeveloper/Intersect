/**
 * Lightweight, zero-dependency mathematical AST parser for curve coordinate expressions.
 *
 * Implements a robust recursive-descent / precedence-climbing parser that converts
 * parametric math strings (e.g. "2*cos(t)", "2 cos t", "3*sqrt(2)*cos(t + pi/4)", "t**2", "1/t")
 * directly into project ExpressionNode ASTs without requiring heavy external parsers.
 *
 * This allows the Geometry Web Worker to remain completely decoupled from @cortex-js/compute-engine,
 * reducing the worker bundle size from 3,414 KB to under 50 KB.
 */

import type { ExpressionNode } from '../contracts/expressions';
import {
  createNumberNode,
  createSymbolNode,
  createOperatorNode,
} from './ast';

export type ParseResult =
  | { readonly success: true; readonly ast: ExpressionNode }
  | { readonly success: false; readonly error: string };

type TokenType =
  | 'NUMBER'
  | 'IDENT'
  | 'PLUS'
  | 'MINUS'
  | 'STAR'
  | 'SLASH'
  | 'CARET'
  | 'LPAREN'
  | 'RPAREN'
  | 'COMMA'
  | 'EOF';

interface Token {
  readonly type: TokenType;
  readonly value: string;
  readonly pos: number;
}

const KNOWN_FUNCTIONS = new Set([
  'sin',
  'cos',
  'tan',
  'asin',
  'acos',
  'atan',
  'sinh',
  'cosh',
  'tanh',
  'sqrt',
  'abs',
  'exp',
  'ln',
  'log',
]);

const KNOWN_CONSTANTS = new Set(['pi', 'Pi', 'PI', 'e', 'E']);

/**
 * Tokenizes raw math input into tokens.
 */
function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  const len = input.length;

  while (i < len) {
    const ch = input[i]!;

    if (/\s/.test(ch)) {
      i++;
      continue;
    }

    // Number: integer or decimal
    if (/[0-9]/.test(ch) || (ch === '.' && i + 1 < len && /[0-9]/.test(input[i + 1]!))) {
      let numStr = '';
      const start = i;
      while (i < len && (/[0-9]/.test(input[i]!) || input[i] === '.')) {
        numStr += input[i];
        i++;
      }
      tokens.push({ type: 'NUMBER', value: numStr, pos: start });
      continue;
    }

    // Identifiers (letters, Greek names, LaTeX commands like \cos, \sin, \pi)
    if (/[a-zA-Z\\]/.test(ch)) {
      let ident = '';
      const start = i;
      if (ch === '\\') {
        i++; // skip backslash for latex commands
      }
      while (i < len && /[a-zA-Z0-9_]/.test(input[i]!)) {
        ident += input[i];
        i++;
      }
      tokens.push({ type: 'IDENT', value: ident, pos: start });
      continue;
    }

    // Multi-character power: **
    if (ch === '*' && i + 1 < len && input[i + 1] === '*') {
      tokens.push({ type: 'CARET', value: '**', pos: i });
      i += 2;
      continue;
    }

    // Single-character symbols
    switch (ch) {
      case '+':
        tokens.push({ type: 'PLUS', value: '+', pos: i });
        i++;
        break;
      case '-':
        tokens.push({ type: 'MINUS', value: '-', pos: i });
        i++;
        break;
      case '*':
        tokens.push({ type: 'STAR', value: '*', pos: i });
        i++;
        break;
      case '/':
        tokens.push({ type: 'SLASH', value: '/', pos: i });
        i++;
        break;
      case '^':
        tokens.push({ type: 'CARET', value: '^', pos: i });
        i++;
        break;
      case '(':
        tokens.push({ type: 'LPAREN', value: '(', pos: i });
        i++;
        break;
      case ')':
        tokens.push({ type: 'RPAREN', value: ')', pos: i });
        i++;
        break;
      case ',':
        tokens.push({ type: 'COMMA', value: ',', pos: i });
        i++;
        break;
      default:
        // Skip unrecognized punctuation such as curlies {} from LaTeX
        i++;
        break;
    }
  }

  tokens.push({ type: 'EOF', value: '', pos: len });
  return tokens;
}

class Parser {
  private tokens: Token[];
  private current = 0;
  private readonly paramSymbol: string;

  constructor(tokens: Token[], paramSymbol: string) {
    this.tokens = tokens;
    this.paramSymbol = paramSymbol;
  }

  private peek(): Token {
    return this.tokens[this.current] || { type: 'EOF', value: '', pos: 0 };
  }

  private previous(): Token {
    return this.tokens[this.current - 1]!;
  }

  private isAtEnd(): boolean {
    return this.peek().type === 'EOF';
  }

  private advance(): Token {
    if (!this.isAtEnd()) this.current++;
    return this.previous();
  }

  private check(type: TokenType): boolean {
    if (this.isAtEnd()) return false;
    return this.peek().type === type;
  }

  private match(...types: TokenType[]): boolean {
    for (const type of types) {
      if (this.check(type)) {
        this.advance();
        return true;
      }
    }
    return false;
  }

  private consume(type: TokenType, message: string): Token {
    if (this.check(type)) return this.advance();
    throw new Error(`${message} at position ${this.peek().pos}`);
  }

  public parse(): ExpressionNode {
    const expr = this.parseExpression();
    if (!this.isAtEnd()) {
      throw new Error(`Unexpected token '${this.peek().value}' after expression at position ${this.peek().pos}`);
    }
    return expr;
  }

  // Precedence climbing
  // Precedence levels:
  // 1. + - (lowest)
  // 2. * / (multiplication / division / implicit mult)
  // 3. Unary (+ -)
  // 4. ^ (power, right-associative)
  // 5. Primary / functions (highest)

  private parseExpression(): ExpressionNode {
    return this.parseAddition();
  }

  private parseAddition(): ExpressionNode {
    let expr = this.parseMultiplication();

    while (this.match('PLUS', 'MINUS')) {
      const op = this.previous().type;
      const right = this.parseMultiplication();
      if (op === 'PLUS') {
        expr = createOperatorNode('Add', [expr, right]);
      } else {
        expr = createOperatorNode('Subtract', [expr, right]);
      }
    }

    return expr;
  }

  private parseMultiplication(): ExpressionNode {
    let expr = this.parseImplicitOrUnary();

    while (this.check('STAR') || this.check('SLASH') || this.canStartImplicitMultiplication()) {
      if (this.match('STAR')) {
        const right = this.parseImplicitOrUnary();
        expr = createOperatorNode('Multiply', [expr, right]);
      } else if (this.match('SLASH')) {
        const right = this.parseImplicitOrUnary();
        expr = createOperatorNode('Divide', [expr, right]);
      } else if (this.canStartImplicitMultiplication()) {
        // Implicit multiplication: 2 cos(t) or 2t or (t+1)(t-1)
        const right = this.parseImplicitOrUnary();
        expr = createOperatorNode('Multiply', [expr, right]);
      } else {
        break;
      }
    }

    return expr;
  }

  private canStartImplicitMultiplication(): boolean {
    const nextType = this.peek().type;
    return nextType === 'NUMBER' || nextType === 'IDENT' || nextType === 'LPAREN';
  }

  private parseImplicitOrUnary(): ExpressionNode {
    if (this.match('PLUS')) {
      return this.parseImplicitOrUnary();
    }
    if (this.match('MINUS')) {
      const operand = this.parseImplicitOrUnary();
      return createOperatorNode('Negate', [operand]);
    }
    return this.parsePower();
  }

  private parsePower(): ExpressionNode {
    let expr = this.parsePrimary();

    if (this.match('CARET')) {
      // Power is right-associative: 2^3^4 = 2^(3^4)
      const right = this.parseImplicitOrUnary();
      expr = createOperatorNode('Power', [expr, right]);
    }

    return expr;
  }

  private parsePrimary(): ExpressionNode {
    // Number literal
    if (this.match('NUMBER')) {
      const valStr = this.previous().value;
      const numVal = parseFloat(valStr);
      return createNumberNode(numVal, valStr);
    }

    // Identifiers: functions, symbols, constants
    if (this.match('IDENT')) {
      const rawIdent = this.previous().value;
      const ident = rawIdent.toLowerCase();

      // Check if function call
      if (KNOWN_FUNCTIONS.has(ident)) {
        let arg: ExpressionNode;
        if (this.match('LPAREN')) {
          arg = this.parseExpression();
          this.consume('RPAREN', `Expected ')' after argument of ${rawIdent}`);
        } else {
          // Allow syntax like "cos t" or "sin 2t"
          arg = this.parsePower();
        }

        // Map function name to OperatorNode op
        const opName = this.normalizeFunctionName(ident);
        return createOperatorNode(opName, [arg]);
      }

      // Check if known constant (pi, e)
      if (KNOWN_CONSTANTS.has(rawIdent) || ident === 'pi') {
        return createSymbolNode('pi', true);
      }
      if (rawIdent === 'e' || rawIdent === 'E') {
        return createSymbolNode('e', true);
      }

      // Variable symbol (e.g. paramSymbol 't', 'u', or coordinates)
      const symbolName = rawIdent === this.paramSymbol ? this.paramSymbol : rawIdent;
      return createSymbolNode(symbolName);
    }

    // Parenthesized expression
    if (this.match('LPAREN')) {
      const expr = this.parseExpression();
      this.consume('RPAREN', "Expected ')' after expression");
      return expr;
    }

    throw new Error(`Unexpected token '${this.peek().value || 'EOF'}' at position ${this.peek().pos}`);
  }

  private normalizeFunctionName(ident: string): string {
    switch (ident) {
      case 'sin':
        return 'Sin';
      case 'cos':
        return 'Cos';
      case 'tan':
        return 'Tan';
      case 'asin':
        return 'Arcsin';
      case 'acos':
        return 'Arccos';
      case 'atan':
        return 'Arctan';
      case 'sinh':
        return 'Sinh';
      case 'cosh':
        return 'Cosh';
      case 'tanh':
        return 'Tanh';
      case 'sqrt':
        return 'Sqrt';
      case 'abs':
        return 'Abs';
      case 'exp':
        return 'Exp';
      case 'ln':
      case 'log':
        return 'Log';
      default:
        return ident.charAt(0).toUpperCase() + ident.slice(1);
    }
  }
}

/**
 * Parses a parameter-dependent curve coordinate expression (e.g. "2*cos(t)", "2 cos t", "t^2", "1/t")
 * into a project ExpressionNode AST.
 *
 * @param rawInput The raw mathematical string
 * @param paramSymbol The parameter variable name (defaults to 't')
 */
export function parseCurveExpression(rawInput: string, paramSymbol = 't'): ParseResult {
  if (!rawInput || !rawInput.trim()) {
    return { success: false, error: 'Empty curve expression' };
  }

  try {
    const tokens = tokenize(rawInput);
    const parser = new Parser(tokens, paramSymbol);
    const ast = parser.parse();
    return { success: true, ast };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
