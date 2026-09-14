/**
 * Parameter domain and interval contracts for Intersect.
 *
 * Mathematical Domain vs Rendered Clipping:
 * - Mathematical domain is the intrinsic, exact subset of R where the parameterization r(t)
 *   is defined and satisfies both surface equations identically.
 * - Viewport clipping simply limits which portion of the curve is rendered in the 3D scene
 *   based on the world bounds ([-1000, 1000]^3 or [-50, 50]^3).
 * - Clipping does NOT truncate the mathematical domain or invent false finite endpoints.
 *
 * Serialization Invariant:
 * - Standard JSON does NOT support Infinity or NaN (they serialize to `null`).
 * - Infinities are strictly represented via `{ kind: 'infinite', sign: '+' | '-' }`.
 * - Finite endpoints preserve exact symbolic representation (`exact: "2*pi"`) alongside
 *   an optional IEEE-754 numerical approximation.
 */

export interface FiniteEndpoint {
  readonly kind: 'finite';
  /** Exact symbolic expression string (e.g. "0", "2*pi", "-sqrt(3)", "1/2") */
  readonly exact: string;
  /** Optional numerical approximation for numeric sampling and range checking */
  readonly numericApprox?: number;
}

export interface InfiniteEndpoint {
  readonly kind: 'infinite';
  readonly sign: '+' | '-';
}

export type EndpointValue = FiniteEndpoint | InfiniteEndpoint;

export interface ParameterInterval {
  readonly min: EndpointValue;
  /** True for closed '[' bound; false for open '(' bound. Must be false if min is -inf */
  readonly minInclusive: boolean;
  readonly max: EndpointValue;
  /** True for closed ']' bound; false for open ')' bound. Must be false if max is +inf */
  readonly maxInclusive: boolean;
}

export interface ParameterDomain {
  /** Collection of one or more disjoint intervals */
  readonly intervals: readonly ParameterInterval[];
  /** Optional human-readable description of domain restrictions, e.g. "t != pi/2 + k*pi" */
  readonly description?: string;
}

export function createFiniteEndpoint(exact: string, numericApprox?: number): FiniteEndpoint {
  return {
    kind: 'finite',
    exact: exact.trim(),
    numericApprox: numericApprox !== undefined ? numericApprox : parseExactToFloat(exact),
  };
}

export function createInfiniteEndpoint(sign: '+' | '-'): InfiniteEndpoint {
  return { kind: 'infinite', sign };
}

export function createInterval(
  min: EndpointValue,
  minInclusive: boolean,
  max: EndpointValue,
  maxInclusive: boolean,
): ParameterInterval {
  return {
    min,
    minInclusive: min.kind === 'infinite' ? false : minInclusive,
    max,
    maxInclusive: max.kind === 'infinite' ? false : maxInclusive,
  };
}

/**
 * Attempts a safe conversion for simple exact strings to float for numerical comparison.
 */
function parseExactToFloat(exact: string): number | undefined {
  const trimmed = exact.trim();
  const num = Number(trimmed);
  if (Number.isFinite(num)) {
    return num;
  }
  // Recognize common constants if present without full parser
  if (trimmed === 'pi' || trimmed === 'π') return Math.PI;
  if (trimmed === '2*pi' || trimmed === '2π') return 2 * Math.PI;
  if (trimmed === '-pi' || trimmed === '-π') return -Math.PI;
  if (trimmed === 'e') return Math.E;
  return undefined;
}