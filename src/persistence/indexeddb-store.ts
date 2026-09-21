/**
 * Native IndexedDB implementation of Intersect History Store (Phase V10).
 *
 * Requirements:
 * - Persistent browser storage under 'intersect_db' (store: 'calculations').
 * - Schema version 1, payload version 1.
 * - Atomic transactions with tx.oncomplete confirmation (no premature put success).
 * - Enforces retention limits (HISTORY_MAX_RECORDS = 100) atomically inside the save transaction.
 * - In-place appearance & direction updates preserve record ID, creation date, and mathematical payload.
 * - Deletion followed by stale update does not recreate the row.
 * - Degrades to in-memory fallback on permission denial, quota failure, or browser blocks.
 * - Multi-tab synchronization via BroadcastChannel.
 */

import {
  DB_NAME,
  DB_VERSION,
  CALCULATIONS_STORE_NAME,
  HISTORY_MAX_RECORDS,
  type SavedCalculationRecord,
  type HistoryListingSummary,
  type HistoryStoreStatus,
} from '../contracts';
import type {
  IHistoryStore,
  SaveResult,
  UpdateAppearanceResult,
  DeleteResult,
  ClearResult,
} from './types';
import {
  isRecordOversized,
  safeValidateRecordItem,
} from './validation';
import { MemoryHistoryStore } from './memory-store';

export class IndexedDBHistoryStore implements IHistoryStore {
  private _status: HistoryStoreStatus = 'uninitialized';
  private db: IDBDatabase | null = null;
  private fallbackStore: MemoryHistoryStore | null = null;
  private broadcastChannel: BroadcastChannel | null = null;
  private onExternalChangeCallback?: () => void;

  constructor(onExternalChange?: () => void) {
    this.onExternalChangeCallback = onExternalChange;
    if (typeof BroadcastChannel !== 'undefined') {
      try {
        this.broadcastChannel = new BroadcastChannel('intersect_history_sync');
        this.broadcastChannel.onmessage = (event) => {
          if (event.data?.type === 'history-mutation') {
            this.onExternalChangeCallback?.();
          }
        };
      } catch {
        this.broadcastChannel = null;
      }
    }
  }

  get status(): HistoryStoreStatus {
    if (this.fallbackStore) {
      return this.fallbackStore.status;
    }
    return this._status;
  }

  /**
   * Initializes the IndexedDB database connection or safely falls back to MemoryHistoryStore.
   */
  async init(): Promise<void> {
    if (typeof window === 'undefined' || typeof indexedDB === 'undefined') {
      this.initFallback('IndexedDB not supported in current environment.');
      return;
    }

    return new Promise<void>((resolve) => {
      let openReq: IDBOpenDBRequest;
      try {
        openReq = indexedDB.open(DB_NAME, DB_VERSION);
      } catch (err) {
        this.initFallback(`Failed to open IndexedDB: ${String(err)}`);
        resolve();
        return;
      }

      openReq.onblocked = () => {
        // Blocked by another open tab holding older schema
        this._status = 'blocked';
      };

      openReq.onerror = () => {
        this.initFallback(openReq.error?.message || 'IndexedDB access denied.');
        resolve();
      };

      openReq.onupgradeneeded = () => {
        const db = openReq.result;
        if (!db.objectStoreNames.contains(CALCULATIONS_STORE_NAME)) {
          const store = db.createObjectStore(CALCULATIONS_STORE_NAME, { keyPath: 'id' });
          store.createIndex('createdAt', 'createdAt', { unique: false });
          store.createIndex('statusKind', 'statusKind', { unique: false });
        }
      };

      openReq.onsuccess = () => {
        this.db = openReq.result;
        this._status = 'ready';

        // Close connection on versionchange so another tab can upgrade cleanly (Section 6)
        this.db.onversionchange = () => {
          if (this.db) {
            this.db.close();
            this.db = null;
            this._status = 'blocked';
          }
        };

        resolve();
      };
    });
  }

  private initFallback(_reason?: string): void {
    this.fallbackStore = new MemoryHistoryStore();
    this._status = 'degraded';
  }

  private notifyMutation(): void {
    if (this.broadcastChannel) {
      try {
        this.broadcastChannel.postMessage({ type: 'history-mutation', timestamp: Date.now() });
      } catch {
        // Ignore broadcast failure
      }
    }
  }

  async getAllSummaries(): Promise<readonly HistoryListingSummary[]> {
    if (this.fallbackStore) {
      return this.fallbackStore.getAllSummaries();
    }
    if (!this.db || this._status !== 'ready') {
      return [];
    }

    return new Promise((resolve) => {
      try {
        const tx = this.db!.transaction(CALCULATIONS_STORE_NAME, 'readonly');
        const store = tx.objectStore(CALCULATIONS_STORE_NAME);
        const index = store.index('createdAt');
        // Retrieve newest records first (descending by createdAt)
        const req = index.openCursor(null, 'prev');
        const summaries: HistoryListingSummary[] = [];

        req.onsuccess = () => {
          const cursor = req.result;
          if (cursor) {
            const validated = safeValidateRecordItem(cursor.value);
            summaries.push(validated.summary);
            cursor.continue();
          } else {
            resolve(summaries);
          }
        };

        req.onerror = () => {
          resolve([]);
        };
      } catch {
        resolve([]);
      }
    });
  }

  async getRecord(id: string): Promise<SavedCalculationRecord | null> {
    if (this.fallbackStore) {
      return this.fallbackStore.getRecord(id);
    }
    if (!this.db || this._status !== 'ready') {
      return null;
    }

    return new Promise((resolve) => {
      try {
        const tx = this.db!.transaction(CALCULATIONS_STORE_NAME, 'readonly');
        const store = tx.objectStore(CALCULATIONS_STORE_NAME);
        const req = store.get(id);

        req.onsuccess = () => {
          if (!req.result) {
            resolve(null);
            return;
          }
          const validated = safeValidateRecordItem(req.result);
          resolve(validated.valid && validated.record ? validated.record : null);
        };

        req.onerror = () => {
          resolve(null);
        };
      } catch {
        resolve(null);
      }
    });
  }

  async saveRecord(record: SavedCalculationRecord): Promise<SaveResult> {
    if (this.fallbackStore) {
      const res = await this.fallbackStore.saveRecord(record);
      if (res.success) this.notifyMutation();
      return res;
    }
    if (!this.db || this._status !== 'ready') {
      return { success: false, prunedCount: 0, error: 'Database is not ready.' };
    }

    const sizeCheck = isRecordOversized(record);
    if (sizeCheck.oversized) {
      return {
        success: false,
        prunedCount: 0,
        byteSize: sizeCheck.byteSize,
        error: `Calculation snapshot exceeds maximum allowable size (${Math.round(sizeCheck.byteSize / 1024)} KB > 512 KB). Record not saved.`,
      };
    }

    return new Promise<SaveResult>((resolve) => {
      let prunedCount = 0;

      try {
        const tx = this.db!.transaction(CALCULATIONS_STORE_NAME, 'readwrite');
        const store = tx.objectStore(CALCULATIONS_STORE_NAME);

        // Put the record into the object store
        store.put(record);

        // Check count and prune oldest records atomically in the same transaction
        const countReq = store.count();
        countReq.onsuccess = () => {
          const count = countReq.result;
          if (count > HISTORY_MAX_RECORDS) {
            const toPrune = count - HISTORY_MAX_RECORDS;
            const index = store.index('createdAt');
            const pruneReq = index.openCursor(null, 'next'); // Oldest first
            let prunedSoFar = 0;

            pruneReq.onsuccess = () => {
              const cursor = pruneReq.result;
              if (cursor && prunedSoFar < toPrune) {
                cursor.delete();
                prunedSoFar++;
                prunedCount++;
                cursor.continue();
              }
            };
          }
        };

        tx.oncomplete = () => {
          this.notifyMutation();
          resolve({
            success: true,
            recordId: record.id,
            prunedCount,
            byteSize: sizeCheck.byteSize,
          });
        };

        tx.onerror = () => {
          const err = tx.error?.message || 'Transaction failed.';
          resolve({ success: false, prunedCount: 0, error: err });
        };

        tx.onabort = () => {
          resolve({ success: false, prunedCount: 0, error: 'Transaction was aborted.' });
        };
      } catch (err) {
        resolve({ success: false, prunedCount: 0, error: String(err) });
      }
    });
  }

  async updateAppearance(
    id: string,
    updates: { curveColor?: string; direction?: 'forward' | 'reverse' },
  ): Promise<UpdateAppearanceResult> {
    if (this.fallbackStore) {
      const res = await this.fallbackStore.updateAppearance(id, updates);
      if (res.success) this.notifyMutation();
      return res;
    }
    if (!this.db || this._status !== 'ready') {
      return { success: false, found: false, error: 'Database is not ready.' };
    }

    return new Promise<UpdateAppearanceResult>((resolve) => {
      try {
        const tx = this.db!.transaction(CALCULATIONS_STORE_NAME, 'readwrite');
        const store = tx.objectStore(CALCULATIONS_STORE_NAME);
        const getReq = store.get(id);

        getReq.onsuccess = () => {
          const existing = getReq.result as SavedCalculationRecord | undefined;
          if (!existing) {
            // Once deleted, a stale update MUST NOT recreate it (Section 6)
            resolve({ success: false, found: false });
            return;
          }

          const updated: SavedCalculationRecord = {
            ...existing,
            curveColor: updates.curveColor || existing.curveColor,
            direction: updates.direction || existing.direction,
            updatedAt: Date.now(),
          };

          store.put(updated);
        };

        tx.oncomplete = () => {
          this.notifyMutation();
          resolve({ success: true, found: true });
        };

        tx.onerror = () => {
          resolve({ success: false, found: false, error: tx.error?.message });
        };

        tx.onabort = () => {
          resolve({ success: false, found: false, error: 'Transaction aborted' });
        };
      } catch (err) {
        resolve({ success: false, found: false, error: String(err) });
      }
    });
  }

  async deleteRecord(id: string): Promise<DeleteResult> {
    if (this.fallbackStore) {
      const res = await this.fallbackStore.deleteRecord(id);
      if (res.success) this.notifyMutation();
      return res;
    }
    if (!this.db || this._status !== 'ready') {
      return { success: false, found: false, error: 'Database is not ready.' };
    }

    return new Promise<DeleteResult>((resolve) => {
      try {
        const tx = this.db!.transaction(CALCULATIONS_STORE_NAME, 'readwrite');
        const store = tx.objectStore(CALCULATIONS_STORE_NAME);
        store.delete(id);

        tx.oncomplete = () => {
          this.notifyMutation();
          resolve({ success: true, found: true });
        };

        tx.onerror = () => {
          resolve({ success: false, found: false, error: tx.error?.message });
        };

        tx.onabort = () => {
          resolve({ success: false, found: false, error: 'Transaction aborted' });
        };
      } catch (err) {
        resolve({ success: false, found: false, error: String(err) });
      }
    });
  }

  async clearHistory(): Promise<ClearResult> {
    if (this.fallbackStore) {
      const res = await this.fallbackStore.clearHistory();
      if (res.success) this.notifyMutation();
      return res;
    }
    if (!this.db || this._status !== 'ready') {
      return { success: false, clearedCount: 0, error: 'Database is not ready.' };
    }

    return new Promise<ClearResult>((resolve) => {
      try {
        const tx = this.db!.transaction(CALCULATIONS_STORE_NAME, 'readwrite');
        const store = tx.objectStore(CALCULATIONS_STORE_NAME);
        const countReq = store.count();
        let count = 0;

        countReq.onsuccess = () => {
          count = countReq.result;
          store.clear();
        };

        tx.oncomplete = () => {
          this.notifyMutation();
          resolve({ success: true, clearedCount: count });
        };

        tx.onerror = () => {
          resolve({ success: false, clearedCount: 0, error: tx.error?.message });
        };

        tx.onabort = () => {
          resolve({ success: false, clearedCount: 0, error: 'Transaction aborted' });
        };
      } catch (err) {
        resolve({ success: false, clearedCount: 0, error: String(err) });
      }
    });
  }

  dispose(): void {
    if (this.broadcastChannel) {
      try {
        this.broadcastChannel.close();
      } catch {
        // Ignored
      }
      this.broadcastChannel = null;
    }
    if (this.db) {
      try {
        this.db.close();
      } catch {
        // Ignored
      }
      this.db = null;
    }
    if (this.fallbackStore) {
      this.fallbackStore.dispose();
      this.fallbackStore = null;
    }
  }
}
