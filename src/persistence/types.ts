/**
 * Types and interfaces for Intersect persistence layer (Phase V10).
 */

import type {
  SavedCalculationRecord,
  HistoryListingSummary,
  HistoryStoreStatus,
  TraversalDirection,
} from '../contracts';

export type {
  SavedCalculationRecord,
  HistoryListingSummary,
  HistoryStoreStatus,
};

export interface SaveResult {
  readonly success: boolean;
  readonly recordId?: string;
  readonly prunedCount: number;
  readonly error?: string;
  readonly byteSize?: number;
}

export interface UpdateAppearanceResult {
  readonly success: boolean;
  readonly found: boolean;
  readonly error?: string;
}

export interface DeleteResult {
  readonly success: boolean;
  readonly found: boolean;
  readonly error?: string;
}

export interface ClearResult {
  readonly success: boolean;
  readonly clearedCount: number;
  readonly error?: string;
}

export interface StorageNotice {
  readonly type: 'info' | 'warning' | 'error';
  readonly message: string;
}

/**
 * Underlying storage engine interface.
 */
export interface IHistoryStore {
  readonly status: HistoryStoreStatus;
  init(): Promise<void>;
  getAllSummaries(): Promise<readonly HistoryListingSummary[]>;
  getRecord(id: string): Promise<SavedCalculationRecord | null>;
  saveRecord(record: SavedCalculationRecord): Promise<SaveResult>;
  updateAppearance(
    id: string,
    updates: { curveColor?: string; direction?: TraversalDirection },
  ): Promise<UpdateAppearanceResult>;
  deleteRecord(id: string): Promise<DeleteResult>;
  clearHistory(): Promise<ClearResult>;
  dispose(): void;
}
