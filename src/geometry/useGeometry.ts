/**
 * React hook for consuming the geometry engine in UI components.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import type { GeometryRequest, GeometryResult } from '../contracts/geometry';
import {
  GeometryController,
  type GeometryControllerState,
  type GeometryStateSnapshot,
} from './geometry-controller';

export interface UseGeometryReturn {
  readonly state: GeometryControllerState;
  readonly isGenerating: boolean;
  readonly result: GeometryResult | null;
  readonly error: string | null;
  readonly requestGeometry: (request: GeometryRequest) => Promise<GeometryResult>;
  readonly cancel: (reason?: string) => void;
}

export function useGeometry(controller?: GeometryController): UseGeometryReturn {
  const controllerRef = useRef<GeometryController | null>(null);

  if (!controllerRef.current) {
    controllerRef.current = controller ?? new GeometryController();
  }

  const [snapshot, setSnapshot] = useState<GeometryStateSnapshot>(() =>
    controllerRef.current!.getSnapshot(),
  );

  useEffect(() => {
    const ctrl = controllerRef.current!;
    const unsubscribe = ctrl.subscribe((snap) => {
      setSnapshot(snap);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const requestGeometry = useCallback((request: GeometryRequest) => {
    return controllerRef.current!.requestGeometry(request);
  }, []);

  const cancel = useCallback((reason?: string) => {
    controllerRef.current!.cancelCurrentJob(reason);
  }, []);

  return {
    state: snapshot.state,
    isGenerating: snapshot.state === 'generating',
    result: snapshot.lastResult,
    error: snapshot.error,
    requestGeometry,
    cancel,
  };
}
