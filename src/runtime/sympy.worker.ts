/**
 * Intersect — Dedicated SymPy & Pyodide Web Worker (Phase V3)
 *
 * Responsibilities:
 * 1. Runs entirely inside a dedicated Web Worker off the main browser UI thread.
 * 2. Lazily loads Pyodide WebAssembly runtime and pinned local wheels (SymPy & mpmath) from static assets.
 * 3. Enforces zero remote network requests: all package resolution is strictly local.
 * 4. Executes application-owned Python builder (`SYMPY_BUILDER_PYTHON_SOURCE`) to construct SymPy objects.
 * 5. Returns pure JSON-serializable mathematical summaries, destroying temporary PyProxy objects in finally blocks.
 * 6. Supports cancellation, job progress, and test fixtures for busy preemption verification.
 */

import { loadPyodide, type PyodideInterface } from 'pyodide';
import { SYMPY_BUILDER_PYTHON_SOURCE } from './python-source';
import {
  type WorkerRequest,
  type WorkerResponse,
  type PreparedExpressionsSummary,
  WORKER_PROTOCOL_VERSION,
} from '../contracts/worker';

let pyodideInstance: PyodideInterface | null = null;
let initPromise: Promise<void> | null = null;
let currentGeneration = 0;
let currentJobId: string | null = null;
let isJobCancelled = false;
let resolvedBaseUrl: string = '';
let cachedRuntimeInfo: {
  readonly pyodideVersion: string;
  readonly pythonVersion: string;
  readonly sympyVersion: string;
  readonly mpmathVersion: string;
} | null = null;

function postMsg(response: WorkerResponse): void {
  self.postMessage(response);
}

/**
 * Initializes the Pyodide WebAssembly runtime and loads the pinned SymPy/mpmath wheels from local assets.
 */
async function initializeRuntime(pyodideBaseUrl: string, jobId?: string): Promise<void> {
  if (pyodideInstance) return;
  if (initPromise) return initPromise;

  resolvedBaseUrl = pyodideBaseUrl;
  if (!resolvedBaseUrl.endsWith('/')) {
    resolvedBaseUrl += '/';
  }

  initPromise = (async () => {
    try {
      if (jobId) {
        postMsg({
          requestId: `prog-${Date.now()}`,
          protocolVersion: WORKER_PROTOCOL_VERSION,
          workerGeneration: currentGeneration,
          type: 'progress',
          jobId,
          stage: 'loading-runtime',
          message: 'Loading WebAssembly Python runtime (Pyodide)...',
        });
      }

      const pyodide = await loadPyodide({
        indexURL: resolvedBaseUrl,
        lockFileURL: `${resolvedBaseUrl}pyodide-lock.json`,
      });

      // Override Pyodide's internal CDN URL to point exclusively to the local application base path
      if ((pyodide as unknown as { _api?: { setCdnUrl?: (url: string) => void } })._api?.setCdnUrl) {
        (pyodide as unknown as { _api: { setCdnUrl: (url: string) => void } })._api.setCdnUrl(resolvedBaseUrl);
      }

      if (jobId) {
        postMsg({
          requestId: `prog-${Date.now()}`,
          protocolVersion: WORKER_PROTOCOL_VERSION,
          workerGeneration: currentGeneration,
          type: 'progress',
          jobId,
          stage: 'loading-packages',
          message: 'Loading local SymPy and mpmath packages...',
        });
      }

      // Load local wheels explicitly from the verified local base URL
      const mpmathUrl = `${resolvedBaseUrl}mpmath-1.3.0-py3-none-any.whl`;
      const sympyUrl = `${resolvedBaseUrl}sympy-1.13.3-py3-none-any.whl`;
      await pyodide.loadPackage([mpmathUrl, sympyUrl]);

      // Install application-owned SymPy builder module
      pyodide.runPython(SYMPY_BUILDER_PYTHON_SOURCE);

      pyodideInstance = pyodide;

      // Extract verified runtime versions
      const pythonVersion = pyodide.runPython("import sys; sys.version.split()[0]") as string;
      const sympyVersion = pyodide.runPython("import sympy; sympy.__version__") as string;
      const mpmathVersion = pyodide.runPython("import mpmath; mpmath.__version__") as string;

      cachedRuntimeInfo = {
        pyodideVersion: '0.27.8',
        pythonVersion,
        sympyVersion,
        mpmathVersion,
      };

      postMsg({
        requestId: `ready-${Date.now()}`,
        protocolVersion: WORKER_PROTOCOL_VERSION,
        workerGeneration: currentGeneration,
        type: 'worker-ready',
        runtimeInfo: cachedRuntimeInfo,
      });
    } catch (err: unknown) {
      initPromise = null;
      const errorMsg = err instanceof Error ? err.message : String(err);
      postMsg({
        requestId: `err-${Date.now()}`,
        protocolVersion: WORKER_PROTOCOL_VERSION,
        workerGeneration: currentGeneration,
        type: 'error',
        jobId,
        error: {
          code: 'RUNTIME_INIT_FAILED',
          message: `Failed to initialize local Pyodide/SymPy runtime from ${resolvedBaseUrl}: ${errorMsg}`,
          fatal: true,
          details: errorMsg,
        },
      });
      throw err;
    }
  })();

  return initPromise;
}

self.addEventListener('message', async (event: MessageEvent<WorkerRequest>) => {
  const msg = event.data;
  if (!msg || typeof msg !== 'object' || !('type' in msg)) {
    postMsg({
      requestId: 'unknown',
      protocolVersion: WORKER_PROTOCOL_VERSION,
      workerGeneration: currentGeneration,
      type: 'error',
      error: {
        code: 'MALFORMED_REQUEST',
        message: 'Received invalid or non-object message in worker.',
        fatal: false,
      },
    });
    return;
  }

  if (msg.workerGeneration !== undefined) {
    currentGeneration = msg.workerGeneration;
  }

  if (msg.type === 'ping') {
    postMsg({
      requestId: msg.requestId,
      protocolVersion: WORKER_PROTOCOL_VERSION,
      workerGeneration: currentGeneration,
      type: 'pong',
      timestamp: Date.now(),
    });
    return;
  }

  if (msg.type === 'init') {
    try {
      await initializeRuntime(msg.pyodideBaseUrl);
    } catch {
      // Error is already posted within initializeRuntime
    }
    return;
  }

  if (msg.type === 'cancel') {
    if (currentJobId === msg.targetJobId) {
      isJobCancelled = true;
      postMsg({
        requestId: msg.requestId,
        protocolVersion: WORKER_PROTOCOL_VERSION,
        workerGeneration: currentGeneration,
        type: 'cancelled',
        jobId: msg.targetJobId,
        reason: msg.reason || 'Job cancelled by user request',
      });
    }
    return;
  }

  if (msg.type === 'test-busy-loop') {
    currentJobId = msg.jobId;
    isJobCancelled = false;
    const start = Date.now();
    // Synchronous CPU spin loop to simulate intensive non-yielding Python computation
    while (Date.now() - start < msg.durationMs) {
      // spin
    }
    if (!isJobCancelled) {
      postMsg({
        requestId: msg.requestId,
        protocolVersion: WORKER_PROTOCOL_VERSION,
        workerGeneration: currentGeneration,
        type: 'pong',
        timestamp: Date.now(),
      });
    }
    currentJobId = null;
    return;
  }

  if (msg.type === 'prepare-expressions') {
    const jobId = msg.jobId;
    currentJobId = jobId;
    isJobCancelled = false;

    try {
      if (!pyodideInstance) {
        const defaultBase = resolvedBaseUrl || new URL('./pyodide/', self.location.href).href;
        await initializeRuntime(defaultBase, jobId);
      }

      if (isJobCancelled) {
        postMsg({
          requestId: msg.requestId,
          protocolVersion: WORKER_PROTOCOL_VERSION,
          workerGeneration: currentGeneration,
          type: 'cancelled',
          jobId,
          reason: 'Job cancelled before expression preparation',
        });
        currentJobId = null;
        return;
      }

      postMsg({
        requestId: `prog-${Date.now()}`,
        protocolVersion: WORKER_PROTOCOL_VERSION,
        workerGeneration: currentGeneration,
        type: 'progress',
        jobId,
        stage: 'preparing-expressions',
        message: 'Constructing SymPy expressions and analyzing domain constraints...',
      });

      const plans = msg.payload;
      const pyJson = JSON.stringify(plans);
      const prepareFn = pyodideInstance!.globals.get('prepare_system_json');
      let resultJsonStr: string;
      try {
        resultJsonStr = prepareFn(pyJson);
      } finally {
        prepareFn.destroy();
      }

      if (isJobCancelled) {
        postMsg({
          requestId: msg.requestId,
          protocolVersion: WORKER_PROTOCOL_VERSION,
          workerGeneration: currentGeneration,
          type: 'cancelled',
          jobId,
          reason: 'Job cancelled during expression preparation',
        });
        currentJobId = null;
        return;
      }

      const parsedSummary = JSON.parse(resultJsonStr);
      const summary: PreparedExpressionsSummary = {
        ...parsedSummary,
        runtimeInfo: cachedRuntimeInfo || undefined,
      };

      postMsg({
        requestId: msg.requestId,
        protocolVersion: WORKER_PROTOCOL_VERSION,
        workerGeneration: currentGeneration,
        type: 'prepared-expressions',
        jobId,
        summary,
      });
    } catch (err: unknown) {
      if (!isJobCancelled) {
        const errMsg = err instanceof Error ? err.message : String(err);
        postMsg({
          requestId: msg.requestId,
          protocolVersion: WORKER_PROTOCOL_VERSION,
          workerGeneration: currentGeneration,
          type: 'error',
          jobId,
          error: {
            code: 'EXPRESSION_PREPARATION_FAILED',
            message: `SymPy expression preparation error: ${errMsg}`,
            fatal: false,
            details: errMsg,
          },
        });
      }
    } finally {
      currentJobId = null;
    }
    return;
  }

  if (msg.type === 'start-calculation') {
    const jobId = msg.jobId;
    currentJobId = jobId;
    isJobCancelled = false;

    try {
      if (!pyodideInstance) {
        const defaultBase = resolvedBaseUrl || new URL('./pyodide/', self.location.href).href;
        await initializeRuntime(defaultBase, jobId);
      }

      if (isJobCancelled) {
        postMsg({
          requestId: msg.requestId,
          protocolVersion: WORKER_PROTOCOL_VERSION,
          workerGeneration: currentGeneration,
          type: 'cancelled',
          jobId,
          reason: 'Job cancelled before calculation',
        });
        currentJobId = null;
        return;
      }

      postMsg({
        requestId: `prog-${Date.now()}`,
        protocolVersion: WORKER_PROTOCOL_VERSION,
        workerGeneration: currentGeneration,
        type: 'progress',
        jobId,
        stage: 'solving-intersection',
        message: 'Executing symbolic strategies and certifying exact intersection curve...',
      });

      const req = msg.payload;
      const planF = req.surfaceF.prepared?.sympyPlan;
      const planG = req.surfaceG.prepared?.sympyPlan;
      if (!planF || !planG) {
        throw new Error('CalculationRequest is missing prepared surface construction plans.');
      }

      const solvePayload = {
        surfaceF: planF,
        surfaceG: planG,
        bounds: req.bounds,
        direction: req.direction,
      };

      const pyJson = JSON.stringify(solvePayload);
      const solveFn = pyodideInstance!.globals.get('solve_intersection_json');
      let resultJsonStr: string;
      try {
        resultJsonStr = solveFn(pyJson);
      } finally {
        solveFn.destroy();
      }

      if (isJobCancelled) {
        postMsg({
          requestId: msg.requestId,
          protocolVersion: WORKER_PROTOCOL_VERSION,
          workerGeneration: currentGeneration,
          type: 'cancelled',
          jobId,
          reason: 'Job cancelled during calculation',
        });
        currentJobId = null;
        return;
      }

      const calculationResult = JSON.parse(resultJsonStr);

      postMsg({
        requestId: msg.requestId,
        protocolVersion: WORKER_PROTOCOL_VERSION,
        workerGeneration: currentGeneration,
        type: 'result',
        jobId,
        result: calculationResult,
      });
    } catch (err: unknown) {
      if (!isJobCancelled) {
        const errMsg = err instanceof Error ? err.message : String(err);
        postMsg({
          requestId: msg.requestId,
          protocolVersion: WORKER_PROTOCOL_VERSION,
          workerGeneration: currentGeneration,
          type: 'error',
          jobId,
          error: {
            code: 'CALCULATION_FAILED',
            message: `Exact intersection solving error: ${errMsg}`,
            fatal: false,
            details: errMsg,
          },
        });
      }
    } finally {
      currentJobId = null;
    }
    return;
  }
});
