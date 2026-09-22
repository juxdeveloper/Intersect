/**
 * React hook for Intersect history persistence (Phase V10).
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { HistoryController } from './history-controller';
import type {
  HistoryListingSummary,
  HistoryStoreStatus,
  SavedCalculationRecord,
  CalculationRequest,
  CalculationResult,
  TraversalDirection,
  WorldBounds,
} from '../contracts';
import type { SaveResult, StorageNotice } from './types';

// Module-level singleton controller so connections are shared across components
let globalHistoryController: HistoryController | null = null;

export function getGlobalHistoryController(): HistoryController {
  if (!globalHistoryController) {
    globalHistoryController = new HistoryController();
  }
  return globalHistoryController;
}

export interface UseHistoryReturn {
  status: HistoryStoreStatus;
  summaries: readonly HistoryListingSummary[];
  activeRecordId: string | null;
  notice: StorageNotice | null;
  isInitialized: boolean;
  saveCalculation: (params: {
    surfaceF: string;
    surfaceG: string;
    direction: TraversalDirection;
    curveColor: string;
    bounds: WorldBounds;
    result: CalculationResult;
    request: CalculationRequest;
    isExample?: boolean;
    title?: string;
  }) => Promise<SaveResult>;
  updateAppearance: (
    id: string,
    updates: { curveColor?: string; direction?: TraversalDirection },
  ) => Promise<boolean>;
  getRecordForRestore: (id: string) => Promise<SavedCalculationRecord | null>;
  deleteRecord: (id: string) => Promise<boolean>;
  clearAllHistory: () => Promise<boolean>;
  clearNotice: () => void;
  setActiveRecordId: (id: string | null) => void;
  refreshSummaries: () => Promise<void>;
}

export function useHistory(): UseHistoryReturn {
  const controller = getGlobalHistoryController();
  const [status, setStatus] = useState<HistoryStoreStatus>(controller.status);
  const [summaries, setSummaries] = useState<readonly HistoryListingSummary[]>(controller.summaries);
  const [activeRecordId, setActiveRecordIdState] = useState<string | null>(controller.activeRecordId);
  const [notice, setNotice] = useState<StorageNotice | null>(controller.notice);
  const [isInitialized, setIsInitialized] = useState<boolean>(controller.isInitialized);

  const isMountedRef = useRef<boolean>(true);

  useEffect(() => {
    isMountedRef.current = true;

    const unsubscribe = controller.subscribe(() => {
      if (isMountedRef.current) {
        setStatus(controller.status);
        setSummaries(controller.summaries);
        setActiveRecordIdState(controller.activeRecordId);
        setNotice(controller.notice);
        setIsInitialized(controller.isInitialized);
      }
    });

    if (!controller.isInitialized) {
      controller.init().catch(() => {});
    } else {
      // Sync state if already initialized
      setStatus(controller.status);
      setSummaries(controller.summaries);
      setActiveRecordIdState(controller.activeRecordId);
      setNotice(controller.notice);
      setIsInitialized(true);
    }

    return () => {
      isMountedRef.current = false;
      unsubscribe();
    };
  }, [controller]);

  const saveCalculation = useCallback(
    (params: {
      surfaceF: string;
      surfaceG: string;
      direction: TraversalDirection;
      curveColor: string;
      bounds: WorldBounds;
      result: CalculationResult;
      request: CalculationRequest;
      isExample?: boolean;
      title?: string;
    }) => controller.saveCalculation(params),
    [controller],
  );

  const updateAppearance = useCallback(
    (id: string, updates: { curveColor?: string; direction?: TraversalDirection }) =>
      controller.updateAppearance(id, updates),
    [controller],
  );

  const getRecordForRestore = useCallback(
    (id: string) => controller.getRecordForRestore(id),
    [controller],
  );

  const deleteRecord = useCallback(
    (id: string) => controller.deleteRecord(id),
    [controller],
  );

  const clearAllHistory = useCallback(
    () => controller.clearAllHistory(),
    [controller],
  );

  const clearNotice = useCallback(
    () => controller.clearNotice(),
    [controller],
  );

  const setActiveRecordId = useCallback(
    (id: string | null) => controller.setActiveRecordId(id),
    [controller],
  );

  const refreshSummaries = useCallback(
    () => controller.refreshSummaries(),
    [controller],
  );

  return {
    status,
    summaries,
    activeRecordId,
    notice,
    isInitialized,
    saveCalculation,
    updateAppearance,
    getRecordForRestore,
    deleteRecord,
    clearAllHistory,
    clearNotice,
    setActiveRecordId,
    refreshSummaries,
  };
}
