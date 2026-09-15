/**
 * Worker message envelope contracts for Intersect.
 *
 * Architecture & Concurrency Rules:
 * - Pyodide/SymPy computation executes inside a dedicated Web Worker (V3).
 * - All messages between UI and Worker are pure JSON-serializable structures.
 * - Stale ID Rejection: The main UI tracks `activeJobId` and `workerGeneration`.
 *   Any WorkerResponse whose `workerGeneration` does not match the controller's active generation,
 *   or whose `jobId` does not match `activeJobId`, MUST be discarded immediately
 *   to prevent race conditions from superseded jobs or terminated/respawned workers.
 * - Single Active Computation Policy: Submitting a new job cancels / replaces the prior job.
 * - Workers can be sent cancellation signals and terminated if busy.
 */

import type { CalculationRequest } from './calculation';
import type { CalculationResult } from './results';
import type { SymPyConstructionPlan } from './expressions';

export const WORKER_PROTOCOL_VERSION = '1.0.0';

export interface BaseWorkerMessage {
  readonly requestId: string;
  readonly protocolVersion: string;
  readonly workerGeneration?: number;
}

export interface SymPySurfaceSummary {
  readonly equationStr: string;
  readonly lhsStr: string;
  readonly rhsStr: string;
  readonly residualStr: string;
  readonly simplifiedResidualStr: string;
  readonly variables: readonly string[];
  readonly domainConditions: readonly {
    readonly id: string;
    readonly kind: string;
    readonly conditionStr: string;
    readonly description: string;
  }[];
  readonly isPolynomial: boolean;
  readonly degree: number | null;
  readonly isConstantIdentity: boolean;
  readonly isConstantContradiction: boolean;
}

export interface PreparedExpressionsSummary {
  readonly surfaceF: SymPySurfaceSummary;
  readonly surfaceG: SymPySurfaceSummary;
  readonly systemVariables: readonly string[];
  readonly totalDomainObligations: number;
  readonly hasIdentity: boolean;
  readonly hasContradiction: boolean;
  readonly runtimeInfo?: {
    readonly pyodideVersion: string;
    readonly pythonVersion: string;
    readonly sympyVersion: string;
    readonly mpmathVersion: string;
  };
}

export type WorkerRequest =
  | InitWorkerRequest
  | PrepareExpressionsRequest
  | StartCalculationRequest
  | CancelJobRequest
  | PingWorkerRequest
  | TestBusyWorkerRequest;

export interface InitWorkerRequest extends BaseWorkerMessage {
  readonly type: 'init';
  readonly pyodideBaseUrl: string;
}

export interface PrepareExpressionsRequest extends BaseWorkerMessage {
  readonly type: 'prepare-expressions';
  readonly jobId: string;
  readonly payload: {
    readonly surfaceF: SymPyConstructionPlan;
    readonly surfaceG: SymPyConstructionPlan;
  };
}

export interface StartCalculationRequest extends BaseWorkerMessage {
  readonly type: 'start-calculation';
  readonly jobId: string;
  readonly payload: CalculationRequest;
}

export interface CancelJobRequest extends BaseWorkerMessage {
  readonly type: 'cancel';
  readonly targetJobId: string;
  readonly reason?: string;
}

export interface PingWorkerRequest extends BaseWorkerMessage {
  readonly type: 'ping';
}

/** Application-owned test fixture for testing busy worker preemption and timeouts */
export interface TestBusyWorkerRequest extends BaseWorkerMessage {
  readonly type: 'test-busy-loop';
  readonly jobId: string;
  readonly durationMs: number;
}

export type WorkerResponse =
  | WorkerReadyResponse
  | PongResponse
  | CalculationProgressResponse
  | PreparedExpressionsResponse
  | CalculationResultResponse
  | JobCancelledResponse
  | WorkerErrorResponse;

export interface WorkerReadyResponse extends BaseWorkerMessage {
  readonly type: 'worker-ready';
  readonly runtimeInfo: {
    readonly pyodideVersion: string;
    readonly pythonVersion: string;
    readonly sympyVersion: string;
    readonly mpmathVersion: string;
  };
}

export interface PongResponse extends BaseWorkerMessage {
  readonly type: 'pong';
  readonly timestamp: number;
}

export interface CalculationProgressResponse extends BaseWorkerMessage {
  readonly type: 'progress';
  readonly jobId: string;
  readonly stage: 'loading-runtime' | 'loading-packages' | 'preparing-expressions' | string;
  readonly percent?: number;
  readonly message?: string;
}

export interface PreparedExpressionsResponse extends BaseWorkerMessage {
  readonly type: 'prepared-expressions';
  readonly jobId: string;
  readonly summary: PreparedExpressionsSummary;
}

export interface CalculationResultResponse extends BaseWorkerMessage {
  readonly type: 'result';
  readonly jobId: string;
  readonly result: CalculationResult;
}

export interface JobCancelledResponse extends BaseWorkerMessage {
  readonly type: 'cancelled';
  readonly jobId: string;
  readonly reason: string;
}

export interface WorkerErrorResponse extends BaseWorkerMessage {
  readonly type: 'error';
  readonly jobId?: string;
  readonly error: {
    readonly code: string;
    readonly message: string;
    readonly fatal: boolean;
    readonly details?: string;
  };
}

/**
 * Validates that an incoming response matches the currently active job ID and worker generation.
 * Returns true if the message is fresh and should be processed; false if stale.
 */
export function isFreshWorkerMessage(
  response: WorkerResponse,
  activeJobId: string | null,
  activeGeneration?: number,
): boolean {
  // If active generation is tracked, messages from dead worker generations are rejected
  if (
    activeGeneration !== undefined &&
    response.workerGeneration !== undefined &&
    response.workerGeneration !== activeGeneration
  ) {
    return false;
  }

  // Job-specific responses must match activeJobId
  if ('jobId' in response && response.jobId) {
    if (!activeJobId) return false;
    return response.jobId === activeJobId;
  }

  return true;
}
