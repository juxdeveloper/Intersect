/**
 * Calculation request contracts for Intersect.
 */

import { DEFAULT_CALCULATION_BOUNDS, validateBounds, type WorldBounds } from './bounds';
import {
  type EquationInput,
  type PreparedEquationPair,
  type EquationDiagnostic,
  validateEquationInput,
} from './expressions';
import type { TraversalDirection } from './curve';
import { prepareEquationPair } from '../math/pipeline';

export const CURRENT_CONTRACT_VERSION = '1.0.0';

export interface CalculationRequest {
  /** Unique identifier for the calculation job (used for stale-request rejection and cancellation) */
  readonly jobId: string;
  /** Schema contract version */
  readonly contractVersion: string;
  /** Surface F input */
  readonly surfaceF: EquationInput;
  /** Surface G input */
  readonly surfaceG: EquationInput;
  /** Forward (increasing t) or Reverse traversal */
  readonly direction: TraversalDirection;
  /** World calculation bounding box */
  readonly bounds: WorldBounds;
  /** Epoch timestamp in ms when requested */
  readonly submittedAt: number;
}

export function createCalculationRequest(
  surfaceFRaw: string,
  surfaceGRaw: string,
  direction: TraversalDirection = 'forward',
  bounds: WorldBounds = DEFAULT_CALCULATION_BOUNDS,
  jobId: string = `job-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
): CalculationRequest {
  return {
    jobId,
    contractVersion: CURRENT_CONTRACT_VERSION,
    surfaceF: {
      id: 'surface-f',
      label: 'Surface F',
      rawInput: surfaceFRaw,
      format: 'latex',
    },
    surfaceG: {
      id: 'surface-g',
      label: 'Surface G',
      rawInput: surfaceGRaw,
      format: 'latex',
    },
    direction,
    bounds,
    submittedAt: Date.now(),
  };
}

export function validateCalculationRequest(req: CalculationRequest): { valid: boolean; error?: string } {
  if (!req.jobId || req.jobId.trim().length === 0) {
    return { valid: false, error: 'Job ID must be a non-empty string.' };
  }

  const fValidation = validateEquationInput(req.surfaceF);
  if (!fValidation.valid) return fValidation;

  const gValidation = validateEquationInput(req.surfaceG);
  if (!gValidation.valid) return gValidation;

  const boundsValidation = validateBounds(req.bounds);
  if (!boundsValidation.valid) return boundsValidation;

  if (req.direction !== 'forward' && req.direction !== 'reverse') {
    return { valid: false, error: `Invalid direction: ${req.direction}` };
  }

  return { valid: true };
}

export type PreparedCalculationRequestResult =
  | {
      readonly valid: true;
      readonly request: CalculationRequest;
      readonly pair: PreparedEquationPair;
    }
  | {
      readonly valid: false;
      readonly error: string;
      readonly diagnostics: readonly EquationDiagnostic[];
    };

/**
 * Validates calculation request bounds/metadata and processes both surface equations
 * through the V2 mathematical preparation pipeline.
 */
export function prepareCalculationRequest(req: CalculationRequest): PreparedCalculationRequestResult {
  const baseValidation = validateCalculationRequest(req);
  if (!baseValidation.valid) {
    return {
      valid: false,
      error: baseValidation.error ?? 'Invalid calculation request.',
      diagnostics: [],
    };
  }

  const prepResult = prepareEquationPair(req.surfaceF, req.surfaceG);
  if (!prepResult.success) {
    const errorMessages = prepResult.diagnostics.map((d) => `${d.surface === 'surfaceF' ? 'Surface F' : 'Surface G'}: ${d.message}`).join(' ');
    return {
      valid: false,
      error: errorMessages,
      diagnostics: prepResult.diagnostics,
    };
  }

  const preparedSurfaceF: EquationInput = {
    ...req.surfaceF,
    structured: prepResult.pair.surfaceF.residual,
    prepared: prepResult.pair.surfaceF,
  };

  const preparedSurfaceG: EquationInput = {
    ...req.surfaceG,
    structured: prepResult.pair.surfaceG.residual,
    prepared: prepResult.pair.surfaceG,
  };

  const preparedRequest: CalculationRequest = {
    ...req,
    surfaceF: preparedSurfaceF,
    surfaceG: preparedSurfaceG,
  };

  return {
    valid: true,
    request: preparedRequest,
    pair: prepResult.pair,
  };
}
