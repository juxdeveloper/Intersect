import { describe, it, expect } from 'vitest';
import {
  DEFAULT_CALCULATION_BOUNDS,
  INITIAL_REFERENCE_BOUNDS,
  validateBounds,
  createFiniteEndpoint,
  createInfiniteEndpoint,
  createInterval,
  validateInterval,
  validateDomain,
  formatInterval,
  formatDomain,
  isVerifiedCurveResult,
  isUncertainResult,
  isDegenerateResult,
  validateCalculationRequest,
  createCalculationRequest,
  isFreshWorkerMessage,
  validateSavedRecord,
  type ParameterDomain,
  type CalculationResult,
  type VerifiedCurveResult,
  type InconclusiveResult,
  type DegenerateResult,
  type WorkerResponse,
  type SavedCalculationRecord,
} from '../index';

describe('Contracts — Spatial Bounds', () => {
  it('validates default calculation and reference bounds successfully', () => {
    expect(validateBounds(DEFAULT_CALCULATION_BOUNDS)).toEqual({ valid: true });
    expect(validateBounds(INITIAL_REFERENCE_BOUNDS)).toEqual({ valid: true });
  });

  it('rejects inverted or contradictory bounds', () => {
    const invertedBounds = {
      x: { min: 100, max: -100 },
      y: { min: -50, max: 50 },
      z: { min: -50, max: 50 },
    };
    const res = validateBounds(invertedBounds);
    expect(res.valid).toBe(false);
    expect(res.error).toContain('X-axis minimum (100) must be strictly less than maximum (-100)');
  });

  it('rejects non-finite bound values', () => {
    const nonFinite = {
      x: { min: -Infinity, max: 1000 },
      y: { min: -50, max: 50 },
      z: { min: -50, max: 50 },
    };
    const res = validateBounds(nonFinite);
    expect(res.valid).toBe(false);
    expect(res.error).toContain('X-axis bounds must be finite numbers');
  });
});

describe('Contracts — Parameter Domain & JSON Round-Trip', () => {
  it('losslessly serializes and restores exact endpoints with JSON without producing null, NaN, or Infinity', () => {
    const domain: ParameterDomain = {
      intervals: [
        createInterval(
          createFiniteEndpoint('0', 0),
          true,
          createFiniteEndpoint('2*pi', 2 * Math.PI),
          false,
        ),
      ],
      description: 'Standard periodic cylinder cross-section interval [0, 2*pi)',
    };

    const json = JSON.stringify(domain);
    // Standard JSON turns native Infinity/NaN into null; ensure our JSON serialization is clean
    expect(json).not.toContain('null');
    expect(json).not.toContain('NaN');
    expect(json).not.toContain('Infinity');

    const restored: ParameterDomain = JSON.parse(json);
    expect(restored).toEqual(domain);
    expect(restored.intervals[0]?.min.kind).toBe('finite');
    expect(restored.intervals[0]?.max.kind).toBe('finite');
  });

  it('losslessly serializes infinite endpoints (+inf, -inf) without native Infinity', () => {
    const unboundedDomain: ParameterDomain = {
      intervals: [
        createInterval(
          createInfiniteEndpoint('-'),
          false,
          createInfiniteEndpoint('+'),
          false,
        ),
      ],
    };

    const json = JSON.stringify(unboundedDomain);
    expect(json).not.toContain('Infinity');
    expect(json).not.toContain('null');

    const restored: ParameterDomain = JSON.parse(json);
    expect(restored.intervals[0]?.min).toEqual({ kind: 'infinite', sign: '-' });
    expect(restored.intervals[0]?.max).toEqual({ kind: 'infinite', sign: '+' });
  });

  it('detects contradictory finite intervals where min > max', () => {
    const badInterval = createInterval(
      createFiniteEndpoint('5', 5),
      true,
      createFiniteEndpoint('2', 2),
      true,
    );
    const result = validateInterval(badInterval);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Contradictory interval');
  });

  it('detects empty interval with identical bounds and exclusive bracket', () => {
    const emptyInterval = createInterval(
      createFiniteEndpoint('3', 3),
      true,
      createFiniteEndpoint('3', 3),
      false, // [3, 3) contains no points
    );
    const result = validateInterval(emptyInterval);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Empty interval');
  });

  it('rejects invalid or inclusive infinite endpoints', () => {
    // Lower bound cannot be +inf
    const badLower = createInterval(
      createInfiniteEndpoint('+'),
      false,
      createFiniteEndpoint('10', 10),
      false,
    );
    expect(validateInterval(badLower).valid).toBe(false);

    // Negative infinity cannot be closed/inclusive
    const closedNegInf = {
      min: createInfiniteEndpoint('-'),
      minInclusive: true, // Invalid!
      max: createFiniteEndpoint('10', 10),
      maxInclusive: true,
    };
    expect(validateInterval(closedNegInf).valid).toBe(false);
  });

  it('validates and formats domain with standard mathematical notation', () => {
    const periodicDomain: ParameterDomain = {
      intervals: [
        createInterval(
          createFiniteEndpoint('0', 0),
          true,
          createFiniteEndpoint('2*pi', 2 * Math.PI),
          false,
        ),
      ],
    };

    expect(validateDomain(periodicDomain)).toEqual({ valid: true });
    expect(formatInterval(periodicDomain.intervals[0]!, 't')).toBe('0 ≤ t < 2*pi');
    expect(formatDomain(periodicDomain, 't')).toBe('0 ≤ t < 2*pi');

    const halfOpenDomain: ParameterDomain = {
      intervals: [
        createInterval(
          createFiniteEndpoint('1', 1),
          false,
          createInfiniteEndpoint('+'),
          false,
        ),
      ],
    };
    expect(formatInterval(halfOpenDomain.intervals[0]!, 't')).toBe('1 < t');
  });
});

describe('Contracts — Result Separation & Mathematical Honesty', () => {
  const verifiedResult: VerifiedCurveResult = {
    status: 'verified-curve',
    curve: {
      paramSymbol: 't',
      x: '2*cos(t)',
      y: '2*sin(t)',
      z: '2*cos(t) + 2*sin(t)',
      domain: {
        intervals: [
          createInterval(
            createFiniteEndpoint('0', 0),
            true,
            createFiniteEndpoint('2*pi', 2 * Math.PI),
            false,
          ),
        ],
      },
      direction: 'forward',
      verification: {
        status: 'verified',
        scope: 'Algebraically verified for t in [0, 2*pi)',
        surfaceFIdentityHolds: true,
        surfaceGIdentityHolds: true,
        domainSingularitiesChecked: true,
        method: 'symbolic_identity',
        verifiedAt: 1700000000000,
      },
    },
    derivation: {
      strategyName: 'Cylindrical Projection',
      steps: [
        {
          stepNumber: 1,
          title: 'Parameterize cylinder base',
          formulaText: 'x^2 + y^2 = 4 => x(t) = 2*cos(t), y(t) = 2*sin(t)',
          explanation: 'Standard circular parameterization with t in [0, 2*pi).',
        },
      ],
    },
    componentScope: 'Single continuous closed curve',
  };

  const inconclusiveResult: InconclusiveResult = {
    status: 'inconclusive',
    bounds: DEFAULT_CALCULATION_BOUNDS,
    reasonCode: 'search_exhausted',
    message: 'Could not determine an exact parameterization within the calculation bounds.',
    searchDetails: 'Algebraic search exhausted without finding a rational parameterization.',
  };

  const degenerateResult: DegenerateResult = {
    status: 'degenerate',
    nature: 'isolated-point',
    message: 'Surfaces intersect at a single isolated point, not a 1D curve.',
    explanation: 'The system has a unique real solution (0, 0, 0).',
    points: [{ x: '0', y: '0', z: '0' }],
  };

  it('correctly discriminates verified curve vs uncertainty or degeneracy', () => {
    expect(isVerifiedCurveResult(verifiedResult)).toBe(true);
    expect(isVerifiedCurveResult(inconclusiveResult)).toBe(false);
    expect(isVerifiedCurveResult(degenerateResult)).toBe(false);

    expect(isUncertainResult(inconclusiveResult)).toBe(true);
    expect(isUncertainResult(verifiedResult)).toBe(false);

    expect(isDegenerateResult(degenerateResult)).toBe(true);
    expect(isDegenerateResult(verifiedResult)).toBe(false);
  });

  it('serializes and deserializes calculation results losslessly', () => {
    const json = JSON.stringify(verifiedResult);
    const parsed: CalculationResult = JSON.parse(json);
    expect(parsed.status).toBe('verified-curve');
    if (isVerifiedCurveResult(parsed)) {
      expect(parsed.curve.paramSymbol).toBe('t');
      expect(parsed.curve.verification.surfaceFIdentityHolds).toBe(true);
    }
  });
});

describe('Contracts — Calculation Request & Worker Envelopes', () => {
  it('validates a well-formed calculation request', () => {
    const req = createCalculationRequest('x^2 + y^2 = 4', 'z = x + y', 'forward');
    const result = validateCalculationRequest(req);
    expect(result.valid).toBe(true);
  });

  it('rejects calculation request with empty surface inputs', () => {
    const req = createCalculationRequest('   ', 'z = x + y', 'forward');
    const result = validateCalculationRequest(req);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Surface F equation cannot be empty');
  });

  it('enforces fresh vs stale worker message tracking', () => {
    const activeJobId = 'job-active-123';

    const matchingResponse: WorkerResponse = {
      requestId: 'req-1',
      protocolVersion: '1.0.0',
      type: 'progress',
      jobId: 'job-active-123',
      percent: 50,
      stage: 'Eliminating variables',
    };

    const staleResponse: WorkerResponse = {
      requestId: 'req-0',
      protocolVersion: '1.0.0',
      type: 'progress',
      jobId: 'job-stale-999',
      percent: 100,
      stage: 'Old job finished late',
    };

    expect(isFreshWorkerMessage(matchingResponse, activeJobId)).toBe(true);
    expect(isFreshWorkerMessage(staleResponse, activeJobId)).toBe(false);
  });

  it('validates saved calculation schema adherence', () => {
    const savedRecord: SavedCalculationRecord = {
      id: 'calc-rec-1',
      schemaVersion: 1,
      createdAt: Date.now(),
      request: createCalculationRequest('x^2 + y^2 = 4', 'z = x + y'),
      result: {
        status: 'inconclusive',
        bounds: DEFAULT_CALCULATION_BOUNDS,
        reasonCode: 'timeout',
        message: 'Calculation timed out',
      },
      curveColor: '#f3edd8',
      title: 'Cylinder and plane',
    };

    expect(validateSavedRecord(savedRecord)).toBe(true);
    expect(validateSavedRecord({ invalid: true })).toBe(false);
  });
});
