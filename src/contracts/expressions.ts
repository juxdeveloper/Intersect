/**
 * Equation and mathematical expression contracts for Intersect.
 *
 * Boundary Design:
 * - `rawInput` stores user-entered text/LaTeX for editing, display, and history fidelity.
 * - `ExpressionNode` defines a lossless, JSON-serializable structured abstract syntax tree (AST).
 * - In V2, MathLive Compute Engine parses the LaTeX input into this structured representation.
 * - In V3, a dedicated bridge translates this structured AST into SymPy expressions inside the Pyodide worker.
 * - SECURITY / INTEGRITY: Arbitrary code evaluation (JavaScript eval() or unconstrained Python exec())
 *   is strictly prohibited across this boundary. All equations are transferred as structured data.
 */

export type ExpressionNode =
  | NumberLiteralNode
  | SymbolNode
  | OperatorNode
  | EquationRelationNode
  | MathJsonBridgeNode;

export interface NumberLiteralNode {
  readonly type: 'number';
  readonly value: number;
  /** Exact string representation, e.g. "4", "-0.5", "1/3", "0.1" */
  readonly exactText?: string;
  /** Exact integer or rational fraction representation to avoid IEEE 754 drift */
  readonly exactRational?: {
    readonly num: string;
    readonly den: string;
  };
}

export interface SymbolNode {
  readonly type: 'symbol';
  /** Symbol name, e.g. "x", "y", "z", "pi", "e" */
  readonly name: string;
  /** True for recognized constants like pi, e; false for surface variables */
  readonly isConstant?: boolean;
}

export interface OperatorNode {
  readonly type: 'apply';
  /** Standard mathematical function or operator, e.g. "Add", "Subtract", "Multiply", "Divide", "Power", "Sin", "Cos" */
  readonly op: string;
  readonly args: readonly ExpressionNode[];
}

export interface EquationRelationNode {
  readonly type: 'relation';
  readonly relation: '=' | '<=' | '>=' | '<' | '>';
  readonly lhs: ExpressionNode;
  readonly rhs: ExpressionNode;
}

/**
 * MathJSON-compatible bridge container for structured data produced by MathLive Compute Engine.
 * Must be serializable via JSON.stringify() without loss.
 */
export interface MathJsonBridgeNode {
  readonly type: 'mathjson';
  readonly data: readonly unknown[];
}

export type InputFormat = 'latex' | 'ascii';

/**
 * Reason codes for surface equation diagnostics.
 */
export type DiagnosticReasonCode =
  | 'empty_input'
  | 'input_too_long'
  | 'excessive_depth'
  | 'parse_error'
  | 'incomplete_placeholder'
  | 'unknown_symbol'
  | 'reserved_symbol'
  | 'unsupported_function'
  | 'unsupported_operator'
  | 'malformed_equality'
  | 'inequality_not_supported'
  | 'unsupported_construct'
  | 'internal_adapter_error';

/**
 * Structured diagnostic associated with a specific surface input field.
 */
export interface EquationDiagnostic {
  readonly surface: 'surfaceF' | 'surfaceG';
  readonly reasonCode: DiagnosticReasonCode;
  readonly message: string;
  readonly rawInput: string;
  readonly sourceOffsets?: readonly [start: number, end: number];
}

/**
 * Real-domain obligations required for mathematical validity.
 */
export type DomainObligationKind =
  | 'nonzero-denominator'
  | 'nonnegative-radicand'
  | 'positive-argument'
  | 'nonzero-cosine'
  | 'nonzero-sine'
  | 'bounded-interval-closed'
  | 'positive-base';

export interface DomainObligation {
  readonly id: string;
  readonly kind: DomainObligationKind;
  /** The symbolic expression subject to the domain restriction */
  readonly target: ExpressionNode;
  /** Human-readable explanation of why this condition exists */
  readonly description: string;
}

export type EquationClassification =
  | 'standard'
  | 'constant-identity'
  | 'constant-contradiction';

/**
 * Finite, typed allowlisted SymPy construction step for V3 worker execution.
 * Contains no executable Python code, no eval(), and no arbitrary string-to-code conversions.
 */
export interface SymPyConstructionStep {
  readonly op:
    | 'Integer'
    | 'Rational'
    | 'Symbol'
    | 'Constant'
    | 'Add'
    | 'Mul'
    | 'Pow'
    | 'Sin'
    | 'Cos'
    | 'Tan'
    | 'Sec'
    | 'Csc'
    | 'Cot'
    | 'ArcSin'
    | 'ArcCos'
    | 'ArcTan'
    | 'Sinh'
    | 'Cosh'
    | 'Tanh'
    | 'Exp'
    | 'Log'
    | 'Sqrt'
    | 'Abs'
    | 'Eq';
  readonly args?: readonly SymPyConstructionStep[];
  readonly value?: string;
  readonly num?: string;
  readonly den?: string;
  readonly name?: string;
}

/**
 * Typed allowlisted construction plan consumed by the future SymPy worker in V3.
 */
export interface SymPyConstructionPlan {
  readonly planVersion: '1.0.0';
  readonly target: 'sympy';
  readonly entryPoint: 'build_surface_system';
  readonly equation: SymPyConstructionStep;
  readonly residual: SymPyConstructionStep;
  readonly variables: readonly string[];
  readonly domainConditions: readonly {
    readonly id: string;
    readonly kind: DomainObligationKind;
    readonly condition: SymPyConstructionStep;
    readonly description: string;
  }[];
}

/**
 * Prepared equation representation produced by V2 pipeline.
 */
export interface PreparedEquation {
  readonly id: string;
  readonly label: 'Surface F' | 'Surface G' | string;
  readonly rawInput: string;
  readonly classification: EquationClassification;
  readonly variables: readonly ('x' | 'y' | 'z')[];
  readonly lhs: ExpressionNode;
  readonly rhs: ExpressionNode;
  readonly residual: ExpressionNode;
  readonly domainObligations: readonly DomainObligation[];
  readonly sympyPlan: SymPyConstructionPlan;
}

export interface PreparedEquationPair {
  readonly surfaceF: PreparedEquation;
  readonly surfaceG: PreparedEquation;
  readonly allVariables: readonly ('x' | 'y' | 'z')[];
  readonly hasContradiction: boolean;
  readonly hasIdentity: boolean;
}

export interface EquationInput {
  /** Identifier for field tracking, e.g. 'surface-f' or 'surface-g' */
  readonly id: string;
  /** Human-readable label for diagnostics and UI display */
  readonly label: 'Surface F' | 'Surface G' | string;
  /** Raw text or LaTeX string entered by the user */
  readonly rawInput: string;
  /** Format of the raw input */
  readonly format: InputFormat;
  /** Structured representation, populated once parsed by V2 pipeline */
  readonly structured?: ExpressionNode;
  /** Full prepared equation package (AST, residual, domain obligations, SymPy plan) */
  readonly prepared?: PreparedEquation;
}

/**
 * Validates that an EquationInput has non-empty raw input and valid format.
 */
export function validateEquationInput(input: EquationInput): { valid: boolean; error?: string } {
  if (!input.rawInput || input.rawInput.trim().length === 0) {
    return { valid: false, error: `${input.label} equation cannot be empty.` };
  }
  if (input.format !== 'latex' && input.format !== 'ascii') {
    return { valid: false, error: `Unsupported input format: ${input.format}` };
  }
  return { valid: true };
}
