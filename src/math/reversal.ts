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