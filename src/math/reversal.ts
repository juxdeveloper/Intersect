/**
 * Domain reversal, reparameterization, and traversal metadata utilities for Phase V5.
 *
 * Mathematical Principles:
 * - Forward traversal is canonical (+t increasing).
 * - Reverse traversal derives a decreasing bijection between the oriented parameter u
 *   and canonical parameter t.
 * - For a single finite interval [a, b], readability-preserving reflection t = a + b - u
 *   retains numeric endpoints while swapping endpoint inclusion ([a, b) -> (a, b]).
 * - For unions of disjoint intervals or infinite domains, uniform negation t = -u is applied
 *   with interval boundaries inverted (-b, -a) and segment order reversed, preserving all
 *   domain exclusions, holes, and segment gaps without connecting lines.
 * - Signed infinities are handled losslessly through structured endpoints.
 */

import type {
  EndpointValue,
  ParameterInterval,
  ParameterDomain,
  TraversalDirection,
  CurveTraversalMetadata,
} from '../contracts';
import { createFiniteEndpoint, createInfiniteEndpoint, createInterval } from '../contracts/domain';

/**
 * Safely negates an exact symbolic endpoint representation.
 */
export function negateEndpoint(endpoint: EndpointValue): EndpointValue {
  if (endpoint.kind === 'infinite') {
    return createInfiniteEndpoint(endpoint.sign === '+' ? '-' : '+');
  }

  const exact = endpoint.exact.trim();
  let newExact: string;

  if (exact === '0' || exact === '-0' || exact === '0.0') {
    newExact = '0';
  } else if (exact.startsWith('-(') && exact.endsWith(')')) {
    newExact = exact.slice(2, -1);
  } else if (exact.startsWith('-')) {
    newExact = exact.slice(1);
  } else if (exact.includes('+') || exact.includes('-')) {
    newExact = `-(${exact})`;
  } else {
    newExact = `-${exact}`;
  }

  const approx = endpoint.numericApprox !== undefined
    ? (endpoint.numericApprox === 0 ? 0 : -endpoint.numericApprox)
    : undefined;

  return createFiniteEndpoint(newExact, approx);
}

export type ReversalPolicy = 'finite_reflection' | 'uniform_negation';

/**
 * Reverses a single parameter interval.
 */
export function reverseInterval(
  interval: ParameterInterval,
  policy: ReversalPolicy = 'uniform_negation',
): ParameterInterval {
  if (
    policy === 'finite_reflection' &&
    interval.min.kind === 'finite' &&
    interval.max.kind === 'finite'
  ) {
    // For single finite interval [a, b]: reflection t = a + b - u
    // Lower bound becomes a with previous upper inclusion; upper bound becomes b with previous lower inclusion
    return createInterval(
      interval.min,
      interval.maxInclusive,
      interval.max,
      interval.minInclusive,
    );
  }

  // Uniform negation fallback: t = -u
  // Lower bound becomes -max; upper bound becomes -min
  const newMin = negateEndpoint(interval.max);
  const newMax = negateEndpoint(interval.min);

  return createInterval(
    newMin,
    interval.maxInclusive,
    newMax,
    interval.minInclusive,
  );
}

/**
 * Reverses an entire parameter domain coherently.
 *
 * For a union of intervals I_1 < I_2 < ... < I_k:
 * In increasing reverse parameter u, the curve must traverse in reverse spatial order.
 * Since t = -u maps higher t to lower u, the transformed segments must be ordered
 * such that increasing u traverses the segments in reverse order: -I_k, -I_{k-1}, ..., -I_1.
 */
export function reverseDomain(
  domain: ParameterDomain,
  preferReflectionForSingleFinite: boolean = true,
): { domain: ParameterDomain; policyUsed: ReversalPolicy } {
  if (domain.intervals.length === 0) {
    return {
      domain: { intervals: [], description: 'Empty domain' },
      policyUsed: 'uniform_negation',
    };
  }

  // Check if single finite interval
  const isSingleFinite =
    domain.intervals.length === 1 &&
    domain.intervals[0]!.min.kind === 'finite' &&
    domain.intervals[0]!.max.kind === 'finite';

  if (isSingleFinite && preferReflectionForSingleFinite) {
    const orig = domain.intervals[0]!;
    const reversed = reverseInterval(orig, 'finite_reflection');
    return {
      domain: {
        intervals: [reversed],
        description: domain.description ? `Reversed: ${domain.description}` : undefined,
      },
      policyUsed: 'finite_reflection',
    };
  }

  // Uniform negation for unions or infinite intervals
  // Reverse segment order: last segment becomes first
  const transformedIntervals: ParameterInterval[] = [];
  for (let i = domain.intervals.length - 1; i >= 0; i--) {
    const inv = domain.intervals[i]!;
    transformedIntervals.push(reverseInterval(inv, 'uniform_negation'));
  }

  return {
    domain: {
      intervals: transformedIntervals,
      description: domain.description ? `Reversed: ${domain.description}` : undefined,
    },
    policyUsed: 'uniform_negation',
  };
}

/**
 * Creates traversal metadata for downstream V6 geometry generation and V9 animation.
 */
export function createTraversalMetadata(options: {
  orientation: TraversalDirection;
  policyUsed: 'identity' | 'finite_reflection' | 'uniform_negation';
  domain: ParameterDomain;
  isClosed?: boolean;
  isPeriodic?: boolean;
  period?: string;
  reflectionFormula?: string;
}): CurveTraversalMetadata {
  const { orientation, policyUsed, domain, isClosed, isPeriodic, period } = options;

  let formula = 't = t';
  if (orientation === 'reverse') {
    if (policyUsed === 'finite_reflection') {
      formula = options.reflectionFormula ?? 't = a + b - u';
    } else {
      formula = 't = -u';
    }
  }

  const hasInfinite = domain.intervals.some(
    (iv) => iv.min.kind === 'infinite' || iv.max.kind === 'infinite',
  );

  return {
    orientation,
    parameterMapping: {
      type: policyUsed,
      formula,
      canonicalParam: 't',
      orientedParam: orientation === 'forward' ? 't' : 't',
    },
    isClosed: Boolean(isClosed),
    isPeriodic: Boolean(isPeriodic),
    period,
    segmentCount: domain.intervals.length,
    disjointGapsPreserved: domain.intervals.length > 1,
    infiniteDomainNote: hasInfinite
      ? 'Parameter domain is unbounded. Display traversal in V6/V9 will use a bounded calculation window as a rendering choice.'
      : undefined,
  };
}
