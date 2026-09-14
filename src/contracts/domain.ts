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

/**
 * Validates a single parameter interval for mathematical validity and consistency.
 */
export function validateInterval(interval: ParameterInterval): { valid: boolean; error?: string } {
  // 1. Infinity inclusiveness check: infinity cannot be closed
  if (interval.min.kind === 'infinite') {
    if (interval.min.sign === '+') {
      return { valid: false, error: 'Interval lower bound cannot be positive infinity (+inf).' };
    }
    if (interval.minInclusive) {
      return { valid: false, error: 'Interval lower bound of negative infinity (-inf) must be open (exclusive).' };
    }
  }

  if (interval.max.kind === 'infinite') {
    if (interval.max.sign === '-') {
      return { valid: false, error: 'Interval upper bound cannot be negative infinity (-inf).' };
    }
    if (interval.maxInclusive) {
      return { valid: false, error: 'Interval upper bound of positive infinity (+inf) must be open (exclusive).' };
    }
  }

  // 2. Finite vs finite comparison
  if (interval.min.kind === 'finite' && interval.max.kind === 'finite') {
    const minVal = interval.min.numericApprox;
    const maxVal = interval.max.numericApprox;

    if (minVal !== undefined && maxVal !== undefined) {
      if (minVal > maxVal) {
        return {
          valid: false,
          error: `Contradictory interval: lower bound (${interval.min.exact} ≈ ${minVal}) is greater than upper bound (${interval.max.exact} ≈ ${maxVal}).`,
        };
      }
      if (minVal === maxVal && (!interval.minInclusive || !interval.maxInclusive)) {
        return {
          valid: false,
          error: `Empty interval: [${interval.min.exact}, ${interval.max.exact}] with exclusive boundary contains no points.`,
        };
      }
    }
  }

  return { valid: true };
}

/**
 * Validates a parameter domain containing one or more intervals.
 */
export function validateDomain(domain: ParameterDomain): { valid: boolean; error?: string } {
  if (!domain.intervals || domain.intervals.length === 0) {
    return { valid: false, error: 'Domain must contain at least one parameter interval.' };
  }

  for (let i = 0; i < domain.intervals.length; i++) {
    const interval = domain.intervals[i];
    if (!interval) {
      return { valid: false, error: `Interval at index ${i} is missing.` };
    }
    const result = validateInterval(interval);
    if (!result.valid) {
      return { valid: false, error: `Invalid interval at index ${i}: ${result.error}` };
    }
  }

  return { valid: true };
}

export function formatEndpoint(endpoint: EndpointValue): string {
  if (endpoint.kind === 'infinite') {
    return endpoint.sign === '+' ? '∞' : '-∞';
  }
  return endpoint.exact;
}

/**
 * Formats an interval in standard mathematical inequality notation (e.g. 0 <= t < 2*pi)
 * or bracket notation [0, 2*pi).
 */
export function formatInterval(interval: ParameterInterval, paramSymbol: string = 't'): string {
  const leftOp = interval.minInclusive ? '≤' : '<';
  const rightOp = interval.maxInclusive ? '≤' : '<';
  const minText = formatEndpoint(interval.min);
  const maxText = formatEndpoint(interval.max);

  // If min is -inf and max is +inf: t in (-inf, +inf) or -inf < t < inf
  if (interval.min.kind === 'infinite' && interval.max.kind === 'infinite') {
    return `${minText} < ${paramSymbol} < ${maxText}`;
  }
  if (interval.min.kind === 'infinite') {
    return `${paramSymbol} ${rightOp} ${maxText}`;
  }
  if (interval.max.kind === 'infinite') {
    return `${minText} ${leftOp} ${paramSymbol}`;
  }

  return `${minText} ${leftOp} ${paramSymbol} ${rightOp} ${maxText}`;
}

export function formatDomain(domain: ParameterDomain, paramSymbol: string = 't'): string {
  if (domain.intervals.length === 0) return 'Empty domain';
  return domain.intervals.map((inv) => formatInterval(inv, paramSymbol)).join(' ∪ ');
}
