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