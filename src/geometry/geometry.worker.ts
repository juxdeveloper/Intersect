/**
 * Dedicated Geometry Web Worker for Intersect Phase V6.
 *
 * Runs implicit surface extraction and curve sampling off the main UI thread.
 * Utilizes ArrayBuffer transfers (postMessage with Transferables) for zero-copy
 * memory transfer of Float32Array, Uint32Array, and Float64Array buffers.
 */

import type {
  GeometryWorkerRequest,
  GeometryWorkerResponse,
} from '../contracts/geometry';
import { runGeometryJob } from './geometry-pipeline';
import { GeometryCache } from './geometry-cache';

const cache = new GeometryCache();

let currentJobId: string | null = null;
let currentCancelled = false;

self.onmessage = (event: MessageEvent<GeometryWorkerRequest>) => {
  const msg = event.data;
  if (!msg || !msg.type) return;

  switch (msg.type) {
    case 'generate-geometry': {
      const { request } = msg;
      currentJobId = request.jobId;
      currentCancelled = false;

      const isCancelled = () => currentCancelled || currentJobId !== request.jobId;

      try {
        runGeometryJob(request, cache, (type, cachedResult) => {
          // The cache owns original arrays. Transfer a fresh copy so cached entries
          // remain attached and can serve subsequent curve/input-only updates.
          const result = structuredClone(cachedResult);
          // Collect ArrayBuffers for zero-copy transfer
          const transferables: Transferable[] = [];

          if (result.surfaceF.positions.buffer) {
            transferables.push(
              result.surfaceF.positions.buffer,
              result.surfaceF.normals.buffer,
              result.surfaceF.indices.buffer,
            );
            if (result.surfaceF.guideCurvesPositions?.buffer) {
              transferables.push(result.surfaceF.guideCurvesPositions.buffer);
            }
          }
          if (result.surfaceG.positions.buffer) {
            transferables.push(
              result.surfaceG.positions.buffer,
              result.surfaceG.normals.buffer,
              result.surfaceG.indices.buffer,
            );
            if (result.surfaceG.guideCurvesPositions?.buffer) {
              transferables.push(result.surfaceG.guideCurvesPositions.buffer);
            }
          }
          if (result.curve) {
            transferables.push(
              result.curve.positions.buffer,
              result.curve.tValues.buffer,
              result.curve.segmentBreaks.buffer,
            );
          }

          const successResp: GeometryWorkerResponse = {
            type,
            result,
          };

          // Transfer buffers (worker side is detached after this call)
          (self as unknown as { postMessage: (msg: unknown, transfer?: Transferable[]) => void }).postMessage(
            successResp,
            [...new Set(transferables)],
          );
        }, isCancelled);
      } catch (err: unknown) {
        const errorResp: GeometryWorkerResponse = {
          type: 'geometry-error',
          jobId: request.jobId,
          message: err instanceof Error ? err.message : String(err),
          details: err instanceof Error ? err.stack : undefined,
        };
        self.postMessage(errorResp);
      } finally {
        if (currentJobId === request.jobId) {
          currentJobId = null;
        }
      }
      break;
    }

    case 'cancel-geometry': {
      if (currentJobId === msg.jobId) {
        currentCancelled = true;
      }
      const cancelResp: GeometryWorkerResponse = {
        type: 'geometry-cancelled',
        jobId: msg.jobId,
        reason: msg.reason ?? 'Client requested cancellation',
      };
      self.postMessage(cancelResp);
      break;
    }

    case 'ping': {
      const pongResp: GeometryWorkerResponse = { type: 'pong' };
      self.postMessage(pongResp);
      break;
    }

    default:
      break;
  }
};
