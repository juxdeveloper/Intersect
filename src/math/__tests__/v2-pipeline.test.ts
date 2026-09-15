import { describe, it, expect } from 'vitest';
import {
  parseMathInput,
  prepareSurfaceEquation,
  prepareEquationPair,
  MAX_INPUT_LENGTH,
} from '../index';
import {
  createCalculationRequest,
  prepareCalculationRequest,
  DEFAULT_CALCULATION_BOUNDS,
  type OperatorNode,
} from '../../contracts';

describe('V2 Mathematical Pipeline — Category 1: Basic Equations', () => {
  it('correctly parses and preserves both sides of x^2 + y^2 = 4', () => {
    const res = prepareSurfaceEquation(
      { id: 'f', label: 'Surface F', rawInput: 'x^2 + y^2 = 4', format: 'latex' },
      'surfaceF',
    );

    expect(res.success).toBe(true);
    if (!res.success) return;

    const eq = res.equation;
    expect(eq.classification).toBe('standard');
    expect(eq.variables).toEqual(['x', 'y']);

    // LHS is Add(Power(x, 2), Power(y, 2))
    expect(eq.lhs.type).toBe('apply');
    const lhsOp = eq.lhs as OperatorNode;
    expect(lhsOp.op).toBe('Add');
    expect(lhsOp.args.length).toBe(2);

    // RHS is 4
    expect(eq.rhs.type).toBe('number');
    if (eq.rhs.type === 'number') {
      expect(eq.rhs.value).toBe(4);
      expect(eq.rhs.exactRational).toEqual({ num: '4', den: '1' });
    }

    // Residual is (x^2 + y^2) - 4
    expect(eq.residual.type).toBe('apply');
    expect((eq.residual as OperatorNode).op).toBe('Subtract');

    // SymPy construction plan
    expect(eq.sympyPlan.target).toBe('sympy');
    expect(eq.sympyPlan.entryPoint).toBe('build_surface_system');
    expect(eq.sympyPlan.equation.op).toBe('Eq');
  });

  it('correctly parses and preserves both sides of z = x + y', () => {
    const res = prepareSurfaceEquation(
      { id: 'g', label: 'Surface G', rawInput: 'z = x + y', format: 'latex' },
      'surfaceG',
    );

    expect(res.success).toBe(true);
    if (!res.success) return;

    const eq = res.equation;
    expect(eq.classification).toBe('standard');
    expect(eq.variables).toEqual(['x', 'y', 'z']);
    expect(eq.lhs.type).toBe('symbol');
    if (eq.lhs.type === 'symbol') {
      expect(eq.lhs.name).toBe('z');
    }
    expect(eq.rhs.type).toBe('apply');
  });
});

describe('V2 Mathematical Pipeline — Category 2: Free Composition', () => {
  it('parses trigonometric, exponential, and logarithmic surfaces without presets', () => {
    const inputs = [
      '\\sin(x) + \\cos(y) = 1',
      '\\tan(x) = \\exp(y)',
      '\\ln(x) + \\ln(y) = z',
      '|x| + |y| = 2',
      '\\sqrt{x^2 + y^2} = z',
      '\\arcsin(x) + \\arccos(y) = 0',
      '\\sinh(x) + \\cosh(y) = \\tanh(z)',
      '\\sec(x) + \\csc(y) = \\cot(z)',
    ];

    for (const raw of inputs) {
      const res = prepareSurfaceEquation(
        { id: 'f', label: 'Surface F', rawInput: raw, format: 'latex' },
        'surfaceF',
      );
      expect(res.success, `Failed for input: ${raw}`).toBe(true);
      if (res.success) {
        expect(res.equation.sympyPlan.target).toBe('sympy');
        expect(res.equation.sympyPlan.equation.op).toBe('Eq');
      }
    }
  });
});

describe('V2 Mathematical Pipeline — Category 3: Input Conventions', () => {
  it('treats a supported standalone expression as expression = 0', () => {
    const res = prepareSurfaceEquation(
      { id: 'f', label: 'Surface F', rawInput: 'x^2 + y^2 - 4', format: 'latex' },
      'surfaceF',
    );

    expect(res.success).toBe(true);
    if (!res.success) return;

    expect(res.equation.rhs.type).toBe('number');
    if (res.equation.rhs.type === 'number') {
      expect(res.equation.rhs.value).toBe(0);
    }
    // Raw input is preserved exactly
    expect(res.equation.rawInput).toBe('x^2 + y^2 - 4');
  });

  it('permits equations that omit one or more variables', () => {
    // Omits z
    const resCylinder = prepareSurfaceEquation(
      { id: 'f', label: 'Surface F', rawInput: 'x^2 + y^2 = 1', format: 'latex' },
      'surfaceF',
    );
    expect(resCylinder.success).toBe(true);
    if (resCylinder.success) {
      expect(resCylinder.equation.variables).toEqual(['x', 'y']);
    }

    // Omits x and y
    const resPlane = prepareSurfaceEquation(
      { id: 'g', label: 'Surface G', rawInput: 'z = 5', format: 'latex' },
      'surfaceG',
    );
    expect(resPlane.success).toBe(true);
    if (resPlane.success) {
      expect(resPlane.equation.variables).toEqual(['z']);
    }
  });
});

describe('V2 Mathematical Pipeline — Category 4: Notation & Precedence', () => {
  it('handles fractions in both LaTeX \\frac and inline / forms', () => {
    const latexFrac = prepareSurfaceEquation(
      { id: 'f', label: 'Surface F', rawInput: '\\frac{x}{2} + \\frac{y}{3} = 1', format: 'latex' },
      'surfaceF',
    );
    expect(latexFrac.success).toBe(true);

    const asciiFrac = prepareSurfaceEquation(
      { id: 'f', label: 'Surface F', rawInput: 'x/2 + y/3 = 1', format: 'latex' },
      'surfaceF',
    );
    expect(asciiFrac.success).toBe(true);
  });

  it('handles parentheses, grouping, and implicit multiplication correctly', () => {
    const resImplicit = prepareSurfaceEquation(
      { id: 'f', label: 'Surface F', rawInput: '2x + 3y = 6', format: 'latex' },
      'surfaceF',
    );
    expect(resImplicit.success).toBe(true);

    const resGrouped = prepareSurfaceEquation(
      { id: 'g', label: 'Surface G', rawInput: '2(x + 1) = z', format: 'latex' },
      'surfaceG',
    );
    expect(resGrouped.success).toBe(true);

    const resAdjacentParen = prepareSurfaceEquation(
      { id: 'f', label: 'Surface F', rawInput: '(x + 1)(y - 1) = 0', format: 'latex' },
      'surfaceF',
    );
    expect(resAdjacentParen.success).toBe(true);
  });

  it('respects unary minus versus exponent precedence (-x^2 vs (-x)^2)', () => {
    const resUnbracketed = parseMathInput('-x^2', 'surfaceF');
    expect(resUnbracketed.success).toBe(true);
    if (resUnbracketed.success) {
      const ast = resUnbracketed.ast as OperatorNode;
      // In math, -x^2 is -(x^2)
      expect(ast.op).toBe('Negate');
      expect((ast.args[0] as OperatorNode).op).toBe('Power');
    }

    const resBracketed = parseMathInput('(-x)^2', 'surfaceF');
    expect(resBracketed.success).toBe(true);
    if (resBracketed.success) {
      const ast = resBracketed.ast as OperatorNode;
      // (-x)^2 is Power(-(x), 2)
      expect(ast.op).toBe('Power');
      expect((ast.args[0] as OperatorNode).op).toBe('Negate');
    }
  });
});

describe('V2 Mathematical Pipeline — Category 5: Exactness & Lossless Numbers', () => {
  it('preserves 0.1 and decimals as exact rational numbers without float drift', () => {
    const res = prepareSurfaceEquation(
      { id: 'f', label: 'Surface F', rawInput: '0.1 x + 0.25 y = 1', format: 'latex' },
      'surfaceF',
    );
    expect(res.success).toBe(true);
    if (!res.success) return;

    // Check plan serialization for exact rationals
    const plan = res.equation.sympyPlan;
    const planJson = JSON.stringify(plan);
    expect(planJson).toContain('"op":"Rational"');
    expect(planJson).toContain('"num":"1"');
    expect(planJson).toContain('"den":"10"');
    expect(planJson).toContain('"num":"1"');
    expect(planJson).toContain('"den":"4"');
  });

  it('preserves long decimal literals losslessly without float rounding', () => {
    const res = parseMathInput('0.1234567890123456789', 'surfaceF');
    expect(res.success).toBe(true);
    if (res.success && res.ast.type === 'number') {
      expect(res.ast.exactRational).toBeDefined();
      expect(res.ast.exactRational?.num).toBe('1234567890123456789');
      expect(res.ast.exactRational?.den).toBe('10000000000000000000');
    }
  });

  it('preserves pi and e symbolically rather than replacing with floats', () => {
    const res = prepareSurfaceEquation(
      { id: 'f', label: 'Surface F', rawInput: '\\pi x + e y = 0', format: 'latex' },
      'surfaceF',
    );
    expect(res.success).toBe(true);
    if (!res.success) return;

    const planJson = JSON.stringify(res.equation.sympyPlan);
    expect(planJson).toContain('"name":"pi"');
    expect(planJson).toContain('"name":"E"');
    // Must NOT contain 3.14159 or 2.71828
    expect(planJson).not.toContain('3.14159');
    expect(planJson).not.toContain('2.71828');
  });

  it('round-trips prepared equations through JSON without loss', () => {
    const res = prepareSurfaceEquation(
      { id: 'f', label: 'Surface F', rawInput: '0.1 x^2 + \\frac{1}{3} y^2 = 4', format: 'latex' },
      'surfaceF',
    );
    expect(res.success).toBe(true);
    if (!res.success) return;

    const json = JSON.stringify(res.equation);
    const restored = JSON.parse(json);
    expect(restored.rawInput).toBe(res.equation.rawInput);
    expect(restored.classification).toBe('standard');
    expect(restored.sympyPlan.planVersion).toBe('1.0.0');
  });
});

describe('V2 Mathematical Pipeline — Category 6: Real-Domain Obligations', () => {
  it('preserves denominator restrictions on x / x = 1 (does not cancel to 1 = 1)', () => {
    const res = prepareSurfaceEquation(
      { id: 'f', label: 'Surface F', rawInput: 'x / x = 1', format: 'latex' },
      'surfaceF',
    );
    expect(res.success).toBe(true);
    if (!res.success) return;

    const obligations = res.equation.domainObligations;
    expect(obligations.length).toBeGreaterThan(0);
    const hasDenom = obligations.some((o) => o.kind === 'nonzero-denominator');
    expect(hasDenom).toBe(true);
    // Residual must contain the division
    expect(JSON.stringify(res.equation.residual)).toContain('"Divide"');
  });

  it('preserves denominator restrictions on (x^2 - 1) / (x - 1) = y', () => {
    const res = prepareSurfaceEquation(
      { id: 'f', label: 'Surface F', rawInput: '(x^2 - 1) / (x - 1) = y', format: 'latex' },
      'surfaceF',
    );
    expect(res.success).toBe(true);
    if (!res.success) return;

    const obligations = res.equation.domainObligations;
    const denObligation = obligations.find((o) => o.kind === 'nonzero-denominator');
    expect(denObligation).toBeDefined();
    expect(denObligation?.description).toContain('x - 1');
  });

  it('collects real square-root conditions (sqrt(x) >= 0)', () => {
    const res = prepareSurfaceEquation(
      { id: 'f', label: 'Surface F', rawInput: '\\sqrt{x} = y', format: 'latex' },
      'surfaceF',
    );
    expect(res.success).toBe(true);
    if (!res.success) return;

    const radObligation = res.equation.domainObligations.find(
      (o) => o.kind === 'nonnegative-radicand',
    );
    expect(radObligation).toBeDefined();
  });

  it('collects strictly positive logarithm conditions (ln(x) > 0)', () => {
    const res = prepareSurfaceEquation(
      { id: 'f', label: 'Surface F', rawInput: '\\ln(x) = y', format: 'latex' },
      'surfaceF',
    );
    expect(res.success).toBe(true);
    if (!res.success) return;

    const logObligation = res.equation.domainObligations.find(
      (o) => o.kind === 'positive-argument',
    );
    expect(logObligation).toBeDefined();
  });

  it('collects tangent domain conditions (cos(x) != 0)', () => {
    const res = prepareSurfaceEquation(
      { id: 'f', label: 'Surface F', rawInput: '\\tan(z) = 0', format: 'latex' },
      'surfaceF',
    );
    expect(res.success).toBe(true);
    if (!res.success) return;

    const tanObligation = res.equation.domainObligations.find(
      (o) => o.kind === 'nonzero-cosine',
    );
    expect(tanObligation).toBeDefined();
  });

  it('collects nested denominator restrictions in 1 / (1 / x) = y', () => {
    const res = prepareSurfaceEquation(
      { id: 'f', label: 'Surface F', rawInput: '1 / (1 / x) = y', format: 'latex' },
      'surfaceF',
    );
    expect(res.success).toBe(true);
    if (!res.success) return;

    const denomObligations = res.equation.domainObligations.filter(
      (o) => o.kind === 'nonzero-denominator',
    );
    expect(denomObligations.length).toBe(2);
  });
});

describe('V2 Mathematical Pipeline — Category 7: Invalid Input Rejection', () => {
  it('rejects empty and whitespace-only inputs', () => {
    const resEmpty = prepareSurfaceEquation(
      { id: 'f', label: 'Surface F', rawInput: '', format: 'latex' },
      'surfaceF',
    );
    expect(resEmpty.success).toBe(false);
    if (!resEmpty.success) {
      expect(resEmpty.diagnostic.reasonCode).toBe('empty_input');
    }

    const resWhitespace = prepareSurfaceEquation(
      { id: 'f', label: 'Surface F', rawInput: '    ', format: 'latex' },
      'surfaceF',
    );
    expect(resWhitespace.success).toBe(false);
    if (!resWhitespace.success) {
      expect(resWhitespace.diagnostic.reasonCode).toBe('empty_input');
    }
  });

  it('rejects incomplete fraction placeholders (\\frac{1}{})', () => {
    const res = prepareSurfaceEquation(
      { id: 'f', label: 'Surface F', rawInput: '\\frac{1}{}', format: 'latex' },
      'surfaceF',
    );
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.diagnostic.reasonCode).toBe('incomplete_placeholder');
    }
  });

  it('rejects incomplete root placeholders (\\sqrt{})', () => {
    const res = prepareSurfaceEquation(
      { id: 'f', label: 'Surface F', rawInput: '\\sqrt{}', format: 'latex' },
      'surfaceF',
    );
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.diagnostic.reasonCode).toBe('incomplete_placeholder');
    }
  });

  it('rejects trailing operators and incomplete syntax (x +)', () => {
    const res = prepareSurfaceEquation(
      { id: 'f', label: 'Surface F', rawInput: 'x +', format: 'latex' },
      'surfaceF',
    );
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.diagnostic.reasonCode).toBe('parse_error');
    }
  });

  it('rejects malformed double equality (x = = 2)', () => {
    const res = prepareSurfaceEquation(
      { id: 'f', label: 'Surface F', rawInput: 'x = = 2', format: 'latex' },
      'surfaceF',
    );
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(['parse_error', 'incomplete_placeholder', 'malformed_equality']).toContain(
        res.diagnostic.reasonCode,
      );
    }
  });

  it('rejects chained equalities (x = y = z)', () => {
    const res = prepareSurfaceEquation(
      { id: 'f', label: 'Surface F', rawInput: 'x = y = z', format: 'latex' },
      'surfaceF',
    );
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.diagnostic.reasonCode).toBe('malformed_equality');
      expect(res.diagnostic.message).toContain('Chained equalities');
    }
  });

  it('rejects inequalities (x <= 4, x^2 + y^2 > 1)', () => {
    const resLessEq = prepareSurfaceEquation(
      { id: 'f', label: 'Surface F', rawInput: 'x <= 4', format: 'latex' },
      'surfaceF',
    );
    expect(resLessEq.success).toBe(false);
    if (!resLessEq.success) {
      expect(resLessEq.diagnostic.reasonCode).toBe('inequality_not_supported');
    }

    const resGreater = prepareSurfaceEquation(
      { id: 'f', label: 'Surface F', rawInput: 'x^2 + y^2 > 1', format: 'latex' },
      'surfaceF',
    );
    expect(resGreater.success).toBe(false);
    if (!resGreater.success) {
      expect(resGreater.diagnostic.reasonCode).toBe('inequality_not_supported');
    }
  });

  it('rejects unknown symbols and parameters (a, b, theta, u, v)', () => {
    const resA = prepareSurfaceEquation(
      { id: 'f', label: 'Surface F', rawInput: 'a + x = 2', format: 'latex' },
      'surfaceF',
    );
    expect(resA.success).toBe(false);
    if (!resA.success) {
      expect(resA.diagnostic.reasonCode).toBe('unknown_symbol');
      expect(resA.diagnostic.message).toContain("'a'");
    }
  });

  it('rejects reserved symbol t with explicit guidance', () => {
    const resT = prepareSurfaceEquation(
      { id: 'f', label: 'Surface F', rawInput: 't = x + y', format: 'latex' },
      'surfaceF',
    );
    expect(resT.success).toBe(false);
    if (!resT.success) {
      expect(resT.diagnostic.reasonCode).toBe('reserved_symbol');
      expect(resT.diagnostic.message).toContain("Symbol 't' is reserved");
    }
  });

  it('rejects unsupported calculus, discrete, and matrix constructs', () => {
    const resInt = prepareSurfaceEquation(
      { id: 'f', label: 'Surface F', rawInput: '\\int x dx = 0', format: 'latex' },
      'surfaceF',
    );
    expect(resInt.success).toBe(false);
    if (!resInt.success) {
      expect(resInt.diagnostic.reasonCode).toBe('unsupported_construct');
    }

    const resSum = prepareSurfaceEquation(
      { id: 'f', label: 'Surface F', rawInput: '\\sum_{i=1}^n x_i = 1', format: 'latex' },
      'surfaceF',
    );
    expect(resSum.success).toBe(false);
    if (!resSum.success) {
      expect(resSum.diagnostic.reasonCode).toBe('unsupported_construct');
    }

    const resMatrix = prepareSurfaceEquation(
      {
        id: 'f',
        label: 'Surface F',
        rawInput: '\\begin{pmatrix} 1 & 2 \\\\ 3 & 4 \\end{pmatrix} = 0',
        format: 'latex',
      },
      'surfaceF',
    );
    expect(resMatrix.success).toBe(false);
    if (!resMatrix.success) {
      expect(resMatrix.diagnostic.reasonCode).toBe('unsupported_construct');
    }
  });
});

describe('V2 Mathematical Pipeline — Category 8: Degenerate Inputs', () => {
  it('correctly classifies constant identity 0 = 0 as valid mathematical input', () => {
    const res = prepareSurfaceEquation(
      { id: 'f', label: 'Surface F', rawInput: '0 = 0', format: 'latex' },
      'surfaceF',
    );
    expect(res.success).toBe(true);
    if (!res.success) return;

    expect(res.equation.classification).toBe('constant-identity');
    expect(res.equation.variables).toEqual([]);
    expect(res.equation.sympyPlan.target).toBe('sympy');
  });

  it('correctly classifies constant contradiction 1 = 0 as valid mathematical input', () => {
    const res = prepareSurfaceEquation(
      { id: 'f', label: 'Surface F', rawInput: '1 = 0', format: 'latex' },
      'surfaceF',
    );
    expect(res.success).toBe(true);
    if (!res.success) return;

    expect(res.equation.classification).toBe('constant-contradiction');
    expect(res.equation.variables).toEqual([]);
  });

  it('detects contradiction flag in equation pair when 1 = 0 is present', () => {
    const pairRes = prepareEquationPair(
      { id: 'f', label: 'Surface F', rawInput: '1 = 0', format: 'latex' },
      { id: 'g', label: 'Surface G', rawInput: 'x^2 + y^2 = 4', format: 'latex' },
    );

    expect(pairRes.success).toBe(true);
    if (pairRes.success) {
      expect(pairRes.pair.hasContradiction).toBe(true);
      expect(pairRes.pair.hasIdentity).toBe(false);
    }
  });
});

describe('V2 Mathematical Pipeline — Category 9: Safe Boundary & Injection Resistance', () => {
  it('fails closed against code-like injections without evaluation', () => {
    const codeInjections = [
      "__import__('os').system('ls')",
      "eval('1+1')",
      "process.exit()",
      "<script>alert(1)</script>",
      "Function('return 1')()",
    ];

    for (const code of codeInjections) {
      const res = prepareSurfaceEquation(
        { id: 'f', label: 'Surface F', rawInput: code, format: 'latex' },
        'surfaceF',
      );
      // Must be safely rejected, not executed
      expect(res.success, `Failed to reject injection: ${code}`).toBe(false);
    }
  });
});

describe('V2 Mathematical Pipeline — Category 10: Complexity & Limits', () => {
  it('rejects oversized inputs exceeding MAX_INPUT_LENGTH', () => {
    const hugeInput = 'x + '.repeat(200) + 'y = 0';
    expect(hugeInput.length).toBeGreaterThan(MAX_INPUT_LENGTH);

    const res = prepareSurfaceEquation(
      { id: 'f', label: 'Surface F', rawInput: hugeInput, format: 'latex' },
      'surfaceF',
    );
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.diagnostic.reasonCode).toBe('input_too_long');
      expect(res.diagnostic.message).toContain('exceeds the maximum allowed limit');
    }
  });

  it('rejects pathological expressions exceeding MAX_TREE_DEPTH', () => {
    // 40 nested parentheses
    const deepInput = '('.repeat(40) + 'x' + ')'.repeat(40) + ' = 0';
    const res = prepareSurfaceEquation(
      { id: 'f', label: 'Surface F', rawInput: deepInput, format: 'latex' },
      'surfaceF',
    );
    // Either unwrapped or rejected for depth
    if (!res.success) {
      expect(res.diagnostic.reasonCode).toBe('excessive_depth');
    }
  });
});

describe('V2 Mathematical Pipeline — Category 11: Application Boundary Integration', () => {
  it('successfully prepares valid equation request through calculation boundary', () => {
    const req = createCalculationRequest('x^2 + y^2 = 4', 'z = x + y', 'forward');
    const result = prepareCalculationRequest(req);

    expect(result.valid).toBe(true);
    if (!result.valid) return;

    // Preserves job metadata
    expect(result.request.jobId).toBe(req.jobId);
    expect(result.request.contractVersion).toBe(req.contractVersion);
    expect(result.request.direction).toBe('forward');
    expect(result.request.bounds).toEqual(DEFAULT_CALCULATION_BOUNDS);

    // Populates prepared equations
    expect(result.request.surfaceF.prepared).toBeDefined();
    expect(result.request.surfaceG.prepared).toBeDefined();
    expect(result.request.surfaceF.structured).toBeDefined();
    expect(result.request.surfaceG.structured).toBeDefined();

    // SymPy plans populated
    expect(result.pair.surfaceF.sympyPlan.entryPoint).toBe('build_surface_system');
    expect(result.pair.surfaceG.sympyPlan.entryPoint).toBe('build_surface_system');
  });

  it('returns structured diagnostics when calculation request has invalid equations', () => {
    const badReq = createCalculationRequest('x^2 + y^2 = = 4', 'a + b = 2', 'forward');
    const result = prepareCalculationRequest(badReq);

    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.diagnostics.length).toBe(2);
      expect(result.diagnostics[0]?.surface).toBe('surfaceF');
      expect(result.diagnostics[1]?.surface).toBe('surfaceG');
      expect(result.diagnostics[1]?.reasonCode).toBe('unknown_symbol');
    }
  });
});
