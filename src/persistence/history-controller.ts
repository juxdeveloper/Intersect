/**
 * Central History Controller for Intersect (Phase V10).
 *
 * Requirements:
 * - Coordinates IndexedDB store, active record tracking, and UI state notifications.
 * - Enforces atomic save-once per completed calculation submission.
 * - Updates committed appearance (curve color, direction) in place without mutating math or creation time.
 * - Prevents resurrection of deleted records.
 * - Protects against async races via epoch/sequence guards.
 * - Provides real empty, loading, degraded, and error states.
 */

import {
  CURRENT_PERSISTENCE_SCHEMA_VERSION,
  CURRENT_RECORD_PAYLOAD_VERSION,
  type SavedCalculationRecord,
  type HistoryListingSummary,
  type HistoryStoreStatus,
  type CalculationRequest,
  type CalculationResult,
  type TraversalDirection,
  type WorldBounds,
} from '../contracts';
import type { IHistoryStore, SaveResult, StorageNotice } from './types';
import { IndexedDBHistoryStore } from './indexeddb-store';
import { checkAndMigrateLegacyStorage } from './legacy-migration';

export function generateRecordId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `calc-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export class HistoryController {
  private store: IHistoryStore;
  private listeners: Set<() => void> = new Set();
  private _summaries: readonly HistoryListingSummary[] = [];
  private _activeRecordId: string | null = null;
  private _notice: StorageNotice | null = null;
  private _epoch: number = 0;
  private _isInitialized: boolean = false;

  constructor(customStore?: IHistoryStore) {
    this.store = customStore ?? new IndexedDBHistoryStore(() => {
      this.refreshSummaries().catch(() => {});
    });
  }

  get status(): HistoryStoreStatus {
    return this.store.status;
  }

  get summaries(): readonly HistoryListingSummary[] {
    return this._summaries;
  }

  get activeRecordId(): string | null {
    return this._activeRecordId;
  }

  get notice(): StorageNotice | null {
    return this._notice;
  }

  get isInitialized(): boolean {
    return this._isInitialized;
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    for (const listener of this.listeners) {
      try {
        listener();
      } catch {
        // Suppress listener error
      }
    }
  }

  async init(): Promise<void> {
    if (this._isInitialized) return;

    await this.store.init();

    // Check and import legacy items if any
    try {
      await checkAndMigrateLegacyStorage(this.store);
    } catch {
      // Legacy migration failure is non-fatal
    }

    if (this.store.status === 'degraded') {
      this._notice = {
        type: 'warning',
        message: 'Session-only history: browser IndexedDB is unavailable or restricted.',
      };
    } else if (this.store.status === 'blocked') {
      this._notice = {
        type: 'warning',
        message: 'History is temporarily blocked by another open tab upgrading the database.',
      };
    }

    await this.refreshSummaries();
    this._isInitialized = true;
    this.notify();
  }

  async refreshSummaries(): Promise<void> {
    const currentEpoch = ++this._epoch;
    const summaries = await this.store.getAllSummaries();

    // Only apply if this is the newest request (Section 6)
    if (currentEpoch === this._epoch) {
      this._summaries = summaries;
      this.notify();
    }
  }

  setActiveRecordId(id: string | null): void {
    if (this._activeRecordId !== id) {
      this._activeRecordId = id;
      this.notify();
    }
  }

  /**
   * Saves a newly established calculation outcome.
   * Captured from the immutable submitted snapshot.
   */
  async saveCalculation(params: {
    surfaceF: string;
    surfaceG: string;
    direction: TraversalDirection;
    curveColor: string;
    bounds: WorldBounds;
    result: CalculationResult;
    request: CalculationRequest;
    isExample?: boolean;
    title?: string;
  }): Promise<SaveResult> {
    // Only terminal meaningful outcomes get saved (Section 5)
    const status = params.result.status;
    if (
      status === 'invalid-input' ||
      status === 'cancelled' ||
      status === 'runtime-failure'
    ) {
      return { success: false, prunedCount: 0, error: 'Incomplete or cancelled calculation not saved.' };
    }

    const id = generateRecordId();
    const now = Date.now();

    const record: SavedCalculationRecord = {
      id,
      schemaVersion: CURRENT_PERSISTENCE_SCHEMA_VERSION,
      payloadVersion: CURRENT_RECORD_PAYLOAD_VERSION,
      createdAt: now,
      updatedAt: now,
      surfaceF: params.surfaceF,
      surfaceG: params.surfaceG,
      direction: params.direction,
      curveColor: params.curveColor,
      bounds: params.bounds,
      result: params.result,
      request: params.request,
      isExample: params.isExample,
      title: params.title,
      statusKind: status,
    };

    const res = await this.store.saveRecord(record);

    if (res.success) {
      this._activeRecordId = id;
      await this.refreshSummaries();
    } else if (res.error) {
      this._notice = {
        type: 'warning',
        message: res.error,
      };
      this.notify();
    }

    return res;
  }

  /**
   * Updates committed color or direction in place for the current calculation.
   */
  async updateAppearance(
    id: string,
    updates: { curveColor?: string; direction?: TraversalDirection },
  ): Promise<boolean> {
    const res = await this.store.updateAppearance(id, updates);
    if (res.success && res.found) {
      await this.refreshSummaries();
      return true;
    }
    return false;
  }

  /**
   * Retrieves a full calculation record for one-click restoration.
   */
  async getRecordForRestore(id: string): Promise<SavedCalculationRecord | null> {
    const record = await this.store.getRecord(id);
    if (record) {
      this._activeRecordId = id;
      this.notify();
    }
    return record;
  }

  /**
   * Deletes a single record by ID.
   */
  async deleteRecord(id: string): Promise<boolean> {
    const res = await this.store.deleteRecord(id);
    if (res.success) {
      if (this._activeRecordId === id) {
        this._activeRecordId = null;
      }
      await this.refreshSummaries();
      return true;
    }
    return false;
  }

  /**
   * Clears all history atomically.
   */
  async clearAllHistory(): Promise<boolean> {
    const res = await this.store.clearHistory();
    if (res.success) {
      this._activeRecordId = null;
      await this.refreshSummaries();
      return true;
    }
    return false;
  }

  clearNotice(): void {
    if (this._notice) {
      this._notice = null;
      this.notify();
    }
  }

  dispose(): void {
    this.listeners.clear();
    this.store.dispose();
  }
}
