/**
 * Calculation result contracts for Intersect.
 *
 * Discriminated Union:
 * - `status` uniquely discriminates every possible calculation outcome.
 * - Mathematical honesty: Uncertainty, failure, or degenerate geometry must NEVER
 *   masquerade as a successful verified curve.
 * - Verified curves require complete exact expressions, real parameter domains,
 *   and explicit algebraic verification records.
 */

import type { WorldBounds } from './bounds';
import type { ExactCurve } from './curve';
import type { DerivationRecord } from './derivation';
import type { EquationDiagnostic, DiagnosticReasonCode } from './expressions';

export interface VerifiedCurveResult {
  readonly status: 'verified-curve';
  /** Currently displayed/active curve formula and domain matching user's selected orientation */
  readonly curve: ExactCurve;
  /** Immutable canonical forward curve (+t parameterization) */
  readonly canonicalCurve?: ExactCurve;
  /** Reversed curve derived from canonical curve */
  readonly reverseCurve?: ExactCurve;
  /** Derivation record corresponding to currently displayed direction */
  readonly derivation: DerivationRecord;
  /** Canonical derivation record */
  readonly canonicalDerivation?: DerivationRecord;
  /** Reversed derivation record (includes orientation reparameterization step) */
  readonly reverseDerivation?: DerivationRecord;
  /** Explicit component scope notation (e.g. "Single closed loop component") */
  readonly componentScope: string;
}

export interface EmptyBoundedResult {
  readonly status: 'empty-bounded';
  readonly bounds: WorldBounds;
  readonly reasonCode: 'disjoint_bounding_boxes' | 'algebraic_contradiction' | 'sum_of_squares_positive' | string;
  /** Whether emptiness was proved globally in R^3 or restricted to calculation bounds */
  readonly proofScope?: 'global' | 'bounded';
  /** Explicit scope of mathematical proof within stated bounds or globally */
  readonly proofExplanation: string;
}

export interface InconclusiveResult {
  readonly status: 'inconclusive';
  readonly bounds: WorldBounds;
  readonly reasonCode: 'search_exhausted' | 'timeout' | 'transcendental_structure' | string;
  readonly message: string;
  readonly searchDetails?: string;
}

export interface UnsupportedResult {
  readonly status: 'unsupported';
  readonly reasonCode: 'unsupported_operator' | 'implicit_degree_too_high' | 'unsupported_dimension' | string;
  readonly message: string;
  readonly unsupportedElement?: string;
}

export interface InvalidInputResult {
  readonly status: 'invalid-input';
  readonly field?: 'surfaceF' | 'surfaceG' | 'bounds' | 'general';
  readonly reasonCode?: DiagnosticReasonCode | string;
  readonly message: string;
  readonly diagnostics?: readonly EquationDiagnostic[];
}

export interface DegenerateResult {
  readonly status: 'degenerate';
  readonly nature: 'isolated-point' | 'coincident-surfaces' | 'higher-dimensional' | 'empty-algebraic';
  readonly message: string;
  readonly explanation: string;
  /** If isolated points, their coordinates */
  readonly points?: readonly {
    readonly x: string;
    readonly y: string;
    readonly z: string;
  }[];
}

export interface CancelledResult {
  readonly status: 'cancelled';
  readonly reason: string;
  readonly cancelledAt: number;
}

export interface RuntimeFailureResult {
  readonly status: 'runtime-failure';
  readonly errorCode: string;
  readonly message: string;
  readonly fatal: boolean;
  readonly details?: string;
}

export type CalculationResult =
  | VerifiedCurveResult
  | EmptyBoundedResult
  | InconclusiveResult
  | UnsupportedResult
  | InvalidInputResult
  | DegenerateResult
  | CancelledResult
  | RuntimeFailureResult;

// Type guards
export function isVerifiedCurveResult(result: CalculationResult): result is VerifiedCurveResult {
  return result.status === 'verified-curve';
}

export function isDegenerateResult(result: CalculationResult): result is DegenerateResult {
  return result.status === 'degenerate';
}

export function isUncertainResult(
  result: CalculationResult,
): result is InconclusiveResult | UnsupportedResult {
  return result.status === 'inconclusive' || result.status === 'unsupported';
}
