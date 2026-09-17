/**
 * React hook for consuming the dedicated SymPy Pyodide runtime controller.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  SymPyRuntimeController,
  type RuntimeStateSnapshot,
  type RuntimeLifecycleState,
  type RuntimeInfo,
} from './runtime-controller';
import type { SymPyConstructionPlan } from '../contracts/expressions';
import type { PreparedExpressionsSummary } from '../contracts/worker';
import type { CalculationRequest } from '../contracts/calculation';
import type { CalculationResult } from '../contracts/results';

// Module-level singleton controller so repeated component renders or StrictMode
// do not instantiate multiple Web Workers or reload Pyodide
let globalController: SymPyRuntimeController | null = null;

export function getGlobalRuntimeController(): SymPyRuntimeController {
  if (!globalController) {
    globalController = new SymPyRuntimeController();
  }
  return globalController;
}

export interface UseSymPyRuntimeResult {
  readonly state: RuntimeLifecycleState;
  readonly stage: string;
  readonly runtimeInfo: RuntimeInfo | null;
  readonly activeJobId: string | null;
  readonly error: string | null;
  readonly isBusy: boolean;
  readonly isInitializing: boolean;
  readonly isReady: boolean;
  readonly prepareExpressions: (plans: {
    readonly surfaceF: SymPyConstructionPlan;
    readonly surfaceG: SymPyConstructionPlan;
  }) => Promise<PreparedExpressionsSummary>;
  readonly calculateIntersection: (request: CalculationRequest) => Promise<CalculationResult>;
  readonly cancel: (reason?: string) => void;
  readonly retry: () => Promise<void>;
  readonly init: () => Promise<void>;
}

export function useSymPyRuntime(): UseSymPyRuntimeResult {
  const controllerRef = useRef<SymPyRuntimeController>(getGlobalRuntimeController());
  const [snapshot, setSnapshot] = useState<RuntimeStateSnapshot>(() =>
    controllerRef.current.getSnapshot(),
  );

  useEffect(() => {
    const unsubscribe = controllerRef.current.subscribe((nextSnapshot) => {
      setSnapshot(nextSnapshot);
    });
    return () => {
      unsubscribe();
    };
  }, []);

  const prepareExpressions = useCallback(
    async (plans: {
      readonly surfaceF: SymPyConstructionPlan;
      readonly surfaceG: SymPyConstructionPlan;
    }) => {
      return controllerRef.current.prepareExpressions(plans);
    },
    [],
  );

  const calculateIntersection = useCallback(
    async (request: CalculationRequest) => {
      return controllerRef.current.calculateIntersection(request);
    },
    [],
  );

  const cancel = useCallback((reason?: string) => {
    controllerRef.current.cancelActiveJob(reason);
  }, []);

  const retry = useCallback(async () => {
    return controllerRef.current.retry();
  }, []);

  const init = useCallback(async () => {
    return controllerRef.current.init();
  }, []);

  return {
    state: snapshot.state,
    stage: snapshot.stage,
    runtimeInfo: snapshot.runtimeInfo,
    activeJobId: snapshot.activeJobId,
    error: snapshot.error,
    isBusy: snapshot.state === 'busy',
    isInitializing: snapshot.state === 'initializing',
    isReady: snapshot.state === 'ready',
    prepareExpressions,
    calculateIntersection,
    cancel,
    retry,
    init,
  };
}
