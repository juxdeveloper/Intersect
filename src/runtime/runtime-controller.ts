/**
 * Intersect — Pyodide/SymPy Runtime Controller (Phase V3)
 *
 * Concurrency & Architecture Guarantees:
 * 1. Single Active Computation Policy: Submitting a new job cancels/replaces any in-flight job.
 * 2. Dedicated Web Worker: Heavy mathematical processing never blocks the browser UI thread.
 * 3. Dependable Preemption: If a busy synchronous Python worker cannot respond to cancellation
 *    within a strict grace threshold, the controller forcibly terminates the worker and
 *    spawns a fresh worker generation.
 * 4. Stale ID & Generation Rejection: Messages from terminated/replaced workers or older jobs
 *    are immediately discarded based on `workerGeneration` and `jobId`.
 * 5. Distinct Deadlines: Initialization (default 60s) and execution (default 30s) have separate deadlines.
 * 6. Clean Settlement: Every pending request is settled exactly once on success, timeout, cancellation,
 *    worker crash, or controller disposal. Timers and listeners are cleared.
 */

import {
  type WorkerResponse,
  type PreparedExpressionsSummary,
  type CancelJobRequest,
  type PrepareExpressionsRequest,
  type StartCalculationRequest,
  type InitWorkerRequest,
  type TestBusyWorkerRequest,
  WORKER_PROTOCOL_VERSION,
  isFreshWorkerMessage,
} from '../contracts/worker';
import type { SymPyConstructionPlan } from '../contracts/expressions';
import type { CalculationRequest } from '../contracts/calculation';
import type { CalculationResult } from '../contracts/results';

export type RuntimeLifecycleState =
  | 'idle'
  | 'initializing'
  | 'ready'
  | 'busy'
  | 'failed'
  | 'disposed';

export interface RuntimeInfo {
  readonly pyodideVersion: string;
  readonly pythonVersion: string;
  readonly sympyVersion: string;
  readonly mpmathVersion: string;
}

export interface RuntimeStateSnapshot {
  readonly state: RuntimeLifecycleState;
  readonly stage: string;
  readonly workerGeneration: number;
  readonly activeJobId: string | null;
  readonly runtimeInfo: RuntimeInfo | null;
  readonly error: string | null;
}

export interface ControllerOptions {
  readonly pyodideBaseUrl?: string;
  readonly initTimeoutMs?: number;
  readonly execTimeoutMs?: number;
  readonly cancellationGraceMs?: number;
  readonly workerFactory?: () => Worker;
}

interface PendingJob {
  readonly jobId: string;
  readonly type: 'prepare-expressions' | 'test-busy-loop' | 'start-calculation';
  readonly resolve: (result: any) => void;
  readonly reject: (error: Error) => void;
  readonly timerId: ReturnType<typeof setTimeout>;
  readonly startedAt: number;
}

interface PendingInit {
  readonly resolve: () => void;
  readonly reject: (error: Error) => void;
  readonly timerId: ReturnType<typeof setTimeout>;
}

export const DEFAULT_INIT_TIMEOUT_MS = 60_000;
export const DEFAULT_EXEC_TIMEOUT_MS = 30_000;
export const DEFAULT_CANCELLATION_GRACE_MS = 300;

export class SymPyRuntimeController {
  private worker: Worker | null = null;
  private state: RuntimeLifecycleState = 'idle';
  private stage: string = '';
  private workerGeneration: number = 0;
  private runtimeInfo: RuntimeInfo | null = null;
  private lastError: string | null = null;

  private activeJob: PendingJob | null = null;
  private cancellingJobId: string | null = null;
  private pendingInit: PendingInit | null = null;
  private cancellationTimerId: ReturnType<typeof setTimeout> | null = null;

  private readonly listeners = new Set<(snapshot: RuntimeStateSnapshot) => void>();
  private readonly pyodideBaseUrl: string;
  private readonly initTimeoutMs: number;
  private readonly execTimeoutMs: number;
  private readonly cancellationGraceMs: number;
  private readonly workerFactory: () => Worker;

  constructor(options: ControllerOptions = {}) {
    this.initTimeoutMs = options.initTimeoutMs ?? DEFAULT_INIT_TIMEOUT_MS;
    this.execTimeoutMs = options.execTimeoutMs ?? DEFAULT_EXEC_TIMEOUT_MS;
    this.cancellationGraceMs = options.cancellationGraceMs ?? DEFAULT_CANCELLATION_GRACE_MS;

    // Resolve Pyodide base path relative to HTML base or location
    if (options.pyodideBaseUrl) {
      this.pyodideBaseUrl = options.pyodideBaseUrl;
    } else if (typeof document !== 'undefined' && document.baseURI) {
      this.pyodideBaseUrl = new URL('pyodide/', document.baseURI).href;
    } else if (typeof window !== 'undefined' && window.location) {
      this.pyodideBaseUrl = new URL('pyodide/', window.location.href).href;
    } else {
      this.pyodideBaseUrl = './pyodide/';
    }

    this.workerFactory =
      options.workerFactory ??
      (() => {
        return new Worker(new URL('./sympy.worker.ts', import.meta.url), { type: 'module' });
      });
  }

  public getSnapshot(): RuntimeStateSnapshot {
    return {
      state: this.state,
      stage: this.stage,
      workerGeneration: this.workerGeneration,
      activeJobId: this.activeJob?.jobId ?? null,
      runtimeInfo: this.runtimeInfo,
      error: this.lastError,
    };
  }

  public subscribe(listener: (snapshot: RuntimeStateSnapshot) => void): () => void {
    this.listeners.add(listener);
    listener(this.getSnapshot());
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    const snapshot = this.getSnapshot();
    for (const listener of this.listeners) {
      try {
        listener(snapshot);
      } catch (err) {
        console.error('Error in runtime controller listener:', err);
      }
    }
  }

  private setState(newState: RuntimeLifecycleState, stage: string = '', error: string | null = null): void {
    this.state = newState;
    this.stage = stage;
    if (error !== null) {
      this.lastError = error;
    } else if (newState === 'ready' || newState === 'idle') {
      this.lastError = null;
    }
    this.notify();
  }

  /**
   * Lazily spawns or returns the dedicated Web Worker.
   */
  private ensureWorker(): Worker {
    if (this.worker) return this.worker;
    if (this.state === 'disposed') {
      throw new Error('Cannot spawn worker: SymPyRuntimeController has been disposed.');
    }

    this.workerGeneration++;
    const worker = this.workerFactory();

    worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
      this.handleWorkerMessage(event.data);
    };

    worker.onerror = (errorEvent: ErrorEvent) => {
      const errorMsg = errorEvent.message || 'Unknown Web Worker error';
      this.handleWorkerFatal(new Error(`Web Worker fatal error: ${errorMsg}`));
    };

    this.worker = worker;
    return worker;
  }

  /**
   * Initializes the Pyodide/SymPy WebAssembly environment.
   * Can be called explicitly or lazily triggered by the first calculation request.
   */
  public async init(timeoutMs?: number): Promise<void> {
    if (this.state === 'disposed') {
      throw new Error('Controller is disposed.');
    }
    if (this.state === 'ready') {
      return;
    }
    if (this.pendingInit) {
      return new Promise<void>((resolve, reject) => {
        const prevInit = this.pendingInit!;
        const originalResolve = prevInit.resolve;
        const originalReject = prevInit.reject;
        (prevInit as unknown as { resolve: () => void }).resolve = () => {
          originalResolve();
          resolve();
        };
        (prevInit as unknown as { reject: (err: Error) => void }).reject = (err: Error) => {
          originalReject(err);
          reject(err);
        };
      });
    }

    const worker = this.ensureWorker();
    this.setState('initializing', 'loading-runtime');

    const effectiveTimeout = timeoutMs ?? this.initTimeoutMs;

    return new Promise<void>((resolve, reject) => {
      const timerId = setTimeout(() => {
        if (this.pendingInit) {
          const timeoutErr = new Error(
            `Runtime initialization timed out after ${effectiveTimeout}ms. Assets may be slow or unavailable.`,
          );
          this.terminateCurrentWorker(timeoutErr);
          this.setState('failed', '', timeoutErr.message);
          reject(timeoutErr);
        }
      }, effectiveTimeout);

      this.pendingInit = { resolve, reject, timerId };

      const initReq: InitWorkerRequest = {
        type: 'init',
        requestId: `req-init-${Date.now()}`,
        protocolVersion: WORKER_PROTOCOL_VERSION,
        workerGeneration: this.workerGeneration,
        pyodideBaseUrl: this.pyodideBaseUrl,
      };

      worker.postMessage(initReq);
    });
  }

  /**
   * Prepares and analyzes surface equations using real SymPy in the dedicated worker.
   * Enforces the Single Active Computation policy: cancels any previous in-flight calculation.
   */
  public async prepareExpressions(
    plans: {
      readonly surfaceF: SymPyConstructionPlan;
      readonly surfaceG: SymPyConstructionPlan;
    },
    options?: {
      readonly jobId?: string;
      readonly timeoutMs?: number;
    },
  ): Promise<PreparedExpressionsSummary> {
    if (this.state === 'disposed') {
      throw new Error('Controller is disposed.');
    }

    // Cancel prior active job if one exists (Single Active Computation Policy)
    if (this.activeJob) {
      this.cancelActiveJob('Superseded by newer calculation request');
    }

    // Ensure worker is running and initialized
    if (this.state !== 'ready') {
      await this.init();
    }

    const jobId = options?.jobId ?? `job-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const effectiveTimeout = options?.timeoutMs ?? this.execTimeoutMs;
    const worker = this.ensureWorker();

    this.setState('busy', 'preparing-expressions');

    return new Promise<PreparedExpressionsSummary>((resolve, reject) => {
      const timerId = setTimeout(() => {
        if (this.activeJob && this.activeJob.jobId === jobId) {
          const timeoutErr = new Error(`Computation timed out after ${effectiveTimeout}ms.`);
          // Forcibly terminate busy worker to free thread
          this.terminateCurrentWorker(timeoutErr);
          this.setState('ready', '', timeoutErr.message);
          reject(timeoutErr);
        }
      }, effectiveTimeout);

      this.activeJob = {
        jobId,
        type: 'prepare-expressions',
        resolve,
        reject,
        timerId,
        startedAt: Date.now(),
      };

      const req: PrepareExpressionsRequest = {
        type: 'prepare-expressions',
        requestId: `req-prep-${Date.now()}`,
        protocolVersion: WORKER_PROTOCOL_VERSION,
        workerGeneration: this.workerGeneration,
        jobId,
        payload: plans,
      };

      worker.postMessage(req);
    });
  }

  /**
   * Solves exact symbolic surface intersection using real SymPy in the dedicated worker.
   * Returns a verified exact curve parameterization, degenerate outcome, empty intersection,
   * or inconclusive classification.
   * Enforces the Single Active Computation policy: cancels any previous in-flight calculation.
   */
  public async calculateIntersection(
    request: CalculationRequest,
    options?: {
      readonly jobId?: string;
      readonly timeoutMs?: number;
    },
  ): Promise<CalculationResult> {
    if (this.state === 'disposed') {
      throw new Error('Controller is disposed.');
    }

    // Cancel prior active job if one exists (Single Active Computation Policy)
    if (this.activeJob) {
      this.cancelActiveJob('Superseded by newer calculation request');
    }

    // Ensure worker is running and initialized
    if (this.state !== 'ready') {
      await this.init();
    }

    const jobId = options?.jobId ?? `job-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const effectiveTimeout = options?.timeoutMs ?? this.execTimeoutMs;
    const worker = this.ensureWorker();

    this.setState('busy', 'calculating-intersection');

    return new Promise<CalculationResult>((resolve, reject) => {
      const timerId = setTimeout(() => {
        if (this.activeJob && this.activeJob.jobId === jobId) {
          const timeoutErr = new Error(`Computation timed out after ${effectiveTimeout}ms.`);
          // Forcibly terminate busy worker to free thread
          this.terminateCurrentWorker(timeoutErr);
          this.setState('ready', '', timeoutErr.message);
          reject(timeoutErr);
        }
      }, effectiveTimeout);

      this.activeJob = {
        jobId,
        type: 'start-calculation',
        resolve,
        reject,
        timerId,
        startedAt: Date.now(),
      };

      const req: StartCalculationRequest = {
        type: 'start-calculation',
        requestId: `req-calc-${Date.now()}`,
        protocolVersion: WORKER_PROTOCOL_VERSION,
        workerGeneration: this.workerGeneration,
        jobId,
        payload: request,
      };

      worker.postMessage(req);
    });
  }

  /**
   * Application-owned test fixture for testing busy worker preemption.
   */
  public async testBusyWorker(durationMs: number, timeoutMs?: number): Promise<void> {
    if (this.state === 'disposed') throw new Error('Controller is disposed.');

    if (this.activeJob) {
      this.cancelActiveJob('Superseded by busy loop test');
    }

    if (this.state !== 'ready') {
      await this.init();
    }

    const jobId = `busy-${Date.now()}`;
    const effectiveTimeout = timeoutMs ?? this.execTimeoutMs;
    const worker = this.ensureWorker();

    this.setState('busy', 'busy-test');

    return new Promise<void>((resolve, reject) => {
      const timerId = setTimeout(() => {
        if (this.activeJob && this.activeJob.jobId === jobId) {
          const timeoutErr = new Error(`Busy worker timed out after ${effectiveTimeout}ms.`);
          this.terminateCurrentWorker(timeoutErr);
          this.setState('ready', '', timeoutErr.message);
          reject(timeoutErr);
        }
      }, effectiveTimeout);

      this.activeJob = {
        jobId,
        type: 'test-busy-loop',
        resolve: () => resolve(),
        reject,
        timerId,
        startedAt: Date.now(),
      };

      const req: TestBusyWorkerRequest = {
        type: 'test-busy-loop',
        requestId: `req-busy-${Date.now()}`,
        protocolVersion: WORKER_PROTOCOL_VERSION,
        workerGeneration: this.workerGeneration,
        jobId,
        durationMs,
      };

      worker.postMessage(req);
    });
  }

  /**
   * Cancels the active computation immediately.
   * If the worker is engaged in non-yielding synchronous Python code,
   * the worker is forcibly terminated upon expiry of the cancellation grace period.
   */
  public cancelActiveJob(reason = 'User cancelled computation'): void {
    if (!this.activeJob) return;

    const job = this.activeJob;
    clearTimeout(job.timerId);

    const cancelErr = new Error(`Job cancelled: ${reason}`);
    this.cancellingJobId = job.jobId;

    if (this.worker) {
      const cancelReq: CancelJobRequest = {
        type: 'cancel',
        requestId: `req-cancel-${Date.now()}`,
        protocolVersion: WORKER_PROTOCOL_VERSION,
        workerGeneration: this.workerGeneration,
        targetJobId: job.jobId,
        reason,
      };
      this.worker.postMessage(cancelReq);

      // Start grace timer: If worker doesn't acknowledge cancellation within grace threshold, terminate it
      if (this.cancellationTimerId) clearTimeout(this.cancellationTimerId);
      this.cancellationTimerId = setTimeout(() => {
        if (this.cancellingJobId === job.jobId) {
          this.cancellingJobId = null;
          this.terminateCurrentWorker(cancelErr);
        }
      }, this.cancellationGraceMs);
    }

    this.activeJob = null;
    job.reject(cancelErr);
    this.setState('ready', '', 'Calculation cancelled');
  }

  /**
   * Forcibly terminates the existing Web Worker and clears worker-local state.
   */
  private terminateCurrentWorker(reason: Error): void {
    if (this.cancellationTimerId) {
      clearTimeout(this.cancellationTimerId);
      this.cancellationTimerId = null;
    }

    if (this.activeJob) {
      const job = this.activeJob;
      clearTimeout(job.timerId);
      this.activeJob = null;
      job.reject(reason);
    }

    if (this.pendingInit) {
      const init = this.pendingInit;
      clearTimeout(init.timerId);
      this.pendingInit = null;
      init.reject(reason);
    }

    if (this.worker) {
      try {
        this.worker.terminate();
      } catch {
        // Ignore termination errors
      }
      this.worker = null;
    }
  }

  /**
   * Retries initialization after a previous failure.
   */
  public async retry(): Promise<void> {
    this.terminateCurrentWorker(new Error('Retry initiated.'));
    this.lastError = null;
    this.setState('idle', '');
    return this.init();
  }

  /**
   * Internal worker message router and stale response protector.
   */
  private handleWorkerMessage(msg: WorkerResponse): void {
    // 1. Generation Check: Discard messages from previous worker instances
    if (
      msg.workerGeneration !== undefined &&
      msg.workerGeneration !== this.workerGeneration
    ) {
      return;
    }

    // 2. Route by message type
    switch (msg.type) {
      case 'worker-ready': {
        this.runtimeInfo = msg.runtimeInfo;
        if (this.pendingInit) {
          clearTimeout(this.pendingInit.timerId);
          const resolve = this.pendingInit.resolve;
          this.pendingInit = null;
          this.setState('ready', '');
          resolve();
        } else {
          this.setState('ready', '');
        }
        break;
      }

      case 'progress': {
        if (isFreshWorkerMessage(msg, this.activeJob?.jobId ?? null, this.workerGeneration)) {
          this.stage = msg.stage;
          this.notify();
        }
        break;
      }

      case 'prepared-expressions': {
        if (
          this.activeJob &&
          this.activeJob.jobId === msg.jobId &&
          isFreshWorkerMessage(msg, this.activeJob.jobId, this.workerGeneration)
        ) {
          const job = this.activeJob;
          clearTimeout(job.timerId);
          this.activeJob = null;
          this.setState('ready', '');
          job.resolve(msg.summary);
        }
        break;
      }

      case 'result': {
        if (
          this.activeJob &&
          this.activeJob.jobId === msg.jobId &&
          isFreshWorkerMessage(msg, this.activeJob.jobId, this.workerGeneration)
        ) {
          const job = this.activeJob;
          clearTimeout(job.timerId);
          this.activeJob = null;
          this.setState('ready', '');
          job.resolve(msg.result);
        }
        break;
      }

      case 'cancelled': {
        if (this.cancellationTimerId) {
          clearTimeout(this.cancellationTimerId);
          this.cancellationTimerId = null;
        }
        if (this.cancellingJobId === msg.jobId) {
          this.cancellingJobId = null;
        }
        if (this.activeJob && this.activeJob.jobId === msg.jobId) {
          const job = this.activeJob;
          clearTimeout(job.timerId);
          this.activeJob = null;
          this.setState('ready', '', `Cancelled: ${msg.reason}`);
          job.reject(new Error(`Job cancelled: ${msg.reason}`));
        }
        break;
      }

      case 'pong': {
        if (this.activeJob && this.activeJob.type === 'test-busy-loop') {
          const job = this.activeJob;
          clearTimeout(job.timerId);
          this.activeJob = null;
          this.setState('ready', '');
          job.resolve({} as PreparedExpressionsSummary);
        }
        break;
      }

      case 'error': {
        const error = new Error(msg.error.message);
        if (this.pendingInit) {
          clearTimeout(this.pendingInit.timerId);
          const reject = this.pendingInit.reject;
          this.pendingInit = null;
          this.setState('failed', '', msg.error.message);
          reject(error);
        } else if (this.activeJob && (!msg.jobId || msg.jobId === this.activeJob.jobId)) {
          const job = this.activeJob;
          clearTimeout(job.timerId);
          this.activeJob = null;
          this.setState(msg.error.fatal ? 'failed' : 'ready', '', msg.error.message);
          job.reject(error);
        } else if (msg.error.fatal) {
          this.setState('failed', '', msg.error.message);
        }
        break;
      }
    }
  }

  /**
   * Handles unexpected worker termination or fatal errors.
   */
  private handleWorkerFatal(error: Error): void {
    this.terminateCurrentWorker(error);
    this.setState('failed', '', error.message);
  }

  /**
   * Disposes of the controller and terminates worker.
   */
  public dispose(): void {
    if (this.state === 'disposed') return;

    this.terminateCurrentWorker(new Error('SymPyRuntimeController was disposed.'));
    this.listeners.clear();
    this.setState('disposed', '');
  }
}
