import { describe, it, expect } from 'vitest';
import { sampleExactCurve } from '../curve-sampler';
import { GEOMETRY_BUDGET_PRESETS, type GeometryBudget } from '../../contracts/geometry';
import {
  createFiniteEndpoint,
  createInfiniteEndpoint,
  createInterval,
} from '../../contracts/domain';
import type { ExactCurve } from '../../contracts/curve';
import type { WorldBounds } from '../../contracts/bounds';

const REF_REGION_50: WorldBounds = {
  x: { min: -50, max: 50 },
  y: { min: -50, max: 50 },
  z: { min: -50, max: 50 },
};

const SMALL_REGION_5: WorldBounds = {
  x: { min: -5, max: 5 },
  y: { min: -5, max: 5 },
  z: { min: -5, max: 5 },
};

describe('Intersect V6 Adaptive Curve Sampler', () => {
  const defaultBudget = GEOMETRY_BUDGET_PRESETS.default;

  it('1. Reference Curve (2 cos(t), 2 sin(t), 2 cos(t) + 2 sin(t)): samples follow exact locus and direction', () => {
    const curve: ExactCurve = {
      paramSymbol: 't',
      x: '2*cos(t)',
      y: '2*sin(t)',
      z: '2*cos(t) + 2*sin(t)',
      domain: {
        intervals: [
          createInterval(createFiniteEndpoint('0', 0), true, createFiniteEndpoint('2*pi', 2 * Math.PI), false),
        ],
      },
      direction: 'forward',
      traversal: {
        orientation: 'forward',
        parameterMapping: { type: 'identity', formula: 't = t', canonicalParam: 't', orientedParam: 't' },
        isClosed: true,
        isPeriodic: true,
        period: '2*pi',
        segmentCount: 1,
        disjointGapsPreserved: true,
      },
      verification: {
        status: 'verified',
        scope: 'Algebraically verified on t in [0, 2pi)',
        surfaceFIdentityHolds: true,
        surfaceGIdentityHolds: true,
        domainSingularitiesChecked: true,
        method: 'symbolic_identity',
        verifiedAt: 1700000000000,
      },
    };

    const sampled = sampleExactCurve(curve, REF_REGION_50, defaultBudget);

    expect(sampled.status).toBe('success');
    expect(sampled.sampleCount).toBeGreaterThanOrEqual(30);
    expect(sampled.segmentCount).toBe(1);
    expect(sampled.isClosed).toBe(true);

    // Verify samples lie on cylinder x^2 + y^2 = 4 and plane z = x + y
    for (let i = 0; i < sampled.sampleCount; i++) {
      const x = sampled.positions[i * 3]!;
      const y = sampled.positions[i * 3 + 1]!;
      const z = sampled.positions[i * 3 + 2]!;
      const rSq = x * x + y * y;
      expect(Math.abs(rSq - 4)).toBeLessThan(1e-3);
      expect(Math.abs(z - (x + y))).toBeLessThan(1e-3);
    }

    // Verify t values are strictly monotonically increasing
    for (let i = 1; i < sampled.sampleCount; i++) {
      expect(sampled.tValues[i]!).toBeGreaterThan(sampled.tValues[i - 1]!);
    }
  });

  it('2. Forward vs Reverse: identical geometric locus, opposite traversal order, no double reversal', () => {
    const fwdCurve: ExactCurve = {
      paramSymbol: 't',
      x: '2*cos(t)',
      y: '2*sin(t)',
      z: '2*cos(t) + 2*sin(t)',
      domain: {
        intervals: [
          createInterval(createFiniteEndpoint('0', 0), true, createFiniteEndpoint('2*pi', 2 * Math.PI), false),
        ],
      },
      direction: 'forward',
      traversal: {
        orientation: 'forward',
        parameterMapping: { type: 'identity', formula: 't = t', canonicalParam: 't', orientedParam: 't' },
        isClosed: true,
        isPeriodic: true,
        period: '2*pi',
        segmentCount: 1,
        disjointGapsPreserved: true,
      },
      verification: {
        status: 'verified',
        scope: 'Verified forward',
        surfaceFIdentityHolds: true,
        surfaceGIdentityHolds: true,
        domainSingularitiesChecked: true,
        method: 'symbolic_identity',
        verifiedAt: 1700000000000,
      },
    };

    const revCurve: ExactCurve = {
      paramSymbol: 'u',
      x: '2*cos(-u)',
      y: '2*sin(-u)',
      z: '2*cos(-u) + 2*sin(-u)',
      domain: {
        intervals: [
          createInterval(createFiniteEndpoint('0', 0), false, createFiniteEndpoint('2*pi', 2 * Math.PI), true),
        ],
      },
      direction: 'reverse',
      traversal: {
        orientation: 'reverse',
        parameterMapping: { type: 'finite_reflection', formula: 't = 2*pi - u', canonicalParam: 't', orientedParam: 'u' },
        isClosed: true,
        isPeriodic: true,
        period: '2*pi',
        segmentCount: 1,
        disjointGapsPreserved: true,
      },
      verification: {
        status: 'verified',
        scope: 'Verified reverse',
        surfaceFIdentityHolds: true,
        surfaceGIdentityHolds: true,
        domainSingularitiesChecked: true,
        method: 'symbolic_identity',
        verifiedAt: 1700000000000,
      },
    };

    const fwdSamples = sampleExactCurve(fwdCurve, REF_REGION_50, defaultBudget);
    const revSamples = sampleExactCurve(revCurve, REF_REGION_50, defaultBudget);

    expect(fwdSamples.status).toBe('success');
    expect(revSamples.status).toBe('success');

    // Both curves must span the same spatial bounding box within tolerance
    expect(fwdSamples.boundingBox).not.toBeNull();
    expect(revSamples.boundingBox).not.toBeNull();

    expect(Math.abs(fwdSamples.boundingBox!.x.min - revSamples.boundingBox!.x.min)).toBeLessThan(0.05);
    expect(Math.abs(fwdSamples.boundingBox!.x.max - revSamples.boundingBox!.x.max)).toBeLessThan(0.05);
    expect(Math.abs(fwdSamples.boundingBox!.y.min - revSamples.boundingBox!.y.min)).toBeLessThan(0.05);
    expect(Math.abs(fwdSamples.boundingBox!.y.max - revSamples.boundingBox!.y.max)).toBeLessThan(0.05);

    // Initial forward trajectory should move in +Y direction (dy/dt at t=0 is 2 > 0)
    const fwdY0 = fwdSamples.positions[1]!;
    const fwdY1 = fwdSamples.positions[4]!;
    expect(fwdY1).toBeGreaterThan(fwdY0);

    // Initial reverse trajectory should move in -Y direction (dy/du at u=0 is -2 < 0)
    const revY0 = revSamples.positions[1]!;
    const revY1 = revSamples.positions[4]!;
    expect(revY1).toBeLessThan(revY0);
  });

  it('3. Clipped Line: crossings of render box are preserved even if coarse endpoints lie outside', () => {
    // r(t) = (t, 2*t, 0) for t in [-20, 20]
    // In SMALL_REGION_5 ([-5, 5]^3), the line crosses x in [-2.5, 2.5], y in [-5, 5].
    const curve: ExactCurve = {
      paramSymbol: 't',
      x: 't',
      y: '2*t',
      z: '0',
      domain: {
        intervals: [
          createInterval(createFiniteEndpoint('-20', -20), true, createFiniteEndpoint('20', 20), true),
        ],
      },
      direction: 'forward',
      verification: {
        status: 'verified',
        scope: 'Line',
        surfaceFIdentityHolds: true,
        surfaceGIdentityHolds: true,
        domainSingularitiesChecked: true,
        method: 'symbolic_identity',
        verifiedAt: 1700000000000,
      },
    };

    const sampled = sampleExactCurve(curve, SMALL_REGION_5, defaultBudget);

    expect(sampled.status).toBe('success');
    expect(sampled.sampleCount).toBeGreaterThan(0);

    // All sample coordinates must be strictly within [-5, 5]
    for (let i = 0; i < sampled.sampleCount; i++) {
      const x = sampled.positions[i * 3]!;
      const y = sampled.positions[i * 3 + 1]!;
      expect(x).toBeGreaterThanOrEqual(-2.501);
      expect(x).toBeLessThanOrEqual(2.501);
      expect(y).toBeGreaterThanOrEqual(-5.001);
      expect(y).toBeLessThanOrEqual(5.001);
    }
  });

  it('4. Oscillatory curve with midpoint on chord: multi-point check detects oscillation', () => {
    // r(t) = (t, sin(64*pi*t), 0) on t in [0, 1]
    // Coarse segments of length 1/32 have endpoints at sin(2*pi*k) = 0
    // and midpoints at sin(2*pi*k + pi) = 0 (EXACTLY ON CHORD!)
    // Midpoint-only check would see 0 deviation everywhere and miss the oscillations completely.
    const curve: ExactCurve = {
      paramSymbol: 't',
      x: 't',
      y: 'sin(64*pi*t)',
      z: '0',
      domain: {
        intervals: [
          createInterval(createFiniteEndpoint('0', 0), true, createFiniteEndpoint('1', 1), true),
        ],
      },
      direction: 'forward',
      verification: {
        status: 'verified',
        scope: 'Oscillatory curve',
        surfaceFIdentityHolds: true,
        surfaceGIdentityHolds: true,
        domainSingularitiesChecked: true,
        method: 'symbolic_identity',
        verifiedAt: 1700000000000,
      },
    };

    const sampled = sampleExactCurve(curve, SMALL_REGION_5, defaultBudget);

    expect(sampled.status).toBe('success');
    // Multi-point interior sampling (1/3 and 2/3) detected oscillation
    // and subdivided the curve to achieve a smooth wave with peak amplitude ~1
    expect(sampled.boundingBox!.y.max).toBeGreaterThan(0.9);
    expect(sampled.boundingBox!.y.min).toBeLessThan(-0.9);
    expect(sampled.diagnostics.subdivisions).toBeGreaterThan(0);
  });

  it('5. Curve with pole / domain gap: separate segments, no bridge across invalid region', () => {
    // r(t) = (t, 1/t, 0) on [-2, 2] with t != 0
    // Represented as two disjoint intervals [-2, -0.1] and [0.1, 2]
    const curve: ExactCurve = {
      paramSymbol: 't',
      x: 't',
      y: '1/t',
      z: '0',
      domain: {
        intervals: [
          createInterval(createFiniteEndpoint('-2', -2), true, createFiniteEndpoint('-0.1', -0.1), true),
          createInterval(createFiniteEndpoint('0.1', 0.1), true, createFiniteEndpoint('2', 2), true),
        ],
      },
      direction: 'forward',
      traversal: {
        orientation: 'forward',
        parameterMapping: { type: 'identity', formula: 't = t', canonicalParam: 't', orientedParam: 't' },
        isClosed: false,
        isPeriodic: false,
        segmentCount: 2,
        disjointGapsPreserved: true,
      },
      verification: {
        status: 'verified',
        scope: 'Hyperbola branches',
        surfaceFIdentityHolds: true,
        surfaceGIdentityHolds: true,
        domainSingularitiesChecked: true,
        method: 'symbolic_identity',
        verifiedAt: 1700000000000,
      },
    };

    const sampled = sampleExactCurve(curve, REF_REGION_50, defaultBudget);

    expect(sampled.status).toBe('success');
    // Must have at least 2 distinct segment breaks (no connecting bridge across t=0)
    expect(sampled.segmentCount).toBeGreaterThanOrEqual(2);
    expect(sampled.segmentBreaks.length).toBeGreaterThanOrEqual(2);

    // Verify segment breaks: points before and after a break must not bridge the gap
    const breakIdx = sampled.segmentBreaks[1]!;
    const ptBefore = sampled.positions[(breakIdx - 1) * 3 + 1]!; // y coordinate before break (< 0)
    const ptAfter = sampled.positions[breakIdx * 3 + 1]!; // y coordinate after break (> 0)
    expect(ptBefore).toBeLessThan(0);
    expect(ptAfter).toBeGreaterThan(0);
  });

  it('6. Cusp / stationary point: r(t) = (t^2, t^3, 0) retains valid geometry at t = 0', () => {
    const curve: ExactCurve = {
      paramSymbol: 't',
      x: 't^2',
      y: 't^3',
      z: '0',
      domain: {
        intervals: [
          createInterval(createFiniteEndpoint('-2', -2), true, createFiniteEndpoint('2', 2), true),
        ],
      },
      direction: 'forward',
      verification: {
        status: 'verified',
        scope: 'Neile cusp',
        surfaceFIdentityHolds: true,
        surfaceGIdentityHolds: true,
        domainSingularitiesChecked: true,
        method: 'symbolic_identity',
        verifiedAt: 1700000000000,
      },
    };

    const sampled = sampleExactCurve(curve, SMALL_REGION_5, defaultBudget);

    expect(sampled.status).toBe('success');
    expect(sampled.sampleCount).toBeGreaterThan(20);
    // Bounding box x in [0, 4], y in [-8, 8] clipped to [-5, 5]
    expect(sampled.boundingBox!.x.min).toBeCloseTo(0, 0.1);
    expect(sampled.boundingBox!.x.max).toBeLessThanOrEqual(5.001);
  });

  it('7. Unbounded parameter domain: bounded numerical window policy with explicit metadata', () => {
    // Infinite line r(t) = (t, t, t) on (-inf, +inf)
    const curve: ExactCurve = {
      paramSymbol: 't',
      x: 't',
      y: 't',
      z: 't',
      domain: {
        intervals: [
          createInterval(createInfiniteEndpoint('-'), false, createInfiniteEndpoint('+'), false),
        ],
      },
      direction: 'forward',
      verification: {
        status: 'verified',
        scope: 'Unbounded line',
        surfaceFIdentityHolds: true,
        surfaceGIdentityHolds: true,
        domainSingularitiesChecked: true,
        method: 'symbolic_identity',
        verifiedAt: 1700000000000,
      },
    };

    const sampled = sampleExactCurve(curve, SMALL_REGION_5, defaultBudget);

    expect(sampled.status).toBe('success');
    expect(sampled.sampleCount).toBeGreaterThan(0);
    // Verified: no infinite endpoint was evaluated
    for (let i = 0; i < sampled.sampleCount; i++) {
      expect(Number.isFinite(sampled.tValues[i]!)).toBe(true);
    }
    // Clipped within [-5, 5]
    expect(sampled.boundingBox!.x.min).toBeGreaterThanOrEqual(-5.001);
    expect(sampled.boundingBox!.x.max).toBeLessThanOrEqual(5.001);
  });

  it('8. Enforces sample budget: returns partial status when sample limit is reached', () => {
    const tinyBudget: GeometryBudget = {
      gridResolution: 30,
      maxVerticesPerMesh: 1000,
      maxTrianglesPerMesh: 1000,
      maxCurveSamples: 15, // very tiny limit
      maxCurveSubdivisionDepth: 4,
      curveGeometricTolerance: 0.001,
      maxDurationMs: 10_000,
    };

    const curve: ExactCurve = {
      paramSymbol: 't',
      x: '2*cos(t)',
      y: '2*sin(t)',
      z: '2*cos(t) + 2*sin(t)',
      domain: {
        intervals: [
          createInterval(createFiniteEndpoint('0', 0), true, createFiniteEndpoint('2*pi', 2 * Math.PI), false),
        ],
      },
      direction: 'forward',
      verification: {
        status: 'verified',
        scope: 'Test',
        surfaceFIdentityHolds: true,
        surfaceGIdentityHolds: true,
        domainSingularitiesChecked: true,
        method: 'symbolic_identity',
        verifiedAt: 1700000000000,
      },
    };

    const sampled = sampleExactCurve(curve, REF_REGION_50, tinyBudget);

    expect(sampled.status).toBe('partial-budget-limited');
    expect(sampled.sampleCount).toBeLessThanOrEqual(25);
  });
});
