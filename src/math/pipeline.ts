/**
 * Mathematical input and conversion pipeline for Intersect Phase V2.
 *
 * Coordinates parsing, AST conversion, semantic validation, domain collection,
 * and safe SymPy construction plan generation.
 */

import type {
  EquationInput,
  EquationDiagnostic,
  PreparedEquation,
  PreparedEquationPair,
} from '../contracts/expressions';
import { parseMathInput } from './parser';
import { validateAndClassifyEquation } from './validator';
import { collectDomainObligations } from './domain';
import { buildSymPyConstructionPlan } from './sympy-bridge';

export interface SurfacePreparationSuccess {
  readonly success: true;
  readonly equation: PreparedEquation;
}

export interface SurfacePreparationFailure {
  readonly success: false;
  readonly diagnostic: EquationDiagnostic;
}

export type SurfacePreparationResult =
  | SurfacePreparationSuccess
  | SurfacePreparationFailure;

export interface PairPreparationSuccess {
  readonly success: true;
  readonly pair: PreparedEquationPair;
}

export interface PairPreparationFailure {
  readonly success: false;
  readonly diagnostics: readonly EquationDiagnostic[];
}

export type PairPreparationResult =
  | PairPreparationSuccess
  | PairPreparationFailure;

/**
 * Prepares a single surface equation through the V2 mathematical conversion pipeline.
 */
export function prepareSurfaceEquation(
  input: EquationInput,
  surface: 'surfaceF' | 'surfaceG',
): SurfacePreparationResult {
  // Step 1: Parse input into lossless ExpressionNode AST
  const parseResult = parseMathInput(input.rawInput, surface);
  if (!parseResult.success) {
    return { success: false, diagnostic: parseResult.diagnostic };
  }

  // Step 2: Validate equation rules, extract variables, and form zero residual
  const validationResult = validateAndClassifyEquation(
    parseResult.ast,
    input.rawInput,
    surface,
  );
  if (!validationResult.success) {
    return { success: false, diagnostic: validationResult.diagnostic };
  }

  const { lhs, rhs, residual, classification, variables } = validationResult.equation;

  // Step 3: Collect symbolic real-domain obligations
  const prefix = surface === 'surfaceF' ? 'dom-f' : 'dom-g';
  const domainObligations = collectDomainObligations(residual, prefix);

  // Step 4: Build safe, typed allowlisted SymPy construction plan
  const sympyPlan = buildSymPyConstructionPlan(
    lhs,
    rhs,
    residual,
    variables,
    domainObligations,
  );

  const preparedEquation: PreparedEquation = {
    id: input.id,
    label: input.label,
    rawInput: input.rawInput,
    classification,
    variables,
    lhs,
    rhs,
    residual,
    domainObligations,
    sympyPlan,
  };

  return {
    success: true,
    equation: preparedEquation,
  };
}

/**
 * Prepares an equation pair for Surface F and Surface G through the calculation pipeline.
 * Collects diagnostics for both surfaces if errors are present.
 */
export function prepareEquationPair(
  surfaceFInput: EquationInput,
  surfaceGInput: EquationInput,
): PairPreparationResult {
  const fResult = prepareSurfaceEquation(surfaceFInput, 'surfaceF');
  const gResult = prepareSurfaceEquation(surfaceGInput, 'surfaceG');

  const diagnostics: EquationDiagnostic[] = [];
  if (!fResult.success) {
    diagnostics.push(fResult.diagnostic);
  }
  if (!gResult.success) {
    diagnostics.push(gResult.diagnostic);
  }

  if (diagnostics.length > 0) {
    return { success: false, diagnostics };
  }

  const surfaceF = (fResult as SurfacePreparationSuccess).equation;
  const surfaceG = (gResult as SurfacePreparationSuccess).equation;

  const allVarsSet = new Set<('x' | 'y' | 'z')>([
    ...surfaceF.variables,
    ...surfaceG.variables,
  ]);
  const allVariables = (['x', 'y', 'z'] as const).filter((v) => allVarsSet.has(v));

  const hasContradiction =
    surfaceF.classification === 'constant-contradiction' ||
    surfaceG.classification === 'constant-contradiction';

  const hasIdentity =
    surfaceF.classification === 'constant-identity' ||
    surfaceG.classification === 'constant-identity';

  return {
    success: true,
    pair: {
      surfaceF,
      surfaceG,
      allVariables,
      hasContradiction,
      hasIdentity,
    },
  };
}
