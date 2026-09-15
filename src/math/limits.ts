/**
 * Resource and complexity limits for mathematical input processing in Intersect.
 *
 * Conservative bounds protect the browser main thread and future worker runtime
 * against pathological nesting, exponential AST growth, and memory exhaustion.
 */

import type { EquationDiagnostic } from '../contracts/expressions';

/** Maximum permitted length of user input string in characters */
export const MAX_INPUT_LENGTH = 500;

/** Maximum allowable depth of parsed mathematical abstract syntax tree */
export const MAX_TREE_DEPTH = 30;

/** Maximum total number of nodes in a single parsed equation expression */
export const MAX_NODE_COUNT = 250;

/**
 * Validates initial raw input size before invoking the MathLive Compute Engine parser.
 */
export function checkInputSize(
  rawInput: string,
  surface: 'surfaceF' | 'surfaceG',
): EquationDiagnostic | null {
  if (rawInput === undefined || rawInput === null || rawInput.trim().length === 0) {
    return {
      surface,
      reasonCode: 'empty_input',
      message: `${surface === 'surfaceF' ? 'Surface F' : 'Surface G'} equation cannot be empty.`,
      rawInput: rawInput ?? '',
    };
  }

  if (rawInput.length > MAX_INPUT_LENGTH) {
    return {
      surface,
      reasonCode: 'input_too_long',
      message: `${surface === 'surfaceF' ? 'Surface F' : 'Surface G'} input length (${rawInput.length}) exceeds the maximum allowed limit of ${MAX_INPUT_LENGTH} characters.`,
      rawInput,
    };
  }

  return null;
}
