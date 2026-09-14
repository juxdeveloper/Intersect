/**
 * Exact curve and verification contracts for Intersect.
 *
 * Mathematical Integrity:
 * - `ExactCurve` stores the exact symbolic components (x(t), y(t), z(t)), the parameter domain,
 *   traversal direction, and an explicit verification record.
 * - Numerical geometry samples (for 3D WebGL rendering) are strictly separated from `ExactCurve`.
 * - Traversal direction is either 'forward' (increasing t) or 'reverse'.
 *   When reversed, the curve formula and domain are mathematically transformed to match the reversed traversal.
 */

import type { ParameterDomain } from './domain';

export type TraversalDirection = 'forward' | 'reverse';

export interface VerificationRecord {
  /** 'verified' if symbolic proof succeeded across the domain; 'unverified' otherwise */
  readonly status: 'verified' | 'unverified';
  /** Explicit scope of the algebraic verification, including check on real denominators / radicals */
  readonly scope: string;
  /** Whether F(r(t)) = 0 simplified identically to zero */
  readonly surfaceFIdentityHolds: boolean;
  /** Whether G(r(t)) = 0 simplified identically to zero */
  readonly surfaceGIdentityHolds: boolean;
  /** Whether domain singularities (poles, branch cuts, complex numbers) were checked and excluded */
  readonly domainSingularitiesChecked: boolean;
  /** Verification methodology */
  readonly method: 'symbolic_identity' | 'algebraic_simplification' | 'unverified';
  /** Epoch timestamp in milliseconds when verification completed */
  readonly verifiedAt: number;
}

export interface CurveTraversalMetadata {
  /** Selected orientation: 'forward' (canonical +t) or 'reverse' */
  readonly orientation: TraversalDirection;
  /** Mathematical reparameterization applied relative to canonical parameter t */
  readonly parameterMapping: {
    readonly type: 'identity' | 'finite_reflection' | 'uniform_negation';
    readonly formula: string;
    readonly canonicalParam: string;
    readonly orientedParam: string;
  };
  /** Whether the curve forms a topologically closed loop over its domain */
  readonly isClosed: boolean;
  /** Whether the curve has established periodicity over the parameter interval */
  readonly isPeriodic: boolean;
  /** Period length if established (e.g. "2*pi") */
  readonly period?: string;
  /** Ordered list of disjoint parameter interval segments to traverse */
  readonly segmentCount: number;
  /** Explicit guarantee that gaps between disjoint intervals are preserved and never bridged */
  readonly disjointGapsPreserved: boolean;
  /** Traversal guidance for infinite domains: finite display window is a rendering choice for V6/V9 */
  readonly infiniteDomainNote?: string;
}

export interface ExactCurve {
  /** Parameter variable symbol, typically 't' */
  readonly paramSymbol: string;
  /** Exact string expression for x(t), e.g. "2*cos(t)" */
  readonly x: string;
  /** Exact string expression for y(t), e.g. "2*sin(t)" */
  readonly y: string;
  /** Exact string expression for z(t), e.g. "2*cos(t) + 2*sin(t)" */
  readonly z: string;
  /** Optional LaTeX representation for math rendering */
  readonly latex?: {
    readonly x: string;
    readonly y: string;
    readonly z: string;
  };
  /** Real parameter domain over which r(t) is verified */
  readonly domain: ParameterDomain;
  /** Direction of parameter traversal */
  readonly direction: TraversalDirection;
  /** Explicit verification record */
  readonly verification: VerificationRecord;
  /** Traversal metadata for Phase V6 geometry sampling and Phase V9 animation */
  readonly traversal?: CurveTraversalMetadata;
}

/**
 * Approximate numerical sample points generated solely for WebGL rendering in V6/V7.
 * Separated by design from the exact mathematical curve representation.
 */
export interface CurveRenderSamples {
  /** Flat array of [x0, y0, z0, x1, y1, z1, ...] */
  readonly positions: Float32Array | readonly number[];
  /** Parameter values corresponding to sample points [t0, t1, ...] */
  readonly tValues: readonly number[];
  /** Discontinuity breaks where the curve should not draw connecting line segments */
  readonly segmentBreaks: readonly number[];
}
