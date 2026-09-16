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
  InconclusiveResult,
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

describe('Intersect V13 Global Coverage & Branch Completeness Solver Tests', () => {
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
    solveIntersectionJson = (jsonStr: string) => {
      return pyFn(jsonStr);
    };
  }, 60_000);

  function solve(eqF: string, eqG: string, direction: 'forward' | 'reverse' = 'forward'): CalculationResult {
    const rawReq = createCalculationRequest(eqF, eqG, direction);
    const prep = prepareCalculationRequest(rawReq);
    if (!prep.valid) {
      throw new Error(`Failed to prepare request: ${prep.error}`);
    }
    const jsonStr = JSON.stringify(prep.request);
    const resultJson = solveIntersectionJson(jsonStr);
    return JSON.parse(resultJson) as CalculationResult;
  }

  describe('1. Mandatory Regression Case: x^2 + y^2 = 4 and z = sin(x*y)', () => {
    it('rejects partial semicircle (t, sqrt(4-t^2), ...) and finds complete global parameterization', () => {
      const res = solve('x^2 + y^2 = 4', 'z = \\sin(x y)', 'forward');
      expect(res.status).toBe('verified-curve');
      const v = res as VerifiedCurveResult;

      // Must be trigonometric parameterization covering complete circle
      expect(v.curve.x).toContain('cos(t)');
      expect(v.curve.y).toContain('sin(t)');
      // Must NOT be the incomplete square-root Cartesian branch
      expect(v.curve.y).not.toContain('sqrt(4');
      expect(v.curve.x).not.toBe('t');

      // Formula for z(t) must simplify to sin(2*sin(2*t))
      expect(v.curve.z).toBe('sin(2*sin(2*t))');

      // Fundamental interval must be [0, 2*pi)
      expect(v.curve.domain.intervals).toHaveLength(1);
      const iv = v.curve.domain.intervals[0]!;
      expect((iv.min as any).exact).toBe('0');
      expect((iv.max as any).exact).toBe('2*pi');
      expect(iv.minInclusive).toBe(true);
      expect(iv.maxInclusive).toBe(false);

      // Explicit verification flags
      expect(v.curve.verification.status).toBe('verified');
      expect(v.curve.verification.surfaceFIdentityHolds).toBe(true);
      expect(v.curve.verification.surfaceGIdentityHolds).toBe(true);
    });

    it('correctly applies Reverse orientation to x^2 + y^2 = 4 and z = sin(x*y) without altering geometric set', () => {
      const resRev = solve('x^2 + y^2 = 4', 'z = \\sin(x y)', 'reverse');
      expect(resRev.status).toBe('verified-curve');
      const vRev = resRev as VerifiedCurveResult;

      expect(vRev.curve.traversal!.orientation).toBe('reverse');
      // Under t -> 2*pi - t: x(t) = 2*cos(t), y(t) = -2*sin(t), z(t) = -sin(2*sin(2*t))
      expect(vRev.curve.x).toBe('2*cos(t)');
      expect(vRev.curve.y).toBe('-2*sin(t)');
      expect(vRev.curve.z).toBe('-sin(2*sin(2*t))');

      // Parameter domain remains fundamental [0, 2*pi)
      expect((vRev.curve.domain.intervals[0]!.min as any).exact).toBe('0');
      expect((vRev.curve.domain.intervals[0]!.max as any).exact).toBe('2*pi');

      // Surface identities still hold identically
      expect(vRev.curve.verification.surfaceFIdentityHolds).toBe(true);
      expect(vRev.curve.verification.surfaceGIdentityHolds).toBe(true);
    });
  });

  describe('2. Complete Circles and Ellipses with Non-Planar and Planar Surfaces', () => {
    it('solves circular cylinder with plane: x^2 + y^2 = 9 and z = x + y', () => {
      const res = solve('x^2 + y^2 = 9', 'z = x + y');
      expect(res.status).toBe('verified-curve');
      const v = res as VerifiedCurveResult;

      expect(v.curve.x).toBe('3*cos(t)');
      expect(v.curve.y).toBe('3*sin(t)');
      expect((v.curve.domain.intervals[0]!.max as any).exact).toBe('2*pi');
      expect(v.curve.verification.surfaceFIdentityHolds).toBe(true);
      expect(v.curve.verification.surfaceGIdentityHolds).toBe(true);
    });

    it('solves elliptic cylinder with plane: x^2/4 + y^2/9 = 1 and z = 2*x - y', () => {
      const res = solve('\\frac{x^2}{4} + \\frac{y^2}{9} = 1', 'z = 2 x - y');
      expect(res.status).toBe('verified-curve');
      const v = res as VerifiedCurveResult;

      expect(v.curve.x).toBe('2*cos(t)');
      expect(v.curve.y).toBe('3*sin(t)');
      expect((v.curve.domain.intervals[0]!.max as any).exact).toBe('2*pi');
      expect(v.curve.verification.surfaceFIdentityHolds).toBe(true);
      expect(v.curve.verification.surfaceGIdentityHolds).toBe(true);
    });
  });

  describe('3. Discarded Branches and ± Rejection (Rules 3, 4, 7)', () => {
    it('prefers complete global coordinate parameterization over square-root partial branch: y = x^2 and z = 0', () => {
      const res = solve('y = x^2', 'z = 0');
      expect(res.status).toBe('verified-curve');
      const v = res as VerifiedCurveResult;

      // Natural complete choice is x = t, y = t^2 (covers all t in [-1000, 1000])
      // Rejecting y = t, x = sqrt(t) (which only covers x >= 0)
      expect(v.curve.x).toBe('t');
      expect(v.curve.y).toBe('t**2');
      expect(v.curve.z).toBe('0');
      expect(v.curve.x).not.toContain('sqrt');
      expect(v.curve.verification.surfaceFIdentityHolds).toBe(true);
      expect(v.curve.verification.surfaceGIdentityHolds).toBe(true);
    });

    it('never accepts a single semicircle when asked for a circle, even via coordinate parameterization', () => {
      // Slicing cylinder x^2 + y^2 = 4 with z = 0 gives a circle in z = 0
      const res = solve('x^2 + y^2 = 4', 'z = 0');
      expect(res.status).toBe('verified-curve');
      const v = res as VerifiedCurveResult;

      // Must be trigonometric parameterization, not y = sqrt(4 - x^2)
      expect(v.curve.x).toContain('cos(t)');
      expect(v.curve.y).toContain('sin(t)');
      expect(v.curve.y).not.toContain('sqrt(4');
    });
  });

  describe('4. Multiple Disconnected Components (Rule 8: Inconclusive Honesty)', () => {
    it('returns inconclusive when intersection has multiple disconnected components (e.g. x^2 + y^2 = 4 and z^2 = 1)', () => {
      // Intersection consists of two disconnected circles: z = 1 and z = -1
      // No single exact global parameterization can represent both components simultaneously
      const res = solve('x^2 + y^2 = 4', 'z^2 = 1');
      expect(res.status).toBe('inconclusive');
      const inc = res as InconclusiveResult;
      expect(inc.reasonCode).toBe('multiple_branches_no_global_parametrization');
      expect(inc.message).toContain('multiple branches');
    });
  });

  describe('5. Open Curves and Domain Exclusions / Singularities (Rules 2, 5)', () => {
    it('correctly handles hyperbola with singularity exclusion: z = 1/x and y = 0', () => {
      const res = solve('z = \\frac{1}{x}', 'y = 0');
      expect(res.status).toBe('verified-curve');
      const v = res as VerifiedCurveResult;

      expect(v.curve.x).toBe('t');
      expect(v.curve.y).toBe('0');
      expect(v.curve.z).toBe('1/t');

      // Parameter domain must exclude t = 0
      expect(v.curve.domain.intervals.length).toBeGreaterThanOrEqual(2);
      for (const iv of v.curve.domain.intervals) {
        // Neither interval should contain 0 as an interior point
        const minVal = (iv.min as any).numericApprox;
        const maxVal = (iv.max as any).numericApprox;
        expect(minVal > 0 || maxVal < 0).toBe(true);
      }
      expect(v.curve.verification.surfaceFIdentityHolds).toBe(true);
      expect(v.curve.verification.surfaceGIdentityHolds).toBe(true);
    });

    it('solves open cubic-quadratic intersection: z = x^3 and y = x^2', () => {
      const res = solve('z = x^3', 'y = x^2');
      expect(res.status).toBe('verified-curve');
      const v = res as VerifiedCurveResult;

      expect(v.curve.x).toBe('t');
      expect(v.curve.y).toBe('t**2');
      expect(v.curve.z).toBe('t**3');
      expect(v.curve.verification.surfaceFIdentityHolds).toBe(true);
      expect(v.curve.verification.surfaceGIdentityHolds).toBe(true);
    });
  });

  describe('6. Fundamental Interval Verification for Periodic Curves (Rule 6)', () => {
    it('guarantees fundamental period [0, 2*pi) exactly once for closed periodic curves', () => {
      const res = solve('x^2 + y^2 = 16', 'z = 2*x + 3');
      expect(res.status).toBe('verified-curve');
      const v = res as VerifiedCurveResult;

      expect(v.curve.domain.intervals).toHaveLength(1);
      const iv = v.curve.domain.intervals[0]!;
      expect((iv.min as any).exact).toBe('0');
      expect((iv.max as any).exact).toBe('2*pi');
      expect(iv.minInclusive).toBe(true);
      expect(iv.maxInclusive).toBe(false); // [0, 2*pi) half-open
    });
  });
});
