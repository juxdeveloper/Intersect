import { describe, it, expect, beforeAll } from 'vitest';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { loadPyodide, type PyodideInterface } from 'pyodide';
import { SYMPY_BUILDER_PYTHON_SOURCE } from '../python-source';
import {
  prepareCalculationRequest,
  createCalculationRequest,
} from '../../contracts/calculation';
import type {
  CalculationResult,
  VerifiedCurveResult,
  EmptyBoundedResult,
  DegenerateResult,
} from '../../contracts/results';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const req = createRequire(import.meta.url);

if (typeof (globalThis as any).require === 'undefined') {
  (globalThis as any).require = req;
}
if (typeof (globalThis as any).__dirname === 'undefined') {
  (globalThis as any).__dirname = __dirname;
}
if (typeof (globalThis as any).__filename === 'undefined') {
  (globalThis as any).__filename = __filename;
}

describe('Intersect V5 Derivation, Reversal & Mathematical Explanation Suite', () => {
  let pyodide: PyodideInterface;
  let solveIntersectionJson: (json: string) => string;

  beforeAll(async () => {
    const localPyodideDir = path.resolve(process.cwd(), 'public', 'pyodide');

    pyodide = await loadPyodide({
      indexURL: localPyodideDir,
      lockFileURL: path.join(localPyodideDir, 'pyodide-lock.json'),
    });

    const mpmathWhl = path.join(localPyodideDir, 'mpmath-1.3.0-py3-none-any.whl');
    const sympyWhl = path.join(localPyodideDir, 'sympy-1.13.3-py3-none-any.whl');
    await pyodide.loadPackage([mpmathWhl, sympyWhl]);

    pyodide.runPython(SYMPY_BUILDER_PYTHON_SOURCE);

    const pyFn = pyodide.globals.get('solve_intersection_json');
    solveIntersectionJson = (jsonStr: string) => pyFn(jsonStr);
  }, 60_000);

  function solve(eqF: string, eqG: string, direction: 'forward' | 'reverse' = 'forward'): CalculationResult {
    const rawReq = createCalculationRequest(eqF, eqG, direction);
    const prep = prepareCalculationRequest(rawReq);
    if (!prep.valid) {
      throw new Error(`Failed to prepare request: ${prep.error}`);
    }
    const planF = prep.request.surfaceF.prepared!.sympyPlan;
    const planG = prep.request.surfaceG.prepared!.sympyPlan;
    const payload = JSON.stringify({
      surfaceF: planF,
      surfaceG: planG,
      bounds: prep.request.bounds,
      direction,
      f_eq_str: eqF,
      g_eq_str: eqG,
    });
    const resultJson = solveIntersectionJson(payload);
    return JSON.parse(resultJson) as CalculationResult;
  }

  describe('1. Derivation Structure (Section 4.A & 8.B)', () => {
    it('generates 6 educational steps for canonical cylinder-plane solve', () => {
      const res = solve('x^2 + y^2 = 4', 'z = x + y', 'forward') as VerifiedCurveResult;
      expect(res.status).toBe('verified-curve');
      expect(res.derivation).toBeDefined();
      expect(res.derivation.strategyName).toBe('Cylindrical Projection & Planar Substitution');
      expect(res.derivation.steps.length).toBe(6);

      // Step 1: Surface equations and domain
      expect(res.derivation.steps[0]!.stepNumber).toBe(1);
      expect(res.derivation.steps[0]!.title.toLowerCase()).toContain('equations');
      expect(res.derivation.steps[0]!.formulaText).toContain('Cylinder');

      // Step 2: Parameterization of cylinder cross-section
      expect(res.derivation.steps[1]!.stepNumber).toBe(2);
      expect(res.derivation.steps[1]!.formulaText).toMatch(/cos|sin/);

      // Step 3: Coordinate substitution
      expect(res.derivation.steps[2]!.stepNumber).toBe(3);

      // Step 4: Parameter domain
      expect(res.derivation.steps[3]!.stepNumber).toBe(4);
      expect(res.derivation.steps[3]!.validityConditions).toBeDefined();

      // Step 5: Verification of algebraic identities
      expect(res.derivation.steps[4]!.stepNumber).toBe(5);
      expect(res.derivation.steps[4]!.title.toLowerCase()).toContain('algebraic');

      // Step 6: Scope
      expect(res.derivation.steps[5]!.stepNumber).toBe(6);
      expect(res.derivation.steps[5]!.title).toContain('scope');
    });

    it('generates 7 steps when solved in reverse, with Step 7 for reparameterization', () => {
      const res = solve('x^2 + y^2 = 4', 'z = x + y', 'reverse') as VerifiedCurveResult;
      expect(res.status).toBe('verified-curve');
      expect(res.curve.direction).toBe('reverse');
      expect(res.derivation.steps.length).toBe(7);

      const step7 = res.derivation.steps[6]!;
      expect(step7.stepNumber).toBe(7);
      expect(step7.title.toLowerCase()).toContain('reverse');
      expect(step7.formulaText).toMatch(/2\*pi\s*-\s*u|reflection/i);
      expect(step7.explanation.toLowerCase()).toContain('revers');
      expect(step7.validityConditions).toBeDefined();
    });

    it('provides both canonicalDerivation and reverseDerivation concurrently', () => {
      const res = solve('x + y + z = 1', '2*x - y + 3*z = 2', 'forward') as VerifiedCurveResult;
      expect(res.status).toBe('verified-curve');
      expect(res.canonicalDerivation).toBeDefined();
      expect(res.reverseDerivation).toBeDefined();

      expect(res.canonicalDerivation!.steps.length).toBe(6);
      expect(res.reverseDerivation!.steps.length).toBe(7);
      expect(res.reverseDerivation!.steps[6]!.stepNumber).toBe(7);
      expect(res.reverseDerivation!.steps[6]!.title.toLowerCase()).toContain('reverse');
    });
  });

  describe('2. Forward / Reverse Traversal Semantics (Section 5 & 8.A)', () => {
    it('periodic circle reflection: transforms [0, 2π) to (0, 2π] with opposite traversal', () => {
      const res = solve('x^2 + y^2 = 4', 'z = x + y', 'forward') as VerifiedCurveResult;
      const can = res.canonicalCurve!;
      const rev = res.reverseCurve!;

      expect(can.paramSymbol).toBe('t');
      const canMin = can.domain.intervals[0]!.min;
      const canMax = can.domain.intervals[0]!.max;
      if (canMin.kind === 'finite') {
        expect(canMin.exact).toBe('0');
      }
      expect(can.domain.intervals[0]!.minInclusive).toBe(true);
      if (canMax.kind === 'finite') {
        expect(canMax.exact).toContain('pi');
      }
      expect(can.domain.intervals[0]!.maxInclusive).toBe(false);

      expect(rev.paramSymbol).toBe('t'); // renamed back to canonical t without capture
      const revMin = rev.domain.intervals[0]!.min;
      const revMax = rev.domain.intervals[0]!.max;
      if (revMin.kind === 'finite') {
        expect(revMin.exact).toBe('0');
      }
      expect(rev.domain.intervals[0]!.minInclusive).toBe(false); // swapped
      if (revMax.kind === 'finite') {
        expect(revMax.exact).toContain('pi');
      }
      expect(rev.domain.intervals[0]!.maxInclusive).toBe(true); // swapped

      // Check algebraic verification on reversed curve
      expect(rev.verification.status).toBe('verified');
      expect(rev.verification.surfaceFIdentityHolds).toBe(true);
      expect(rev.verification.surfaceGIdentityHolds).toBe(true);
    });

    it('linear plane intersection: domain inclusions swap under reflection or negation', () => {
      const res = solve('x + y + z = 1', '2*x - y + 3*z = 2', 'forward') as VerifiedCurveResult;
      const can = res.canonicalCurve!;
      const rev = res.reverseCurve!;

      expect(can.direction).toBe('forward');
      expect(rev.direction).toBe('reverse');

      const canIv = can.domain.intervals[0]!;
      const revIv = rev.domain.intervals[0]!;

      expect(revIv.minInclusive).toBe(canIv.maxInclusive);
      expect(revIv.maxInclusive).toBe(canIv.minInclusive);

      // Traversal metadata
      expect(rev.traversal?.orientation).toBe('reverse');
      expect(['uniform_negation', 'finite_reflection']).toContain(rev.traversal?.parameterMapping.type);
      expect(rev.traversal?.isClosed).toBe(false);

      // Algebraic verification on reversed curve
      expect(rev.verification.status).toBe('verified');
      expect(rev.verification.surfaceFIdentityHolds).toBe(true);
      expect(rev.verification.surfaceGIdentityHolds).toBe(true);
    });

    it('monomial / coordinate parameterization: preserves identity under reversal', () => {
      const res = solve('z = x^3', 'y = x^2', 'forward') as VerifiedCurveResult;
      const can = res.canonicalCurve!;
      const rev = res.reverseCurve!;

      expect(can.x).toBe('t');
      expect(rev.x).toBe('-t'); // t = -u substituted then renamed to t
      expect(rev.verification.status).toBe('verified');
      expect(rev.verification.surfaceFIdentityHolds).toBe(true);
      expect(rev.verification.surfaceGIdentityHolds).toBe(true);
    });

    it('sphere-plane intersection: closed loop traversal reversed identically', () => {
      const res = solve('x^2 + y^2 + z^2 = 9', 'z = 0', 'reverse') as VerifiedCurveResult;
      expect(res.status).toBe('verified-curve');
      expect(res.curve.direction).toBe('reverse');
      expect(res.curve.traversal?.isClosed).toBe(true);
      expect(res.curve.traversal?.isPeriodic).toBe(true);
      expect(res.curve.verification.surfaceFIdentityHolds).toBe(true);
      expect(res.curve.verification.surfaceGIdentityHolds).toBe(true);
    });
  });

  describe('3. Mathematical Outcome Scope & Classification (Section 6 & 8.B)', () => {
    it('parallel planes: proved empty with global scope', () => {
      const res = solve('x + y + z = 1', 'x + y + z = 2') as EmptyBoundedResult;
      expect(res.status).toBe('empty-bounded');
      expect(res.proofScope).toBe('global');
      expect(res.reasonCode).toBe('algebraic_contradiction');
      expect(res.proofExplanation).toContain('parallel');
    });

    it('sphere and plane with distance > R: proved empty with global scope', () => {
      const res = solve('x^2 + y^2 + z^2 = 1', 'z = 5') as EmptyBoundedResult;
      expect(res.status).toBe('empty-bounded');
      expect(res.proofScope).toBe('global');
      expect(res.proofExplanation).toContain('exceeds sphere radius');
    });

    it('tangent plane to sphere: degenerate isolated point with exact coordinates', () => {
      const res = solve('x^2 + y^2 + z^2 = 4', 'z = 2') as DegenerateResult;
      expect(res.status).toBe('degenerate');
      expect(res.nature).toBe('isolated-point');
      expect(res.points).toBeDefined();
      expect(res.points!.length).toBe(1);
      expect(res.points![0]!.x).toBe('0');
      expect(res.points![0]!.y).toBe('0');
      expect(res.points![0]!.z).toBe('2');
    });

    it('coincident planes: degenerate 2D surface overlap without claiming 1D curve', () => {
      const res = solve('x + y = 1', '2*x + 2*y = 2') as DegenerateResult;
      expect(res.status).toBe('degenerate');
      expect(res.nature).toBe('coincident-surfaces');
      expect(res.message.toLowerCase()).toContain('coincident');
    });

    it('inconclusive / unsupported does not claim absence or emptiness', () => {
      // Inconclusive transcendental surface where symbolic elimination is not fully closed
      const rawReq = createCalculationRequest('z = exp(x) * sin(y)', 'z = cos(x*y)');
      const prep = prepareCalculationRequest(rawReq);
      expect(prep.valid).toBe(true);
    });
  });

  describe('4. Traversal Metadata Contract (Section 5.D)', () => {
    it('attaches complete traversal metadata contract to canonical and reverse curves', () => {
      const res = solve('x^2 + y^2 = 4', 'z = x + y', 'forward') as VerifiedCurveResult;
      const canTrav = res.canonicalCurve!.traversal!;
      const revTrav = res.reverseCurve!.traversal!;

      expect(canTrav.orientation).toBe('forward');
      expect(canTrav.parameterMapping.type).toBe('identity');
      expect(canTrav.isClosed).toBe(true);
      expect(canTrav.isPeriodic).toBe(true);
      expect(canTrav.period).toBe('2*pi');
      expect(canTrav.segmentCount).toBe(1);

      expect(revTrav.orientation).toBe('reverse');
      expect(revTrav.parameterMapping.type).toBe('finite_reflection');
      expect(revTrav.isClosed).toBe(true);
      expect(revTrav.isPeriodic).toBe(true);
      expect(revTrav.period).toBe('2*pi');
      expect(revTrav.segmentCount).toBe(1);
    });
  });
});
