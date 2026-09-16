import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  SymPyRuntimeController,
} from '../runtime-controller';
import {
  WORKER_PROTOCOL_VERSION,
  type WorkerRequest,
  type WorkerResponse,
  type PreparedExpressionsSummary,
} from '../../contracts/worker';
import type { SymPyConstructionPlan } from '../../contracts/expressions';
import { createCalculationRequest, prepareCalculationRequest } from '../../contracts/calculation';

class MockWorker {
  public onmessage: ((event: MessageEvent<WorkerResponse>) => void) | null = null;
  public onerror: ((event: ErrorEvent) => void) | null = null;
  public postedMessages: WorkerRequest[] = [];
  public terminated = false;

  public postMessage(msg: WorkerRequest): void {
    this.postedMessages.push(msg);
  }

  public terminate(): void {
    this.terminated = true;
  }

  public simulateWorkerResponse(response: WorkerResponse): void {
    if (this.onmessage && !this.terminated) {
      this.onmessage(new MessageEvent('message', { data: response }));
    }
  }

  public simulateError(errorMsg: string): void {
    if (this.onerror && !this.terminated) {
      this.onerror(new ErrorEvent('error', { message: errorMsg }));
    }
  }
}

const DUMMY_PLAN: SymPyConstructionPlan = {
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
};

const DUMMY_SUMMARY: PreparedExpressionsSummary = {
  surfaceF: {
    equationStr: 'Eq(z, 0)',
    lhsStr: 'z',
    rhsStr: '0',
    residualStr: 'z',
    simplifiedResidualStr: 'z',
    variables: ['z'],
    domainConditions: [],
    isPolynomial: true,
    degree: 1,
    isConstantIdentity: false,
    isConstantContradiction: false,
  },
  surfaceG: {
    equationStr: 'Eq(z, 0)',
    lhsStr: 'z',
    rhsStr: '0',
    residualStr: 'z',
    simplifiedResidualStr: 'z',
    variables: ['z'],
    domainConditions: [],
    isPolynomial: true,
    degree: 1,
    isConstantIdentity: false,
    isConstantContradiction: false,
  },
  systemVariables: ['z'],
  totalDomainObligations: 0,
  hasIdentity: false,
  hasContradiction: false,
};

async function initMockController(ctrl: SymPyRuntimeController, getWorker: () => MockWorker): Promise<void> {
  const p = ctrl.init();
  const w = getWorker();
  w.simulateWorkerResponse({
    type: 'worker-ready',
    requestId: 'ready-1',
    protocolVersion: WORKER_PROTOCOL_VERSION,
    workerGeneration: 1,
    runtimeInfo: {
      pyodideVersion: '0.27.8',
      pythonVersion: '3.12.7',
      sympyVersion: '1.13.3',
      mpmathVersion: '1.3.0',
    },
  });
  await p;
}

describe('SymPyRuntimeController Lifecycle & Concurrency', () => {
  let activeMockWorker: MockWorker | null = null;
  let controller: SymPyRuntimeController;

  beforeEach(() => {
    activeMockWorker = null;
    controller = new SymPyRuntimeController({
      initTimeoutMs: 200,
      execTimeoutMs: 150,
      cancellationGraceMs: 40,
      workerFactory: () => {
        const w = new MockWorker();
        activeMockWorker = w;
        return w as unknown as Worker;
      },
    });
  });

  afterEach(() => {
    controller.dispose();
  });

  it('starts in idle state and does not create worker before need', () => {
    const snapshot = controller.getSnapshot();
    expect(snapshot.state).toBe('idle');
    expect(snapshot.workerGeneration).toBe(0);
    expect(activeMockWorker).toBeNull();
  });

  it('initializes worker and transitions idle -> initializing -> ready', async () => {
    const states: string[] = [];
    controller.subscribe((s) => states.push(s.state));

    const initPromise = controller.init();
    expect(controller.getSnapshot().state).toBe('initializing');
    expect(activeMockWorker).not.toBeNull();
    expect(activeMockWorker!.postedMessages).toHaveLength(1);
    expect(activeMockWorker!.postedMessages[0]?.type).toBe('init');

    activeMockWorker!.simulateWorkerResponse({
      type: 'worker-ready',
      requestId: 'ready-1',
      protocolVersion: WORKER_PROTOCOL_VERSION,
      workerGeneration: 1,
      runtimeInfo: {
        pyodideVersion: '0.27.8',
        pythonVersion: '3.12.7',
        sympyVersion: '1.13.3',
        mpmathVersion: '1.3.0',
      },
    });

    await initPromise;
    expect(controller.getSnapshot().state).toBe('ready');
    expect(controller.getSnapshot().runtimeInfo?.sympyVersion).toBe('1.13.3');
    expect(states).toContain('idle');
    expect(states).toContain('initializing');
    expect(states).toContain('ready');
  });

  it('coalesces concurrent init calls into one initialization operation', async () => {
    const p1 = controller.init();
    const p2 = controller.init();

    expect(activeMockWorker!.postedMessages.filter((m) => m.type === 'init')).toHaveLength(1);

    activeMockWorker!.simulateWorkerResponse({
      type: 'worker-ready',
      requestId: 'ready-1',
      protocolVersion: WORKER_PROTOCOL_VERSION,
      workerGeneration: 1,
      runtimeInfo: {
        pyodideVersion: '0.27.8',
        pythonVersion: '3.12.7',
        sympyVersion: '1.13.3',
        mpmathVersion: '1.3.0',
      },
    });

    await Promise.all([p1, p2]);
    expect(controller.getSnapshot().state).toBe('ready');
  });

  it('enforces single active computation policy: cancels prior job when new one is submitted', async () => {
    await initMockController(controller, () => activeMockWorker!);

    let job1Rejected = false;
    let job1Error = '';
    const job1Promise = controller
      .prepareExpressions(
        { surfaceF: DUMMY_PLAN, surfaceG: DUMMY_PLAN },
        { jobId: 'job-1' },
      )
      .catch((err) => {
        job1Rejected = true;
        job1Error = err.message;
      });

    expect(controller.getSnapshot().state).toBe('busy');
    expect(controller.getSnapshot().activeJobId).toBe('job-1');

    // Submit job 2 while job 1 is running
    const job2Promise = controller.prepareExpressions(
      { surfaceF: DUMMY_PLAN, surfaceG: DUMMY_PLAN },
      { jobId: 'job-2' },
    );

    // Job 1 is cancelled
    await job1Promise;
    expect(job1Rejected).toBe(true);
    expect(job1Error).toContain('Superseded');

    expect(controller.getSnapshot().state).toBe('busy');
    expect(controller.getSnapshot().activeJobId).toBe('job-2');

    // Complete job 2
    activeMockWorker!.simulateWorkerResponse({
      type: 'prepared-expressions',
      requestId: 'resp-2',
      protocolVersion: WORKER_PROTOCOL_VERSION,
      workerGeneration: 1,
      jobId: 'job-2',
      summary: DUMMY_SUMMARY,
    });

    const res2 = await job2Promise;
    expect(res2.systemVariables).toEqual(['z']);
    expect(controller.getSnapshot().state).toBe('ready');
  });

  it('rejects stale responses from outdated worker generations', async () => {
    await initMockController(controller, () => activeMockWorker!);

    const jobPromise = controller.prepareExpressions(
      { surfaceF: DUMMY_PLAN, surfaceG: DUMMY_PLAN },
      { jobId: 'job-gen1' },
    );

    // Simulate stale response with older generation 0
    activeMockWorker!.simulateWorkerResponse({
      type: 'prepared-expressions',
      requestId: 'resp-stale',
      protocolVersion: WORKER_PROTOCOL_VERSION,
      workerGeneration: 0,
      jobId: 'job-gen1',
      summary: DUMMY_SUMMARY,
    });

    // State remains busy
    expect(controller.getSnapshot().state).toBe('busy');

    // Valid response with matching generation
    activeMockWorker!.simulateWorkerResponse({
      type: 'prepared-expressions',
      requestId: 'resp-valid',
      protocolVersion: WORKER_PROTOCOL_VERSION,
      workerGeneration: 1,
      jobId: 'job-gen1',
      summary: DUMMY_SUMMARY,
    });

    const result = await jobPromise;
    expect(result.systemVariables).toEqual(['z']);
  });

  it('rejects responses with mismatched jobId', async () => {
    await initMockController(controller, () => activeMockWorker!);

    const jobPromise = controller.prepareExpressions(
      { surfaceF: DUMMY_PLAN, surfaceG: DUMMY_PLAN },
      { jobId: 'job-expected' },
    );

    // Mismatched jobId
    activeMockWorker!.simulateWorkerResponse({
      type: 'prepared-expressions',
      requestId: 'resp-wrong',
      protocolVersion: WORKER_PROTOCOL_VERSION,
      workerGeneration: 1,
      jobId: 'job-unrelated',
      summary: DUMMY_SUMMARY,
    });

    expect(controller.getSnapshot().state).toBe('busy');

    // Matching jobId
    activeMockWorker!.simulateWorkerResponse({
      type: 'prepared-expressions',
      requestId: 'resp-match',
      protocolVersion: WORKER_PROTOCOL_VERSION,
      workerGeneration: 1,
      jobId: 'job-expected',
      summary: DUMMY_SUMMARY,
    });

    const res = await jobPromise;
    expect(res.systemVariables).toEqual(['z']);
  });

  it('forcibly terminates worker upon execution deadline timeout and resets', async () => {
    await initMockController(controller, () => activeMockWorker!);

    const initialWorker = activeMockWorker!;

    let jobError: Error | null = null;
    const jobPromise = controller
      .prepareExpressions(
        { surfaceF: DUMMY_PLAN, surfaceG: DUMMY_PLAN },
        { jobId: 'job-timeout', timeoutMs: 100 },
      )
      .catch((err) => {
        jobError = err;
      });

    // Wait for timeout to fire (100ms)
    await new Promise((r) => setTimeout(r, 130));

    await jobPromise;
    expect(jobError).not.toBeNull();
    expect(jobError!.message).toContain('timed out after 100ms');
    expect(initialWorker.terminated).toBe(true);

    // State reset to ready
    expect(controller.getSnapshot().state).toBe('ready');
  });

  it('cancels active job, sends cancellation to worker, and terminates if non-yielding', async () => {
    await initMockController(controller, () => activeMockWorker!);

    const busyWorker = activeMockWorker!;
    let jobRejected = false;
    const jobPromise = controller
      .prepareExpressions(
        { surfaceF: DUMMY_PLAN, surfaceG: DUMMY_PLAN },
        { jobId: 'job-to-cancel' },
      )
      .catch(() => {
        jobRejected = true;
      });

    // Cancel job
    controller.cancelActiveJob('User stopped computation');
    await jobPromise;
    expect(jobRejected).toBe(true);

    const cancelMsg = busyWorker.postedMessages.find((m) => m.type === 'cancel');
    expect(cancelMsg).toBeDefined();

    // Wait for cancellation grace period to trigger termination (40ms)
    await new Promise((r) => setTimeout(r, 60));
    expect(busyWorker.terminated).toBe(true);
  });

  it('handles worker fatal crash and recovers via retry()', async () => {
    const initP = controller.init();
    expect(controller.getSnapshot().state).toBe('initializing');

    activeMockWorker!.simulateError('Worker out of memory');

    await expect(initP).rejects.toThrow('Worker fatal error');
    expect(controller.getSnapshot().state).toBe('failed');

    const retryP = controller.retry();
    expect(controller.getSnapshot().state).toBe('initializing');
    expect(controller.getSnapshot().workerGeneration).toBe(2);

    activeMockWorker!.simulateWorkerResponse({
      type: 'worker-ready',
      requestId: 'ready-2',
      protocolVersion: WORKER_PROTOCOL_VERSION,
      workerGeneration: 2,
      runtimeInfo: {
        pyodideVersion: '0.27.8',
        pythonVersion: '3.12.7',
        sympyVersion: '1.13.3',
        mpmathVersion: '1.3.0',
      },
    });

    await retryP;
    expect(controller.getSnapshot().state).toBe('ready');
  });

  it('disposes cleanly, terminates worker, and rejects pending work', async () => {
    await initMockController(controller, () => activeMockWorker!);

    const w = activeMockWorker!;
    let pendingErr = '';
    const jobP = controller
      .prepareExpressions(
        { surfaceF: DUMMY_PLAN, surfaceG: DUMMY_PLAN },
        { jobId: 'job-pending' },
      )
      .catch((err) => {
        pendingErr = err.message;
      });

    controller.dispose();
    await jobP;

    expect(w.terminated).toBe(true);
    expect(pendingErr).toContain('disposed');
    expect(controller.getSnapshot().state).toBe('disposed');

    await expect(controller.init()).rejects.toThrow('disposed');
  });

  it('calculates intersection successfully and enforces single active computation policy', async () => {
    await initMockController(controller, () => activeMockWorker!);

    const rawReq = createCalculationRequest('x = 0', 'y = 0', 'forward');
    const prep = prepareCalculationRequest(rawReq);
    expect(prep.valid).toBe(true);
    if (!prep.valid) return;

    const calcPromise = controller.calculateIntersection(prep.request, { jobId: 'calc-job-1' });

    expect(controller.getSnapshot().state).toBe('busy');
    expect(controller.getSnapshot().activeJobId).toBe('calc-job-1');

    activeMockWorker!.simulateWorkerResponse({
      type: 'result',
      requestId: 'res-calc-1',
      protocolVersion: WORKER_PROTOCOL_VERSION,
      workerGeneration: 1,
      jobId: 'calc-job-1',
      result: {
        status: 'verified-curve',
        curve: {
          paramSymbol: 't',
          x: '0',
          y: '0',
          z: 't',
          domain: {
            intervals: [
              {
                min: { kind: 'finite', exact: '-1000', numericApprox: -1000 },
                minInclusive: true,
                max: { kind: 'finite', exact: '1000', numericApprox: 1000 },
                maxInclusive: true,
              },
            ],
          },
          direction: 'forward',
          verification: {
            status: 'verified',
            scope: 'Verified',
            surfaceFIdentityHolds: true,
            surfaceGIdentityHolds: true,
            domainSingularitiesChecked: true,
            method: 'symbolic_identity',
            verifiedAt: Date.now(),
          },
        },
        derivation: {
          strategyName: 'Affine Plane-Plane Cross Product',
          steps: [],
        },
        componentScope: 'Single continuous infinite line component',
      },
    });

    const result = await calcPromise;
    expect(result.status).toBe('verified-curve');
    expect(controller.getSnapshot().state).toBe('ready');
  });
});
