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

describe('Intersect V4 Symbolic Intersection Engine Tests', () => {
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
    const respStr = solveIntersectionJson(jsonStr);
    return JSON.parse(respStr) as CalculationResult;
  }

  // --- 1. Linear Plane-Plane Intersections ---
  describe('1. Linear Plane-Plane Intersections', () => {
    it('Solves general planes: x + y + z = 1 and 2x - y + 3z = 2', () => {
      const res = solve('x + y + z = 1', '2*x - y + 3*z = 2');
      expect(res.status).toBe('verified-curve');
      const v = res as VerifiedCurveResult;
      expect(v.curve.paramSymbol).toBe('t');
      expect(v.curve.verification.status).toBe('verified');
      expect(v.curve.verification.surfaceFIdentityHolds).toBe(true);
      expect(v.curve.verification.surfaceGIdentityHolds).toBe(true);
      expect(v.derivation.strategyName).toContain('Affine Plane');
    });

    it('Solves coordinate planes: x = 2 and y = 3', () => {
      const res = solve('x = 2', 'y = 3');
      expect(res.status).toBe('verified-curve');
      const v = res as VerifiedCurveResult;
      expect(v.curve.x).toBe('2');
      expect(v.curve.y).toBe('3');
      expect(v.curve.z).toBe('t');
      expect(v.curve.verification.status).toBe('verified');
    });

    it('Solves rational slope planes: z = 0.5*x + 1 and y = 2', () => {
      const res = solve('z = 0.5*x + 1', 'y = 2');
      expect(res.status).toBe('verified-curve');
      const v = res as VerifiedCurveResult;
      expect(v.curve.y).toBe('2');
      expect(v.curve.verification.status).toBe('verified');
      expect(v.curve.verification.surfaceFIdentityHolds).toBe(true);
      expect(v.curve.verification.surfaceGIdentityHolds).toBe(true);
    });
  });

  // --- 2. Cylinder and Plane Intersections ---
  describe('2. Cylinder and Plane Intersections', () => {
    it('Solves circular cylinder and plane: x^2 + y^2 = 4 and z = x + y', () => {
      const res = solve('x^2 + y^2 = 4', 'z = x + y');
      expect(res.status).toBe('verified-curve');
      const v = res as VerifiedCurveResult;
      expect(v.curve.verification.status).toBe('verified');
      const iv = v.curve.domain.intervals[0];
      expect(iv).toBeDefined();
      if (iv && iv.min.kind === 'finite') {
        expect(iv.min.exact).toBe('0');
      }
      if (iv && iv.max.kind === 'finite') {
        expect(iv.max.exact).toContain('pi');
      }
      expect(v.derivation.strategyName).toContain('Cylindr');
    });

    it('Solves tilted cylinder and plane: x^2 + z^2 = 9 and y = 2', () => {
      const res = solve('x^2 + z^2 = 9', 'y = 2');
      expect(res.status).toBe('verified-curve');
      const v = res as VerifiedCurveResult;
      expect(v.curve.y).toBe('2');
      expect(v.curve.verification.status).toBe('verified');
    });

    it('Solves yz cylinder and oblique plane: y^2 + z^2 = 1 and x + y + z = 0', () => {
      const res = solve('y^2 + z^2 = 1', 'x + y + z = 0');
      expect(res.status).toBe('verified-curve');
      const v = res as VerifiedCurveResult;
      expect(v.curve.verification.status).toBe('verified');
    });
  });

  // --- 3. Sphere and Plane Intersections ---
  describe('3. Sphere and Plane Intersections', () => {
    it('Solves sphere sliced by parallel plane: x^2 + y^2 + z^2 = 9 and z = 1', () => {
      const res = solve('x^2 + y^2 + z^2 = 9', 'z = 1');
      expect(res.status).toBe('verified-curve');
      const v = res as VerifiedCurveResult;
      expect(v.curve.z).toBe('1');
      expect(v.curve.verification.status).toBe('verified');
      expect(v.derivation.strategyName).toContain('Sphere');
    });

    it('Solves sphere sliced by diagonal plane: x^2 + y^2 + z^2 = 4 and x + y = 0', () => {
      const res = solve('x^2 + y^2 + z^2 = 4', 'x + y = 0');
      expect(res.status).toBe('verified-curve');
      const v = res as VerifiedCurveResult;
      expect(v.curve.verification.status).toBe('verified');
    });
  });

  // --- 4. Quadric-Quadric Reductions ---
  describe('4. Quadric-Quadric Reductions', () => {
    it('Reduces shifted spheres to radical plane: x^2 + y^2 + z^2 = 4 and (x - 1)^2 + y^2 + z^2 = 4', () => {
      const res = solve('x^2 + y^2 + z^2 = 4', '(x - 1)^2 + y^2 + z^2 = 4');
      expect(res.status).toBe('verified-curve');
      const v = res as VerifiedCurveResult;
      expect(v.curve.verification.status).toBe('verified');
      expect(v.derivation.strategyName).toContain('Plane-Sphere');
    });

    it('Identifies multiple disconnected branches for concentric sphere and cylinder: x^2 + y^2 + z^2 = 16 and x^2 + y^2 = 4', () => {
      const res = solve('x^2 + y^2 + z^2 = 16', 'x^2 + y^2 = 4');
      // Intersection is two disconnected circles at z = ±sqrt(12); must not present one circle as complete
      expect(res.status).toBe('inconclusive');
      expect((res as any).reasonCode).toBe('multiple_branches_no_global_parametrization');
    });

    it('Reduces tangent sphere and cylinder to single circle: x^2 + y^2 + z^2 = 4 and x^2 + y^2 = 4', () => {
      const res = solve('x^2 + y^2 + z^2 = 4', 'x^2 + y^2 = 4');
      expect(res.status).toBe('verified-curve');
      const v = res as VerifiedCurveResult;
      expect(v.curve.verification.status).toBe('verified');
      expect(v.curve.z).toBe('0');
    });
  });

  // --- 5. Explicit and Monomial Forms ---
  describe('5. Explicit and Monomial Forms', () => {
    it('Solves paraboloid and diagonal plane: z = x^2 + y^2 and y = x', () => {
      const res = solve('z = x^2 + y^2', 'y = x');
      expect(res.status).toBe('verified-curve');
      const v = res as VerifiedCurveResult;
      expect(v.curve.x).toBe('t');
      expect(v.curve.y).toBe('t');
      expect(v.curve.z).toBe('2*t**2');
      expect(v.curve.verification.status).toBe('verified');
    });

    it('Solves cubic and quadratic: z = x^3 and y = x^2', () => {
      const res = solve('z = x^3', 'y = x^2');
      expect(res.status).toBe('verified-curve');
      const v = res as VerifiedCurveResult;
      expect(v.curve.x).toBe('t');
      expect(v.curve.y).toBe('t**2');
      expect(v.curve.z).toBe('t**3');
      expect(v.curve.verification.status).toBe('verified');
    });

    it('Solves trigonometric curves: z = sin(x) and y = cos(x)', () => {
      const res = solve('z = sin(x)', 'y = cos(x)');
      expect(res.status).toBe('verified-curve');
      const v = res as VerifiedCurveResult;
      expect(v.curve.x).toBe('t');
      expect(v.curve.y).toBe('cos(t)');
      expect(v.curve.z).toBe('sin(t)');
      expect(v.curve.verification.status).toBe('verified');
    });
  });

  // --- 6. Empty Bounded Intersections ---
  describe('6. Empty Bounded Intersections', () => {
    it('Detects sphere and non-intersecting plane: x^2 + y^2 + z^2 = 1 and z = 5', () => {
      const res = solve('x^2 + y^2 + z^2 = 1', 'z = 5');
      expect(res.status).toBe('empty-bounded');
      const e = res as EmptyBoundedResult;
      expect(e.reasonCode).toBe('sum_of_squares_positive');
      expect(e.proofExplanation).toContain('exceeds');
    });

    it('Detects parallel disjoint planes: x + y + z = 0 and x + y + z = 10', () => {
      const res = solve('x + y + z = 0', 'x + y + z = 10');
      expect(res.status).toBe('empty-bounded');
      const e = res as EmptyBoundedResult;
      expect(e.reasonCode).toBe('algebraic_contradiction');
    });

    it('Detects sum of squares contradiction: x^2 + y^2 + z^2 + 1 = 0 and x = 0', () => {
      const res = solve('x^2 + y^2 + z^2 + 1 = 0', 'x = 0');
      expect(res.status).toBe('empty-bounded');
      const e = res as EmptyBoundedResult;
      expect(e.reasonCode).toBe('sum_of_squares_positive');
    });
  });

  // --- 7. Degenerate Intersections ---
  describe('7. Degenerate Intersections', () => {
    it('Detects point sphere: x^2 + y^2 + z^2 = 0 and x + y + z = 0', () => {
      const res = solve('x^2 + y^2 + z^2 = 0', 'x + y + z = 0');
      expect(res.status).toBe('degenerate');
      const d = res as DegenerateResult;
      expect(d.nature).toBe('isolated-point');
      expect(d.points).toHaveLength(1);
      expect(d.points![0]).toEqual({ x: '0', y: '0', z: '0' });
    });

    it('Detects sphere tangent plane: x^2 + y^2 + z^2 = 4 and z = 2', () => {
      const res = solve('x^2 + y^2 + z^2 = 4', 'z = 2');
      expect(res.status).toBe('degenerate');
      const d = res as DegenerateResult;
      expect(d.nature).toBe('isolated-point');
      expect(d.points).toHaveLength(1);
      expect(d.points![0]).toEqual({ x: '0', y: '0', z: '2' });
    });

    it('Detects coincident planes: x + y = 1 and 2x + 2y = 2', () => {
      const res = solve('x + y = 1', '2*x + 2*y = 2');
      expect(res.status).toBe('degenerate');
      const d = res as DegenerateResult;
      expect(d.nature).toBe('coincident-surfaces');
    });
  });

  // --- 8. Invariance Under Transformations ---
  describe('8. Invariance Under Transformations', () => {
    it('Swapping Surface F and Surface G yields verified curve', () => {
      const res1 = solve('x^2 + y^2 = 4', 'z = x + y');
      const res2 = solve('z = x + y', 'x^2 + y^2 = 4');
      expect(res1.status).toBe('verified-curve');
      expect(res2.status).toBe('verified-curve');
      expect((res1 as VerifiedCurveResult).curve.verification.surfaceFIdentityHolds).toBe(true);
      expect((res2 as VerifiedCurveResult).curve.verification.surfaceFIdentityHolds).toBe(true);
    });

    it('Equation scaling: 2*x + 2*y + 2*z = 2 yields identical verified line', () => {
      const res = solve('2*x + 2*y + 2*z = 2', '2*x - y + 3*z = 2');
      expect(res.status).toBe('verified-curve');
      const v = res as VerifiedCurveResult;
      expect(v.curve.verification.status).toBe('verified');
      expect(v.curve.verification.surfaceFIdentityHolds).toBe(true);
      expect(v.curve.verification.surfaceGIdentityHolds).toBe(true);
    });

    it('Variable permutation: y^2 + z^2 = 4 and x = y + z', () => {
      const res = solve('y^2 + z^2 = 4', 'x = y + z');
      expect(res.status).toBe('verified-curve');
      const v = res as VerifiedCurveResult;
      expect(v.curve.verification.status).toBe('verified');
      expect(v.curve.verification.surfaceFIdentityHolds).toBe(true);
      expect(v.curve.verification.surfaceGIdentityHolds).toBe(true);
    });
  });

  // --- 9. Certificate Rejection & Security / Safety ---
  describe('9. Certificate Rejection & Security / Safety', () => {
    it('Rejects false curves and checks algebraic identities strictly', () => {
      // Direct call to verify_candidate in Python:
      const testPy = `
import sympy as sp
import json
x, y, z, t = sp.symbols('x y z t', real=True)
# Genuine F and G:
F = x**2 + y**2 - 4
G = z - (x + y)
# False parameterization that satisfies F but violates G:
candidate = {
    'x': '2*cos(t)',
    'y': '2*sin(t)',
    'z': '0', # Wrong z!
    'domain': {'intervals': [{'min': {'kind': 'finite', 'exact': '0', 'numericApprox': 0.0}, 'minInclusive': True, 'max': {'kind': 'finite', 'exact': '2*pi', 'numericApprox': 6.283}, 'maxInclusive': False}]},
    'paramSymbol': 't'
}
verdict, cert = verify_candidate(candidate, F, G, [-1000, 1000, -1000, 1000, -1000, 1000])
json.dumps({'verdict': verdict, 'cert': cert})
`;
      const output = JSON.parse(pyodide.runPython(testPy));
      expect(output.verdict).toBe(false);
      expect(output.cert.surfaceGIdentityHolds).toBe(false);
    });

    it('Rejects candidate outside world bounds', () => {
      const testPy = `
import sympy as sp
import json
x, y, z, t = sp.symbols('x y z t', real=True)
F = x - 5000 # Outside [-1000, 1000]
G = y - 1
candidate = {
    'x': '5000',
    'y': '1',
    'z': 't',
    'domain': {'intervals': [{'min': {'kind': 'finite', 'exact': '-10', 'numericApprox': -10.0}, 'minInclusive': True, 'max': {'kind': 'finite', 'exact': '10', 'numericApprox': 10.0}, 'maxInclusive': True}]},
    'paramSymbol': 't'
}
verdict, cert = verify_candidate(candidate, F, G, [-1000, 1000, -1000, 1000, -1000, 1000])
json.dumps({'verdict': verdict, 'cert': cert})
`;
      const output = JSON.parse(pyodide.runPython(testPy));
      expect(output.verdict).toBe(false);
      expect(output.cert.status).toBe('rejected');
      expect(output.cert.scope).toContain('violates coordinate bounds');
    });
  });
});
