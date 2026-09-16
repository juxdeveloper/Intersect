/**
 * Safe SymPy Construction Plan Bridge for Intersect.
 *
 * Architecture & Security:
 * - Translates validated, lossless ExpressionNode ASTs into a finite, typed allowlisted
 *   construction plan for the future Pyodide/SymPy worker runtime (scheduled for Phase V3).
 * - ZERO executable code generation: no eval(), no Function(), no unconstrained Python string formatting.
 * - The future V3 Python worker traverses this plan using an explicit allowlisted dispatch table:
 *
 *   ```python
 *   # Target V3 Worker Allowlisted Builder (Draft Reference for Phase V3):
 *   DISPATCH = {
 *       'Integer': lambda s: sp.Integer(int(s['value'])),
 *       'Rational': lambda s: sp.Rational(int(s['num']), int(s['den'])),
 *       'Symbol': lambda s: sp.Symbol(s['name'], real=True),
 *       'Constant': lambda s: getattr(sp, s['name']),  # 'pi', 'E'
 *       'Add': lambda s: sp.Add(*[build(a) for a in s['args']]),
 *       'Mul': lambda s: sp.Mul(*[build(a) for a in s['args']]),
 *       'Pow': lambda s: sp.Pow(build(s['args'][0]), build(s['args'][1])),
 *       'Sin': lambda s: sp.sin(build(s['args'][0])),
 *       'Cos': lambda s: sp.cos(build(s['args'][0])),
 *       'Tan': lambda s: sp.tan(build(s['args'][0])),
 *       'Sec': lambda s: sp.sec(build(s['args'][0])),
 *       'Csc': lambda s: sp.csc(build(s['args'][0])),
 *       'Cot': lambda s: sp.cot(build(s['args'][0])),
 *       'ArcSin': lambda s: sp.asin(build(s['args'][0])),
 *       'ArcCos': lambda s: sp.acos(build(s['args'][0])),
 *       'ArcTan': lambda s: sp.atan(build(s['args'][0])),
 *       'Sinh': lambda s: sp.sinh(build(s['args'][0])),
 *       'Cosh': lambda s: sp.cosh(build(s['args'][0])),
 *       'Tanh': lambda s: sp.tanh(build(s['args'][0])),
 *       'Exp': lambda s: sp.exp(build(s['args'][0])),
 *       'Log': lambda s: sp.log(build(s['args'][0])),
 *       'Sqrt': lambda s: sp.sqrt(build(s['args'][0])),
 *       'Abs': lambda s: sp.Abs(build(s['args'][0])),
 *       'Eq': lambda s: sp.Eq(build(s['args'][0]), build(s['args'][1])),
 *   }
 *   ```
 *
 * - Phase V3 Verification Responsibilities:
 *   1. Rational powers: SymPy's default `(-1)**(1/3)` evaluates to complex `1/2 + sqrt(3)/2*I`.
 *      V3 must ensure real branch evaluation (e.g. `sp.real_root` or real power assumptions).
 *   2. Automatic simplification: SymPy automatically simplifies `x/x` to `1` when creating expressions.
 *      V3 must preserve and cross-check the recorded domain conditions against candidate parameterizations.
 */

import type {
  ExpressionNode,
  SymPyConstructionStep,
  SymPyConstructionPlan,
  DomainObligation,
} from '../contracts/expressions';
import {
  isNumberNode,
  isSymbolNode,
  isOperatorNode,
  isRelationNode,
} from './ast';

/**
 * Converts an ExpressionNode into a typed, finite SymPy construction step.
 */
export function convertToSymPyStep(node: ExpressionNode): SymPyConstructionStep {
  if (isNumberNode(node)) {
    if (node.exactRational && node.exactRational.den !== '1') {
      return {
        op: 'Rational',
        num: node.exactRational.num,
        den: node.exactRational.den,
      };
    }
    const valStr = node.exactRational ? node.exactRational.num : Math.round(node.value).toString();
    return {
      op: 'Integer',
      value: valStr,
    };
  }

  if (isSymbolNode(node)) {
    if (node.name === 'pi' || node.name === 'Pi') {
      return { op: 'Constant', name: 'pi' };
    }
    if (node.name === 'e' || node.name === 'E' || node.name === 'ExponentialE') {
      return { op: 'Constant', name: 'E' };
    }
    return {
      op: 'Symbol',
      name: node.name,
    };
  }

  if (isOperatorNode(node)) {
    const { op, args } = node;

    switch (op) {
      case 'Add':
        return { op: 'Add', args: args.map(convertToSymPyStep) };

      case 'Subtract':
        if (args.length === 2) {
          return {
            op: 'Add',
            args: [
              convertToSymPyStep(args[0]!),
              {
                op: 'Mul',
                args: [{ op: 'Integer', value: '-1' }, convertToSymPyStep(args[1]!)],
              },
            ],
          };
        }
        return {
          op: 'Mul',
          args: [{ op: 'Integer', value: '-1' }, convertToSymPyStep(args[0]!)],
        };

      case 'Negate':
        return {
          op: 'Mul',
          args: [{ op: 'Integer', value: '-1' }, convertToSymPyStep(args[0]!)],
        };

      case 'Multiply':
        return { op: 'Mul', args: args.map(convertToSymPyStep) };

      case 'Divide':
        return {
          op: 'Mul',
          args: [
            convertToSymPyStep(args[0]!),
            {
              op: 'Pow',
              args: [convertToSymPyStep(args[1]!), { op: 'Integer', value: '-1' }],
            },
          ],
        };

      case 'Power':
        return {
          op: 'Pow',
          args: [convertToSymPyStep(args[0]!), convertToSymPyStep(args[1]!)],
        };

      case 'Sqrt':
        return {
          op: 'Sqrt',
          args: [convertToSymPyStep(args[0]!)],
        };

      case 'Root':
        return {
          op: 'Pow',
          args: [
            convertToSymPyStep(args[0]!),
            {
              op: 'Pow',
              args: [convertToSymPyStep(args[1]!), { op: 'Integer', value: '-1' }],
            },
          ],
        };

      case 'Abs':
        return {
          op: 'Abs',
          args: [convertToSymPyStep(args[0]!)],
        };

      case 'Sin':
        return { op: 'Sin', args: [convertToSymPyStep(args[0]!)] };
      case 'Cos':
        return { op: 'Cos', args: [convertToSymPyStep(args[0]!)] };
      case 'Tan':
        return { op: 'Tan', args: [convertToSymPyStep(args[0]!)] };
      case 'Sec':
        return { op: 'Sec', args: [convertToSymPyStep(args[0]!)] };
      case 'Csc':
        return { op: 'Csc', args: [convertToSymPyStep(args[0]!)] };
      case 'Cot':
        return { op: 'Cot', args: [convertToSymPyStep(args[0]!)] };

      case 'ArcSin':
        return { op: 'ArcSin', args: [convertToSymPyStep(args[0]!)] };
      case 'ArcCos':
        return { op: 'ArcCos', args: [convertToSymPyStep(args[0]!)] };
      case 'ArcTan':
        return { op: 'ArcTan', args: [convertToSymPyStep(args[0]!)] };

      case 'Sinh':
        return { op: 'Sinh', args: [convertToSymPyStep(args[0]!)] };
      case 'Cosh':
        return { op: 'Cosh', args: [convertToSymPyStep(args[0]!)] };
      case 'Tanh':
        return { op: 'Tanh', args: [convertToSymPyStep(args[0]!)] };

      case 'Exp':
        return { op: 'Exp', args: [convertToSymPyStep(args[0]!)] };
      case 'Ln':
      case 'Log':
        return { op: 'Log', args: [convertToSymPyStep(args[0]!)] };

      default:
        throw new Error(`Unsupported operator in SymPy bridge: ${op}`);
    }
  }

  if (isRelationNode(node)) {
    return {
      op: 'Eq',
      args: [convertToSymPyStep(node.lhs), convertToSymPyStep(node.rhs)],
    };
  }

  throw new Error(`Unrecognized ExpressionNode type: ${node.type}`);
}

/**
 * Builds a typed SymPy construction plan from an equation's components.
 */
export function buildSymPyConstructionPlan(
  lhs: ExpressionNode,
  rhs: ExpressionNode,
  residual: ExpressionNode,
  variables: readonly string[],
  domainObligations: readonly DomainObligation[],
): SymPyConstructionPlan {
  const equationStep: SymPyConstructionStep = {
    op: 'Eq',
    args: [convertToSymPyStep(lhs), convertToSymPyStep(rhs)],
  };

  const residualStep = convertToSymPyStep(residual);

  const domainConditions = domainObligations.map((obligation) => ({
    id: obligation.id,
    kind: obligation.kind,
    condition: convertToSymPyStep(obligation.target),
    description: obligation.description,
  }));

  return {
    planVersion: '1.0.0',
    target: 'sympy',
    entryPoint: 'build_surface_system',
    equation: equationStep,
    residual: residualStep,
    variables,
    domainConditions,
  };
}
