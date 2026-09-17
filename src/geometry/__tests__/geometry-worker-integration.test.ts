import { describe, it, expect } from 'vitest';
import { GeometryController } from '../geometry-controller';
import { generateGeometry } from '../geometry-generator';
import type {
  GeometryRequest,
  GeometryResult,
  GeometryWorkerRequest,
  GeometryWorkerResponse,
} from '../../contracts/geometry';
import {
  createNumberNode,
  createSymbolNode,
  createOperatorNode,
} from '../../math/ast';
import {
  createFiniteEndpoint,
  createInterval,
} from '../../contracts/domain';
import type { ExactCurve } from '../../contracts/curve';

class MockGeometryWorker {
  public onmessage: ((event: MessageEvent<GeometryWorkerResponse>) => void) | null = null;
  public onerror: ((event: ErrorEvent) => void) | null = null;
  public postedMessages: GeometryWorkerRequest[] = [];
  public terminated = false;

  public postMessage(msg: GeometryWorkerRequest): void {
    this.postedMessages.push(msg);
  }

  public terminate(): void {
    this.terminated = true;
  }

  public simulateResponse(response: GeometryWorkerResponse): void {
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

describe('Intersect V6 Geometry Controller & Worker Integration Suite', () => {
  const cylinderResidual = createOperatorNode('Subtract', [
    createOperatorNode('Add', [
      createOperatorNode('Power', [createSymbolNode('x'), createNumberNode(2)]),
      createOperatorNode('Power', [createSymbolNode('y'), createNumberNode(2)]),
    ]),
    createNumberNode(4),
  ]);

  const planeResidual = createOperatorNode('Subtract', [
    createSymbolNode('z'),
    createOperatorNode('Add', [createSymbolNode('x'), createSymbolNode('y')]),
  ]);

  const referenceCurve: ExactCurve = {
    paramSymbol: 't',
    x: '2*cos(t)',
    y: '2*sin(t)',
    z: '2*cos(t) + 2*sin(t)',
    domain: {
      intervals: [
        createInterval(createFiniteEndpoint('0', 0), true, createFiniteEndpoint('2*pi', 2 * Math.PI), false),
      ],
    },
    direction: 'forward',
    traversal: {
      orientation: 'forward',
      parameterMapping: { type: 'identity', formula: 't = t', canonicalParam: 't', orientedParam: 't' },
      isClosed: true,
      isPeriodic: true,
      period: '2*pi',
      segmentCount: 1,
      disjointGapsPreserved: true,
    },
    verification: {
      status: 'verified',
      scope: 'Algebraically verified on t in [0, 2pi)',
      surfaceFIdentityHolds: true,
      surfaceGIdentityHolds: true,
      domainSingularitiesChecked: true,
      method: 'symbolic_identity',
      verifiedAt: 1700000000000,
    },
  };

  const sampleRequest: GeometryRequest = {
    jobId: 'job-101',
    calculationId: 'calc-1',
    workerGeneration: 1,
    surfaceF: {
      id: 'surface-f',
      label: 'Surface F',
      residual: cylinderResidual,
    },
    surfaceG: {
      id: 'surface-g',
      label: 'Surface G',
      residual: planeResidual,
    },
    curve: {
      paramSymbol: 't',
      xExpr: '2*cos(t)',
      yExpr: '2*sin(t)',
      zExpr: '2*cos(t) + 2*sin(t)',
      exactCurve: referenceCurve,
      traversal: referenceCurve.traversal!,
    },
    worldBounds: {
      x: { min: -1000, max: 1000 },
      y: { min: -1000, max: 1000 },
      z: { min: -1000, max: 1000 },
    },
    renderRegion: {
      x: { min: -50, max: 50 },
      y: { min: -50, max: 50 },
      z: { min: -50, max: 50 },
    },
    quality: 'default',
  };

  it('1. Generates complete typed geometry for Surface F, Surface G, and exact curve', async () => {
    const controller = new GeometryController({ enableInProcessFallback: true });
    const result = await controller.requestGeometry(sampleRequest);

    expect(result.jobId).toBe('job-101');
    expect(result.calculationId).toBe('calc-1');

    // Surface F (Cylinder)
    expect(result.surfaceF.status).toBe('success');
    expect(result.surfaceF.positions).toBeInstanceOf(Float32Array);
    expect(result.surfaceF.normals).toBeInstanceOf(Float32Array);
    expect(result.surfaceF.indices).toBeInstanceOf(Uint32Array);
    expect(result.surfaceF.vertexCount).toBeGreaterThan(100);
    expect(result.surfaceF.triangleCount).toBeGreaterThan(100);

    // Surface G (Plane)
    expect(result.surfaceG.status).toBe('success');
    expect(result.surfaceG.positions).toBeInstanceOf(Float32Array);
    expect(result.surfaceG.normals).toBeInstanceOf(Float32Array);
    expect(result.surfaceG.indices).toBeInstanceOf(Uint32Array);
    expect(result.surfaceG.vertexCount).toBeGreaterThan(50);
    expect(result.surfaceG.triangleCount).toBeGreaterThan(50);

    // Exact Curve
    expect(result.curve).not.toBeNull();
    expect(result.curve!.status).toBe('success');
    expect(result.curve!.positions).toBeInstanceOf(Float32Array);
    expect(result.curve!.tValues).toBeInstanceOf(Float64Array);
    expect(result.curve!.segmentBreaks).toBeInstanceOf(Uint32Array);
    expect(result.curve!.sampleCount).toBeGreaterThanOrEqual(30);
    expect(result.curve!.traversalOrientation).toBe('forward');

    // Performance measurements
    expect(result.totalDurationMs).toBeGreaterThanOrEqual(0);
    expect(result.budgetExhausted).toBe(false);

    controller.dispose();
  });

  it('2. Enforces single active computation policy and preemption in worker lifecycle', async () => {
    let mockWorkerInstance: MockGeometryWorker | null = null;
    const controller = new GeometryController({
      workerFactory: () => {
        mockWorkerInstance = new MockGeometryWorker();
        return mockWorkerInstance as unknown as Worker;
      },
    });

    const req1: GeometryRequest = { ...sampleRequest, jobId: 'job-p1' };
    const req2: GeometryRequest = { ...sampleRequest, jobId: 'job-p2' };

    // Launch job 1 (waiting for worker response)
    const promise1 = controller.requestGeometry(req1);
    expect(controller.getSnapshot().activeJobId).toBe('job-p1');

    // Launch job 2: supersedes job 1 immediately
    const promise2 = controller.requestGeometry(req2);
    expect(controller.getSnapshot().activeJobId).toBe('job-p2');

    // Job 1 rejects due to cancellation/preemption
    await expect(promise1).rejects.toThrow(/superseded|cancelled/i);

    // Simulate worker returning response for job 2
    const dummyResult: GeometryResult = {
      jobId: 'job-p2',
      calculationId: 'calc-1',
      workerGeneration: controller.getSnapshot().workerGeneration,
      renderRegion: req2.renderRegion,
      surfaceF: {
        status: 'success',
        positions: new Float32Array(0),
        normals: new Float32Array(0),
        indices: new Uint32Array(0),
        vertexCount: 0,
        triangleCount: 0,
        boundingBox: null,
        diagnostics: { evalCount: 0, cellsProcessed: 0, poleDiscardedCount: 0, durationMs: 5 },
      },
      surfaceG: {
        status: 'success',
        positions: new Float32Array(0),
        normals: new Float32Array(0),
        indices: new Uint32Array(0),
        vertexCount: 0,
        triangleCount: 0,
        boundingBox: null,
        diagnostics: { evalCount: 0, cellsProcessed: 0, poleDiscardedCount: 0, durationMs: 5 },
      },
      curve: null,
      totalDurationMs: 10,
      budgetExhausted: false,
      timestamp: Date.now(),
    };

    mockWorkerInstance!.simulateResponse({
      type: 'geometry-result',
      result: dummyResult,
    });

    const res2 = await promise2;
    expect(res2.jobId).toBe('job-p2');
    expect(controller.getSnapshot().state).toBe('ready');

    controller.dispose();
  });

  it('3. Manual cancellation immediately transitions state and rejects pending promise', async () => {
    let mockWorkerInstance: MockGeometryWorker | null = null;
    const controller = new GeometryController({
      workerFactory: () => {
        mockWorkerInstance = new MockGeometryWorker();
        return mockWorkerInstance as unknown as Worker;
      },
    });

    const req: GeometryRequest = { ...sampleRequest, jobId: 'job-c1' };
    const promise = controller.requestGeometry(req);

    controller.cancelCurrentJob('User cancelled test');

    await expect(promise).rejects.toThrow(/cancelled/i);
    expect(controller.getSnapshot().state).toBe('cancelled');

    controller.dispose();
  });

  it('4. Stale results with mismatched jobId or generation are discarded', async () => {
    let mockWorkerInstance: MockGeometryWorker | null = null;
    const controller = new GeometryController({
      workerFactory: () => {
        mockWorkerInstance = new MockGeometryWorker();
        return mockWorkerInstance as unknown as Worker;
      },
    });

    const req: GeometryRequest = { ...sampleRequest, jobId: 'job-fresh' };
    const promise = controller.requestGeometry(req);

    // Simulate stale response with obsolete jobId 'job-old'
    mockWorkerInstance!.simulateResponse({
      type: 'geometry-result',
      result: {
        jobId: 'job-old', // MISMATCH!
        calculationId: 'calc-1',
        workerGeneration: controller.getSnapshot().workerGeneration,
        renderRegion: req.renderRegion,
        surfaceF: {
          status: 'success',
          positions: new Float32Array(0),
          normals: new Float32Array(0),
          indices: new Uint32Array(0),
          vertexCount: 0,
          triangleCount: 0,
          boundingBox: null,
          diagnostics: { evalCount: 0, cellsProcessed: 0, poleDiscardedCount: 0, durationMs: 1 },
        },
        surfaceG: {
          status: 'success',
          positions: new Float32Array(0),
          normals: new Float32Array(0),
          indices: new Uint32Array(0),
          vertexCount: 0,
          triangleCount: 0,
          boundingBox: null,
          diagnostics: { evalCount: 0, cellsProcessed: 0, poleDiscardedCount: 0, durationMs: 1 },
        },
        curve: null,
        totalDurationMs: 2,
        budgetExhausted: false,
        timestamp: Date.now(),
      },
    });

    // Controller should still be waiting for 'job-fresh'
    expect(controller.getSnapshot().state).toBe('generating');
    expect(controller.getSnapshot().activeJobId).toBe('job-fresh');

    // Now send legitimate response
    mockWorkerInstance!.simulateResponse({
      type: 'geometry-result',
      result: {
        jobId: 'job-fresh',
        calculationId: 'calc-1',
        workerGeneration: controller.getSnapshot().workerGeneration,
        renderRegion: req.renderRegion,
        surfaceF: {
          status: 'success',
          positions: new Float32Array(0),
          normals: new Float32Array(0),
          indices: new Uint32Array(0),
          vertexCount: 0,
          triangleCount: 0,
          boundingBox: null,
          diagnostics: { evalCount: 0, cellsProcessed: 0, poleDiscardedCount: 0, durationMs: 1 },
        },
        surfaceG: {
          status: 'success',
          positions: new Float32Array(0),
          normals: new Float32Array(0),
          indices: new Uint32Array(0),
          vertexCount: 0,
          triangleCount: 0,
          boundingBox: null,
          diagnostics: { evalCount: 0, cellsProcessed: 0, poleDiscardedCount: 0, durationMs: 1 },
        },
        curve: null,
        totalDurationMs: 2,
        budgetExhausted: false,
        timestamp: Date.now(),
      },
    });

    const legitimateResult = await promise;
    expect(legitimateResult.jobId).toBe('job-fresh');
    expect(controller.getSnapshot().state).toBe('ready');

    controller.dispose();
  });

  it('5. Measurements: records representative memory buffer bytes and timing', () => {
    const result = generateGeometry(sampleRequest);

    const fBytes =
      result.surfaceF.positions.byteLength +
      result.surfaceF.normals.byteLength +
      result.surfaceF.indices.byteLength;
    const gBytes =
      result.surfaceG.positions.byteLength +
      result.surfaceG.normals.byteLength +
      result.surfaceG.indices.byteLength;
    const curveBytes = result.curve
      ? result.curve.positions.byteLength +
        result.curve.tValues.byteLength +
        result.curve.segmentBreaks.byteLength
      : 0;

    const totalBytes = fBytes + gBytes + curveBytes;

    expect(totalBytes).toBeGreaterThan(50_000); // at least 50 KB
    expect(totalBytes).toBeLessThan(10_000_000); // under 10 MB, well within browser budgets

    expect(result.surfaceF.diagnostics.durationMs).toBeDefined();
    expect(result.surfaceG.diagnostics.durationMs).toBeDefined();
    expect(result.curve?.diagnostics.durationMs).toBeDefined();
  });
});
