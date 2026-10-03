/**
 * Main-thread Geometry Controller for Intersect Phase V6.
 *
 * Architecture & Concurrency Rules:
 * 1. DEDICATED GEOMETRY WORKER:
 *    Executes CPU-intensive meshing and curve sampling in a background Web Worker.
 * 2. STALE-RESULT PROTECTION:
 *    Guards against race conditions using worker generations and job IDs.
 *    Superseded responses from earlier camera movements or stale directions are immediately dropped.
 * 3. TRANSFERABLE BUFFER OWNERSHIP:
 *    Upon receipt of geometry result, the main thread acquires sole ownership of the ArrayBuffers.
 * 4. CANCELLATION & PREEMPTION:
 *    Issuing a new request automatically cancels/preempts the prior in-flight request.
 * 5. TESTABLE IN-PROCESS FALLBACK:
 *    Can run synchronously in-process when Web Workers are unavailable in headless test runners.
 */

import type {
  GeometryRequest,
  GeometryResult,
  GeometryWorkerRequest,
  GeometryWorkerResponse,
} from '../contracts/geometry';
import { generateGeometry } from './geometry-generator';

export type GeometryControllerState =
  | 'idle'
  | 'generating'
  | 'refining'
  | 'ready'
  | 'failed'
  | 'cancelled'
  | 'disposed';

export interface GeometryStateSnapshot {
  readonly state: GeometryControllerState;
  readonly activeJobId: string | null;
  readonly workerGeneration: number;
  readonly lastResult: GeometryResult | null;
  readonly error: string | null;
}

export interface GeometryControllerOptions {
  readonly workerFactory?: () => Worker;
  readonly timeoutMs?: number;
  readonly enableInProcessFallback?: boolean;
}

export class GeometryController {
  private worker: Worker | null = null;
  private workerGeneration = 1;
  private state: GeometryControllerState = 'idle';
  private lastResult: GeometryResult | null = null;
  private lastError: string | null = null;

  private activeJobId: string | null = null;
  private activeResolver: ((res: GeometryResult) => void) | null = null;
  private activeRejecter: ((err: Error) => void) | null = null;
  private activeTimeoutTimer: ReturnType<typeof setTimeout> | null = null;

  private readonly hasCustomWorkerFactory: boolean;
  private readonly workerFactory: () => Worker;
  private readonly timeoutMs: number;
  private readonly enableFallback: boolean;
  private readonly listeners = new Set<(snapshot: GeometryStateSnapshot) => void>();

  constructor(options: GeometryControllerOptions = {}) {
    this.timeoutMs = options.timeoutMs ?? 30_000;
    this.enableFallback = options.enableInProcessFallback ?? true;
    this.hasCustomWorkerFactory = Boolean(options.workerFactory);

    this.workerFactory =
      options.workerFactory ??
      (() => {
        return new Worker(new URL('./geometry.worker.ts', import.meta.url), { type: 'module' });
      });
  }

  public getSnapshot(): GeometryStateSnapshot {
    return {
      state: this.state,
      activeJobId: this.activeJobId,
      workerGeneration: this.workerGeneration,
      lastResult: this.lastResult,
      error: this.lastError,
    };
  }

  public subscribe(listener: (snapshot: GeometryStateSnapshot) => void): () => void {
    this.listeners.add(listener);
    listener(this.getSnapshot());
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    const snap = this.getSnapshot();
    for (const listener of this.listeners) {
      try {
        listener(snap);
      } catch (err) {
        console.error('GeometryController listener error:', err);
      }
    }
  }

  private ensureWorker(): boolean {
    if (this.worker) return true;

    if (!this.hasCustomWorkerFactory && (typeof window === 'undefined' || typeof Worker === 'undefined')) {
      return false;
    }

    try {
      this.worker = this.workerFactory();

      this.worker.onmessage = (event: MessageEvent<GeometryWorkerResponse>) => {
        this.handleWorkerMessage(event.data);
      };

      this.worker.onerror = (err) => {
        this.handleWorkerError(err);
      };

      return true;
    } catch {
      return false;
    }
  }

  private handleWorkerMessage(msg: GeometryWorkerResponse) {
    switch (msg.type) {
      case 'geometry-preview': {
        if (msg.result.workerGeneration !== this.workerGeneration || msg.result.jobId !== this.activeJobId) return;
        this.lastResult = msg.result;
        this.state = 'refining';
        this.notify();
        break;
      }
      case 'geometry-result': {
        // Stale result rejection: discard if worker generation or jobId does not match active job
        if (msg.result.workerGeneration !== this.workerGeneration) {
          return;
        }
        if (msg.result.jobId !== this.activeJobId) {
          // Stale job response from superseded calculation
          return;
        }

        this.clearActiveTimeout();
        this.lastResult = msg.result;
        this.lastError = null;
        this.state = 'ready';

        const resolver = this.activeResolver;
        this.activeResolver = null;
        this.activeRejecter = null;
        this.activeJobId = null;

        this.notify();
        resolver?.(msg.result);
        break;
      }

      case 'geometry-cancelled': {
        if (msg.jobId === this.activeJobId) {
          this.clearActiveTimeout();
          this.state = 'cancelled';
          const rejecter = this.activeRejecter;
          this.activeResolver = null;
          this.activeRejecter = null;
          this.activeJobId = null;

          this.notify();
          rejecter?.(new Error(`Geometry cancelled: ${msg.reason ?? 'superseded'}`));
        }
        break;
      }

      case 'geometry-error': {
        if (msg.jobId === this.activeJobId) {
          this.clearActiveTimeout();
          this.state = 'failed';
          this.lastError = msg.message;
          const rejecter = this.activeRejecter;
          this.activeResolver = null;
          this.activeRejecter = null;
          this.activeJobId = null;

          this.notify();
          rejecter?.(new Error(`Geometry worker error: ${msg.message}`));
        }
        break;
      }

      case 'pong':
        break;

      default:
        break;
    }
  }

  private handleWorkerError(err: ErrorEvent) {
    this.clearActiveTimeout();
    this.state = 'failed';
    this.lastError = err.message || 'Unknown Web Worker error';

    const rejecter = this.activeRejecter;
    this.activeResolver = null;
    this.activeRejecter = null;
    this.activeJobId = null;

    this.notify();
    rejecter?.(new Error(`Geometry worker runtime error: ${this.lastError}`));
  }

  private clearActiveTimeout() {
    if (this.activeTimeoutTimer) {
      clearTimeout(this.activeTimeoutTimer);
      this.activeTimeoutTimer = null;
    }
  }

  /**
   * Generates surface and curve geometry.
   * Automatically supersedes/cancels any previous in-flight request.
   */
  public async requestGeometry(request: GeometryRequest): Promise<GeometryResult> {
    // Preempt active job if present
    if (this.activeJobId) {
      this.cancelCurrentJob('Superseded by new geometry request');
    }

    this.workerGeneration++;
    this.activeJobId = request.jobId;
    this.state = 'generating';
    this.lastError = null;
    this.notify();

    const requestWithGen: GeometryRequest = {
      ...request,
      workerGeneration: this.workerGeneration,
    };

    // Check if worker is available
    const hasWorker = this.ensureWorker();

    if (!hasWorker && this.enableFallback) {
      // In-process synchronous fallback
      try {
        const result = generateGeometry(requestWithGen);
        this.lastResult = result;
        this.state = 'ready';
        this.activeJobId = null;
        this.notify();
        return result;
      } catch (err) {
        this.state = 'failed';
        this.lastError = err instanceof Error ? err.message : String(err);
        this.activeJobId = null;
        this.notify();
        throw err;
      }
    }

    if (!this.worker) {
      throw new Error('Geometry Web Worker could not be initialized.');
    }

    return new Promise<GeometryResult>((resolve, reject) => {
      this.activeResolver = resolve;
      this.activeRejecter = reject;

      // Timeout watchdog
      this.activeTimeoutTimer = setTimeout(() => {
        if (this.activeJobId === requestWithGen.jobId) {
          this.cancelCurrentJob('Geometry calculation timed out');
        }
      }, this.timeoutMs);

      const workerMsg: GeometryWorkerRequest = {
        type: 'generate-geometry',
        request: requestWithGen,
      };

      try {
        this.worker?.postMessage(workerMsg);
      } catch (postErr) {
        this.clearActiveTimeout();
        this.state = 'failed';
        this.activeJobId = null;
        this.notify();
        reject(postErr);
      }
    });
  }

  /**
   * Cancels the active geometry generation.
   */
  public cancelCurrentJob(reason = 'Client cancelled geometry calculation'): void {
    if (!this.activeJobId) return;

    this.clearActiveTimeout();
    // Meshing is synchronous inside the worker. A queued cancellation message
    // cannot interrupt it; terminating prevents obsolete zoom jobs accumulating.
    this.terminateAndRespawnWorker();

    const rejecter = this.activeRejecter;
    this.activeResolver = null;
    this.activeRejecter = null;
    this.activeJobId = null;
    this.state = 'cancelled';
    this.notify();

    rejecter?.(new Error(`Geometry cancelled: ${reason}`));
  }

  private terminateAndRespawnWorker() {
    if (this.worker) {
      try {
        this.worker.terminate();
      } catch {
        // Ignore
      }
      this.worker = null;
    }
    this.workerGeneration++;
  }

  public dispose(): void {
    this.clearActiveTimeout();
    if (this.worker) {
      try {
        this.worker.terminate();
      } catch {
        // Ignore
      }
      this.worker = null;
    }
    this.state = 'disposed';
    this.listeners.clear();
  }
}
