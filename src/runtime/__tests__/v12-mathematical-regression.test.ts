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

describe('Intersect V12 Mathematical Regression Suite (Section 5 Matrix)', () => {
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
    const respStr = solveIntersectionJson(payload);
    return JSON.parse(respStr) as CalculationResult;
  }

  // 1. Plane/plane line, inconsistent planes, and dependent overlapping constraints
  describe('1. Plane/plane line, inconsistent planes, and dependent constraints', () => {
    it('solves standard oblique plane intersection line', () => {
      const res = solve('x + y + z = 1', '2*x - y + 3*z = 2');
      expect(res.status).toBe('verified-curve');
      const v = res as VerifiedCurveResult;
      expect(v.curve.verification.status).toBe('verified');
      expect(v.curve.verification.surfaceFIdentityHolds).toBe(true);
      expect(v.curve.verification.surfaceGIdentityHolds).toBe(true);
    });

    it('identifies inconsistent parallel planes as empty-bounded with global proof', () => {
      const res = solve('x + 2*y + 3*z = 4', 'x + 2*y + 3*z = 10');
      expect(res.status).toBe('empty-bounded');
      const e = res as EmptyBoundedResult;
      expect(e.reasonCode).toBe('algebraic_contradiction');
      expect(e.proofScope).toBe('global');
    });

    it('identifies dependent overlapping plane equations as coincident-surfaces degeneracy', () => {
      const res = solve('x - 2*y + 3*z = 5', '2*x - 4*y + 6*z = 10');
      expect(res.status).toBe('degenerate');
      const d = res as DegenerateResult;
      expect(d.nature).toBe('coincident-surfaces');
    });
  });

  // 2. Reference cylinder/plane closed curve and a translated/scaled equivalent
  describe('2. Reference cylinder/plane and translated/scaled equivalents', () => {
    it('solves reference cylinder-plane: x^2 + y^2 = 4 and z = x + y', () => {
      const res = solve('x^2 + y^2 = 4', 'z = x + y');
      expect(res.status).toBe('verified-curve');
      const v = res as VerifiedCurveResult;
      expect(v.curve.verification.surfaceFIdentityHolds).toBe(true);
      expect(v.curve.verification.surfaceGIdentityHolds).toBe(true);
      expect(v.curve.domain.intervals[0]!.minInclusive).toBe(true);
      expect(v.curve.domain.intervals[0]!.maxInclusive).toBe(false);
    });

    it('solves translated and scaled cylinder-plane: (x - 3)^2 + (y + 2)^2 = 9 and z = 2*x - y + 1', () => {
      const res = solve('(x - 3)^2 + (y + 2)^2 = 9', 'z = 2*x - y + 1');
      expect(res.status).toBe('verified-curve');
      const v = res as VerifiedCurveResult;
      expect(v.curve.verification.status).toBe('verified');
      expect(v.curve.verification.surfaceFIdentityHolds).toBe(true);
      expect(v.curve.verification.surfaceGIdentityHolds).toBe(true);
    });
  });

  // 3. Oblique plane/sphere and supported sphere/sphere reduction
  describe('3. Oblique plane/sphere and supported sphere/sphere reduction', () => {
    it('solves oblique plane slicing a sphere', () => {
      const res = solve('x^2 + y^2 + z^2 = 16', 'x + y + z = 1');
      expect(res.status).toBe('verified-curve');
      const v = res as VerifiedCurveResult;
      expect(v.curve.verification.status).toBe('verified');
      expect(v.curve.verification.surfaceFIdentityHolds).toBe(true);
      expect(v.curve.verification.surfaceGIdentityHolds).toBe(true);
      expect(v.derivation.strategyName).toContain('Sphere');
    });

    it('reduces two intersecting spheres to a radical cutting plane and circle', () => {
      const res = solve('x^2 + y^2 + z^2 = 25', '(x - 2)^2 + y^2 + z^2 = 25');
      expect(res.status).toBe('verified-curve');
      const v = res as VerifiedCurveResult;
      expect(v.curve.verification.status).toBe('verified');
      expect(v.curve.verification.surfaceFIdentityHolds).toBe(true);
      expect(v.curve.verification.surfaceGIdentityHolds).toBe(true);
    });
  });

  // 4. Parabola, supported elementary non-polynomial curve, and hyperbola/domain-gap case
  describe('4. Parabola, non-polynomial curve, and hyperbola / domain-gap', () => {
    it('solves paraboloid intersected with vertical plane', () => {
      const res = solve('z = x^2 + y^2', 'x = y');
      expect(res.status).toBe('verified-curve');
      const v = res as VerifiedCurveResult;
      expect(v.curve.verification.status).toBe('verified');
      expect(v.curve.x).toBe('t');
      expect(v.curve.y).toBe('t');
      expect(v.curve.z).toBe('2*t**2');
    });

    it('solves elementary non-polynomial curve (sine / cosine)', () => {
      const res = solve('z = sin(x)', 'y = cos(x)');
      expect(res.status).toBe('verified-curve');
      const v = res as VerifiedCurveResult;
      expect(v.curve.verification.status).toBe('verified');
      expect(v.curve.x).toBe('t');
      expect(v.curve.y).toBe('cos(t)');
      expect(v.curve.z).toBe('sin(t)');
    });

    it('solves coordinate parameterization with rational pole/domain gap (y = 1/x)', () => {
      const res = solve('y = 1/x', 'z = x');
      expect(res.status).toBe('verified-curve');
      const v = res as VerifiedCurveResult;
      expect(v.curve.verification.status).toBe('verified');
      // Should have separated intervals avoiding x = 0
      expect(v.curve.domain.intervals.length).toBeGreaterThanOrEqual(2);
      expect(v.componentScope).toContain('Verified component');
    });
  });

  // 5. Original-denominator exclusions that remain valid after simplification
  describe('5. Original-denominator exclusions preserved across simplification', () => {
    it('preserves domain condition x != 0 when (x^2 - 1)/(x - 1) = y is simplified', () => {
      const rawReq = createCalculationRequest('y = (x^2 - 1)/(x - 1)', 'z = x');
      const prep = prepareCalculationRequest(rawReq);
      expect(prep.valid).toBe(true);
      if (!prep.valid) return;
      const conds = prep.request.surfaceF.prepared!.domainObligations;
      expect(conds.some((c: { kind: string }) => c.kind === 'nonzero-denominator')).toBe(true);
    });

    it('excludes singularity x = 0 from parameter domain when denominator is present', () => {
      const res = solve('y = (x^2 + x)/x', 'z = 0');
      expect(res.status).toBe('verified-curve');
      const v = res as VerifiedCurveResult;
      expect(v.curve.verification.status).toBe('verified');
      // x = 0 must not be included as an interior point of a continuous single interval
      const includesZero = v.curve.domain.intervals.some(iv => {
        const minNum = iv.min.kind === 'finite' ? (iv.min.numericApprox ?? -Infinity) : -Infinity;
        const maxNum = iv.max.kind === 'finite' ? (iv.max.numericApprox ?? Infinity) : Infinity;
        return minNum < 0 && maxNum > 0;
      });
      expect(includesZero).toBe(false);
    });
  });

  // 6. Isolated-point and real-empty cases, and bounded-empty outside ±1000
  describe('6. Isolated-point, real-empty, and bounded-empty', () => {
    it('detects isolated point at sphere tangency: x^2 + y^2 + z^2 = 9 and z = 3', () => {
      const res = solve('x^2 + y^2 + z^2 = 9', 'z = 3');
      expect(res.status).toBe('degenerate');
      const d = res as DegenerateResult;
      expect(d.nature).toBe('isolated-point');
      expect(d.points).toHaveLength(1);
      expect(d.points![0]).toEqual({ x: '0', y: '0', z: '3' });
    });

    it('detects real-empty case (non-intersecting sphere and plane): x^2 + y^2 + z^2 = 4 and z = 5', () => {
      const res = solve('x^2 + y^2 + z^2 = 4', 'z = 5');
      expect(res.status).toBe('empty-bounded');
      const e = res as EmptyBoundedResult;
      expect(e.reasonCode).toBe('sum_of_squares_positive');
    });

    it('handles bounded-empty intersection outside calculation region [-1000, 1000]^3', () => {
      // Direct candidate verification test for point outside bounds:
      const pyCode = `
import sympy as sp
import json
x, y, z = sp.symbols('x y z', real=True)
F = x - 5000
G = y - 2
cand = {
  'x': '5000',
  'y': '2',
  'z': 't',
  'domain': {'intervals': [{'min': {'kind': 'finite', 'exact': '-10', 'numericApprox': -10}, 'minInclusive': True, 'max': {'kind': 'finite', 'exact': '10', 'numericApprox': 10}, 'maxInclusive': True}]},
  'paramSymbol': 't'
}
verdict, cert = verify_candidate(cand, F, G, [-1000, 1000, -1000, 1000, -1000, 1000])
json.dumps({'verdict': verdict, 'cert': cert})
`;
      const res = JSON.parse(pyodide.runPython(pyCode));
      expect(res.verdict).toBe(false);
      expect(res.cert.status).toBe('rejected');
      expect(res.cert.scope).toContain('violates coordinate bounds');
    });
  });

  // 7. Controlled inconclusive / unsupported case without converting failure into absence proof
  describe('7. Controlled inconclusive/unsupported case without false absence claim', () => {
    it('returns unsupported/inconclusive for unsupported implicit degree without claiming empty', () => {
      const res = solve('x^4 + y^4 + z^4 = 16', 'x^3 + y^3 + z = 1');
      expect(['inconclusive', 'unsupported']).toContain(res.status);
      expect(res.status).not.toBe('empty-bounded');
    }, 20_000);
  });

  // 8. Forward/Reverse domain mapping for open/closed/half-open intervals
  describe('8. Forward/Reverse domain mapping', () => {
    it('periodic closed curve [0, 2pi) maps to (0, 2pi] with opposite traversal', () => {
      const resFwd = solve('x^2 + y^2 = 4', 'z = 0', 'forward') as VerifiedCurveResult;
      const resRev = solve('x^2 + y^2 = 4', 'z = 0', 'reverse') as VerifiedCurveResult;

      expect(resFwd.curve.domain.intervals[0]!.minInclusive).toBe(true);
      expect(resFwd.curve.domain.intervals[0]!.maxInclusive).toBe(false);

      expect(resRev.curve.domain.intervals[0]!.minInclusive).toBe(false);
      expect(resRev.curve.domain.intervals[0]!.maxInclusive).toBe(true);

      expect(resRev.derivation.steps.length).toBe(7);
      expect(resRev.derivation.steps[6]!.title.toLowerCase()).toContain('reverse');
    });

    it('finite line segment [a, b] reflection maps [a, b] to [a, b] reversed', () => {
      const resFwd = solve('x + y = 0', 'z = 0', 'forward') as VerifiedCurveResult;
      const resRev = solve('x + y = 0', 'z = 0', 'reverse') as VerifiedCurveResult;
      expect(resFwd.status).toBe('verified-curve');
      expect(resRev.status).toBe('verified-curve');
      expect(resRev.curve.direction).toBe('reverse');
    });
  });

  // 9. Input invariance: equation reordering, rearrangement, scaling, coordinate permutation
  describe('9. Transformed input invariance', () => {
    it('equation reordering: F and G swapped produces verified curve with identical geometry', () => {
      const res1 = solve('x^2 + y^2 = 4', 'z = x + y') as VerifiedCurveResult;
      const res2 = solve('z = x + y', 'x^2 + y^2 = 4') as VerifiedCurveResult;
      expect(res1.status).toBe('verified-curve');
      expect(res2.status).toBe('verified-curve');
      expect(res1.curve.verification.surfaceFIdentityHolds).toBe(true);
      expect(res2.curve.verification.surfaceFIdentityHolds).toBe(true);
    });

    it('equation rearrangement: x^2 + y^2 - 4 = 0 and z - x - y = 0', () => {
      const res = solve('x^2 + y^2 - 4 = 0', 'z - x - y = 0') as VerifiedCurveResult;
      expect(res.status).toBe('verified-curve');
      expect(res.curve.verification.status).toBe('verified');
      expect(res.curve.verification.surfaceFIdentityHolds).toBe(true);
      expect(res.curve.verification.surfaceGIdentityHolds).toBe(true);
    });

    it('nonzero constant scaling: 3*x^2 + 3*y^2 = 12 and 5*z = 5*x + 5*y', () => {
      const res = solve('3*x^2 + 3*y^2 = 12', '5*z = 5*x + 5*y') as VerifiedCurveResult;
      expect(res.status).toBe('verified-curve');
      expect(res.curve.verification.status).toBe('verified');
    });

    it('coordinate permutation: y^2 + z^2 = 4 and x = y + z', () => {
      const res = solve('y^2 + z^2 = 4', 'x = y + z') as VerifiedCurveResult;
      expect(res.status).toBe('verified-curve');
      expect(res.curve.verification.status).toBe('verified');
    });
  });
});
