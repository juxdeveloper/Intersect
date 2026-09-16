import { describe, it, expect, beforeAll } from 'vitest';
import path from 'node:path';
import { createRequire } from 'node:module';
import { loadPyodide, type PyodideInterface } from 'pyodide';
import { SYMPY_BUILDER_PYTHON_SOURCE } from '../python-source';
import { prepareCalculationRequest, createCalculationRequest } from '../../contracts/calculation';
import type { PreparedExpressionsSummary } from '../../contracts/worker';

import { fileURLToPath } from 'node:url';

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

describe('Real Pyodide & SymPy Mathematical Integration Suite', () => {
  let pyodide: PyodideInterface;
  let prepareSystemJson: (json: string) => string;

  beforeAll(async () => {
    // Point indexURL exclusively to local static assets in public/pyodide
    const localPyodideDir = path.resolve(process.cwd(), 'public', 'pyodide');

    pyodide = await loadPyodide({
      indexURL: localPyodideDir,
      lockFileURL: path.join(localPyodideDir, 'pyodide-lock.json'),
    });

    // Verify local package loading
    const mpmathWhl = path.join(localPyodideDir, 'mpmath-1.3.0-py3-none-any.whl');
    const sympyWhl = path.join(localPyodideDir, 'sympy-1.13.3-py3-none-any.whl');
    await pyodide.loadPackage([mpmathWhl, sympyWhl]);

    // Install application-owned builder
    pyodide.runPython(SYMPY_BUILDER_PYTHON_SOURCE);

    const pyFn = pyodide.globals.get('prepare_system_json');
    prepareSystemJson = (json: string) => {
      return pyFn(json);
    };
  }, 60_000);

  it('1. Constructs quadratic cylinder and linear plane (x^2 + y^2 = 4, z = x + y)', () => {
    const rawReq = createCalculationRequest('x^2 + y^2 = 4', 'z = x + y');
    const prep = prepareCalculationRequest(rawReq);
    expect(prep.valid).toBe(true);
    if (!prep.valid) return;

    const payload = {
      surfaceF: prep.pair.surfaceF.sympyPlan,
      surfaceG: prep.pair.surfaceG.sympyPlan,
    };

    const resultStr = prepareSystemJson(JSON.stringify(payload));
    const summary: PreparedExpressionsSummary = JSON.parse(resultStr);

    // Surface F checks
    expect(summary.surfaceF.equationStr).toBe('Eq(x**2 + y**2, 4)');
    expect(summary.surfaceF.residualStr).toBe('x**2 + y**2 - 4');
    expect(summary.surfaceF.isPolynomial).toBe(true);
    expect(summary.surfaceF.degree).toBe(2);
    expect(summary.surfaceF.variables).toEqual(['x', 'y']);

    // Surface G checks
    expect(summary.surfaceG.equationStr).toBe('Eq(z, x + y)');
    expect(summary.surfaceG.isPolynomial).toBe(true);
    expect(summary.surfaceG.degree).toBe(1);
    expect(summary.surfaceG.variables).toEqual(['x', 'y', 'z']);

    // System checks
    expect(summary.systemVariables).toEqual(['x', 'y', 'z']);
    expect(summary.hasContradiction).toBe(false);
    expect(summary.hasIdentity).toBe(false);
  });

  it('2. Preserves exact decimal rationals and avoids IEEE 754 floating-point drift', () => {
    const rawReq = createCalculationRequest(
      'z = 0.1 * x',
      'y = 0.1234567890123456789 * x',
    );
    const prep = prepareCalculationRequest(rawReq);
    expect(prep.valid).toBe(true);
    if (!prep.valid) return;

    const payload = {
      surfaceF: prep.pair.surfaceF.sympyPlan,
      surfaceG: prep.pair.surfaceG.sympyPlan,
    };

    const resultStr = prepareSystemJson(JSON.stringify(payload));
    const summary: PreparedExpressionsSummary = JSON.parse(resultStr);

    // Exact rational 1/10 instead of float 0.10000000000000000555
    expect(summary.surfaceF.residualStr).toContain('x/10');
    expect(summary.surfaceF.residualStr).not.toContain('0.1000000000000000');

    // Exact arbitrary precision rational for long decimal
    expect(summary.surfaceG.residualStr).toContain('1234567890123456789*x/10000000000000000000');
  });

  it('3. Supports symbolic constants pi and e, transcendentals, roots, and absolute value', () => {
    const rawReq = createCalculationRequest(
      'z = \\pi * \\sin(x) + e * \\cos(y)',
      'x = \\ln(y) + \\sqrt{|z|}',
    );
    const prep = prepareCalculationRequest(rawReq);
    expect(prep.valid).toBe(true);
    if (!prep.valid) return;

    const payload = {
      surfaceF: prep.pair.surfaceF.sympyPlan,
      surfaceG: prep.pair.surfaceG.sympyPlan,
    };

    const resultStr = prepareSystemJson(JSON.stringify(payload));
    const summary: PreparedExpressionsSummary = JSON.parse(resultStr);

    // Surface F retains pi and E
    expect(summary.surfaceF.residualStr).toContain('pi*sin(x)');
    expect(summary.surfaceF.residualStr).toContain('E*cos(y)');

    // Surface G retains log, sqrt, and Abs
    expect(summary.surfaceG.residualStr).toContain('log(y)');
    expect(summary.surfaceG.residualStr).toContain('sqrt(Abs(z))');
  });

  it('4. Preserves domain exclusions even when SymPy simplifies expressions (x/x = 1 and (x^2 - 1)/(x - 1) = y)', () => {
    const rawReq = createCalculationRequest(
      '\\frac{x}{x} = 1',
      '\\frac{x^2 - 1}{x - 1} = y',
    );
    const prep = prepareCalculationRequest(rawReq);
    expect(prep.valid).toBe(true);
    if (!prep.valid) return;

    const payload = {
      surfaceF: prep.pair.surfaceF.sympyPlan,
      surfaceG: prep.pair.surfaceG.sympyPlan,
    };

    const resultStr = prepareSystemJson(JSON.stringify(payload));
    const summary: PreparedExpressionsSummary = JSON.parse(resultStr);

    // Surface F: x/x - 1 simplifies to 0, but domain condition x != 0 is preserved!
    expect(summary.surfaceF.simplifiedResidualStr).toBe('0');
    expect(summary.surfaceF.domainConditions.length).toBeGreaterThanOrEqual(1);
    const xNotZero = summary.surfaceF.domainConditions.find((c) => c.kind === 'nonzero-denominator');
    expect(xNotZero).toBeDefined();
    expect(xNotZero!.conditionStr).toBe('x');

    // Surface G: (x^2-1)/(x-1) simplifies to x+1-y, but denominator x-1 != 0 is preserved!
    expect(summary.surfaceG.simplifiedResidualStr).toBe('x - y + 1');
    const xMinus1NotZero = summary.surfaceG.domainConditions.find((c) => c.kind === 'nonzero-denominator');
    expect(xMinus1NotZero).toBeDefined();
    expect(xMinus1NotZero!.conditionStr).toContain('x - 1');
  });

  it('5. Enforces real-root semantics for odd fractional powers ((-8)^(1/3) == -2)', () => {
    // Construct direct plan testing odd root of negative number
    const payload = {
      surfaceF: {
        planVersion: '1.0.0',
        target: 'sympy',
        entryPoint: 'build_surface_system',
        equation: {
          op: 'Eq',
          args: [
            {
              op: 'Pow',
              args: [
                { op: 'Integer', value: '-8' },
                { op: 'Rational', num: '1', den: '3' },
              ],
            },
            { op: 'Integer', value: '-2' },
          ],
        },
        residual: {
          op: 'Add',
          args: [
            {
              op: 'Pow',
              args: [
                { op: 'Integer', value: '-8' },
                { op: 'Rational', num: '1', den: '3' },
              ],
            },
            { op: 'Integer', value: '2' },
          ],
        },
        variables: [],
        domainConditions: [],
      },
      surfaceG: {
        planVersion: '1.0.0',
        target: 'sympy',
        entryPoint: 'build_surface_system',
        equation: {
          op: 'Eq',
          args: [{ op: 'Symbol', name: 'z' }, { op: 'Integer', value: '0' }],
        },
        residual: { op: 'Symbol', name: 'z' },
        variables: ['z'],
        domainConditions: [],
      },
    };

    const resultStr = prepareSystemJson(JSON.stringify(payload));
    const summary: PreparedExpressionsSummary = JSON.parse(resultStr);

    // (-8)^(1/3) evaluates to real -2, so -2 + 2 = 0 (identity)
    expect(summary.surfaceF.residualStr).toBe('0');
    expect(summary.surfaceF.isConstantIdentity).toBe(true);
    expect(summary.surfaceF.isConstantContradiction).toBe(false);
  });

  it('6. Rejects malformed payloads and disallowed operations safely without code execution', () => {
    // Attempt unknown operator injection
    const maliciousPayload = {
      surfaceF: {
        planVersion: '1.0.0',
        target: 'sympy',
        entryPoint: 'build_surface_system',
        equation: {
          op: 'Eq',
          args: [
            { op: '__import__', args: [] },
            { op: 'Integer', value: '0' },
          ],
        },
        residual: { op: 'Integer', value: '0' },
        variables: [],
        domainConditions: [],
      },
      surfaceG: {
        planVersion: '1.0.0',
        target: 'sympy',
        entryPoint: 'build_surface_system',
        equation: {
          op: 'Eq',
          args: [{ op: 'Symbol', name: 'z' }, { op: 'Integer', value: '0' }],
        },
        residual: { op: 'Symbol', name: 'z' },
        variables: ['z'],
        domainConditions: [],
      },
    };

    expect(() => {
      prepareSystemJson(JSON.stringify(maliciousPayload));
    }).toThrow(/Unsupported construction operator/);
  });
});
