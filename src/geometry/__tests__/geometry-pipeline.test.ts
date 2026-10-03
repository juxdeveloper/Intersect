import { describe, expect, it } from 'vitest';
import { GeometryCache } from '../geometry-cache';
import { runGeometryJob } from '../geometry-pipeline';
import { generateGeometry } from '../geometry-generator';
import { GeometryController } from '../geometry-controller';
import { createNumberNode as n, createSymbolNode as s, createOperatorNode as op } from '../../math/ast';
import type { GeometryRequest, GeometryResult, GeometryWorkerRequest, GeometryWorkerResponse } from '../../contracts/geometry';

const region = { x: { min: -4, max: 4 }, y: { min: -4, max: 4 }, z: { min: -4, max: 4 } };
const request: GeometryRequest = { jobId: 'live', calculationId: 1, workerGeneration: 2, quality: 'auto',
  customBudget: { gridResolution: 80 }, renderRegion: region, worldBounds: region,
  surfaceF: { id: 'f', label: 'f', residual: op('Subtract', [op('Add', [op('Power', [s('x'), n(2)]), op('Power', [s('y'), n(2)])]), n(4)]) },
  surfaceG: { id: 'g', label: 'g', residual: s('z') } };

describe('Live Auto refinement and bounded reuse', () => {
  it('publishes an intermediate mesh, then the unchanged final resolution and values', () => {
    const results: { type: string; result: GeometryResult }[] = [];
    runGeometryJob(request, new GeometryCache(), (type, result) => results.push({ type, result }));
    expect(results.map(({ type }) => type)).toEqual(['geometry-preview', 'geometry-result']);
    expect(results[0]!.result.surfaceF.diagnostics.cellsProcessed).toBe(64 ** 3);
    expect(results[1]!.result.surfaceF.diagnostics.cellsProcessed).toBe(80 ** 3);
    expect(results[1]!.result.surfaceF.positions).toEqual(generateGeometry(request).surfaceF.positions);
  });

  it('reuses unaffected surfaces and invalidates changed input, domain, and region', () => {
    const cache = new GeometryCache();
    const first = generateGeometry(request, undefined, cache);
    const next = generateGeometry({ ...request, jobId: 'curve-only', calculationId: 2 }, undefined, cache);
    expect(next.surfaceF).toBe(first.surfaceF);
    expect(next.surfaceG).toBe(first.surfaceG);
    const changed = generateGeometry({ ...request, surfaceG: { ...request.surfaceG, residual: s('x') } }, undefined, cache);
    expect(changed.surfaceF).toBe(first.surfaceF);
    expect(changed.surfaceG).not.toBe(first.surfaceG);
    const excluded = generateGeometry({ ...request, surfaceF: { ...request.surfaceF, domainObligations: [
      { id: 'pole', kind: 'nonzero-denominator', target: s('z'), description: 'Source exclusion.' },
    ] } }, undefined, cache);
    expect(excluded.surfaceF).not.toBe(first.surfaceF);
    const moved = generateGeometry({ ...request, renderRegion: { ...region, x: { min: -5, max: 5 } } }, undefined, cache);
    expect(moved.surfaceF).not.toBe(first.surfaceF);
    expect(moved.surfaceG).not.toBe(first.surfaceG);
  });

  it('evicts old buffers within memory/count limits and never caches incomplete results', () => {
    const buffer = generateGeometry({ ...request, customBudget: { gridResolution: 16 } }).surfaceF;
    const cache = new GeometryCache(10_000_000, 2);
    cache.set('first', buffer); cache.set('second', buffer);
    cache.get('first'); cache.set('third', buffer);
    expect(cache.get('second')).toBeUndefined();
    expect(cache.get('first')).toBe(buffer);
    cache.set('partial', { ...buffer, status: 'partial-budget-limited' });
    expect(cache.get('partial')).toBeUndefined();
    const tiny = new GeometryCache(1);
    tiny.set('large', buffer);
    expect(tiny.get('large')).toBeUndefined();
    // Worker transfers a clone: the cached buffers remain attached.
    const outgoing = structuredClone(buffer);
    structuredClone(outgoing, { transfer: [outgoing.positions.buffer] });
    expect(outgoing.positions.byteLength).toBe(0);
    expect(buffer.positions.byteLength).toBeGreaterThan(0);
  });

  it('publishes no final response after cancellation and keeps Low single-pass', () => {
    let cancelled = false;
    const types: string[] = [];
    runGeometryJob(request, new GeometryCache(), (type) => { types.push(type); cancelled = true; }, () => cancelled);
    expect(types).toEqual(['geometry-preview']);
    types.length = 0;
    runGeometryJob({ ...request, quality: 'high', customBudget: { gridResolution: 16 } }, new GeometryCache(), (type) => types.push(type));
    expect(types).toEqual(['geometry-result']);
  });

  it('skips a redundant preview when both final meshes are cached', () => {
    const cache = new GeometryCache();
    generateGeometry(request, undefined, cache);
    const types: string[] = [];
    runGeometryJob(request, cache, (type) => types.push(type));
    expect(types).toEqual(['geometry-result']);
  });

  it('supports identical surfaces sharing cached buffers with unique transfer ownership', () => {
    const result = generateGeometry({ ...request, surfaceG: request.surfaceF, customBudget: { gridResolution: 16 } }, undefined, new GeometryCache());
    expect(result.surfaceF).toBe(result.surfaceG);
    const copy = structuredClone(result);
    const buffers = [copy.surfaceF.positions.buffer, copy.surfaceF.normals.buffer, copy.surfaceF.indices.buffer,
      copy.surfaceG.positions.buffer, copy.surfaceG.normals.buffer, copy.surfaceG.indices.buffer];
    expect(() => structuredClone(copy, { transfer: [...new Set(buffers)] })).not.toThrow();
    expect(result.surfaceF.positions.byteLength).toBeGreaterThan(0);
  });

  it('accepts only current previews, keeps the promise pending, and completes on final result', async () => {
    let listener: ((event: MessageEvent<GeometryWorkerResponse>) => void) | null = null;
    let dispatched: GeometryRequest = request;
    const worker = { set onmessage(value: typeof listener) { listener = value; }, onerror: null,
      postMessage: (msg: GeometryWorkerRequest) => { if (msg.type === 'generate-geometry') dispatched = msg.request; }, terminate() {} };
    const controller = new GeometryController({ workerFactory: () => worker as unknown as Worker });
    const pending = controller.requestGeometry(request);
    let settled = false;
    void pending.then(() => { settled = true; });
    const result = generateGeometry({ ...dispatched, customBudget: { gridResolution: 16 } });
    const send = (message: GeometryWorkerResponse) => listener!(new MessageEvent('message', { data: message }));
    send({ type: 'geometry-preview', result: { ...result, workerGeneration: result.workerGeneration - 1 } });
    send({ type: 'geometry-preview', result: { ...result, jobId: 'old' } });
    expect(controller.getSnapshot().state).toBe('generating');
    send({ type: 'geometry-preview', result });
    expect(controller.getSnapshot().state).toBe('refining');
    expect(controller.getSnapshot().lastResult).toBe(result);
    await Promise.resolve();
    expect(settled).toBe(false);
    send({ type: 'geometry-result', result });
    expect(await pending).toBe(result);
    expect(controller.getSnapshot().state).toBe('ready');
    controller.dispose();
  });
});
