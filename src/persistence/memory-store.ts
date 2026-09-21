/**
 * In-memory fallback history store for Intersect (Phase V10).
 *
 * Requirements (Section 7):
 * - Used when IndexedDB is denied (e.g. private browsing storage access denied),
 *   unavailable, corrupt, or temporarily blocked.
 * - Does not disguise memory storage as durable saving; clearly marks status as 'degraded' (session-only).
 * - Enforces identical retention policy (HISTORY_MAX_RECORDS, FIFO eviction of oldest).
 */

import {
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
  createListingSummaryFromRecord,
  isRecordOversized,
  safeValidateRecordItem,
} from './validation';

export class MemoryHistoryStore implements IHistoryStore {
  readonly status: HistoryStoreStatus = 'degraded';
  private records: Map<string, SavedCalculationRecord> = new Map();

  async init(): Promise<void> {
    // In-memory store is immediately ready in degraded mode
    return Promise.resolve();
  }

  async getAllSummaries(): Promise<readonly HistoryListingSummary[]> {
    const list = Array.from(this.records.values());
    // Sort newest first by createdAt descending
    list.sort((a, b) => b.createdAt - a.createdAt);
    return list.map((rec) => createListingSummaryFromRecord(rec));
  }

  async getRecord(id: string): Promise<SavedCalculationRecord | null> {
    const rec = this.records.get(id);
    if (!rec) return null;
    const validated = safeValidateRecordItem(rec);
    return validated.valid && validated.record ? validated.record : null;
  }

  async saveRecord(record: SavedCalculationRecord): Promise<SaveResult> {
    const sizeCheck = isRecordOversized(record);
    if (sizeCheck.oversized) {
      return {
        success: false,
        prunedCount: 0,
        byteSize: sizeCheck.byteSize,
        error: `Calculation snapshot exceeds maximum allowable size (${Math.round(sizeCheck.byteSize / 1024)} KB > 512 KB). Not saved.`,
      };
    }

    this.records.set(record.id, record);

    // Retention pruning: retain newest, evict oldest
    let prunedCount = 0;
    if (this.records.size > HISTORY_MAX_RECORDS) {
      const sorted = Array.from(this.records.values()).sort((a, b) => a.createdAt - b.createdAt);
      while (sorted.length > HISTORY_MAX_RECORDS) {
        const oldest = sorted.shift();
        if (oldest) {
          this.records.delete(oldest.id);
          prunedCount++;
        }
      }
    }

    return {
      success: true,
      recordId: record.id,
      prunedCount,
      byteSize: sizeCheck.byteSize,
    };
  }

  async updateAppearance(
    id: string,
    updates: { curveColor?: string; direction?: 'forward' | 'reverse' },
  ): Promise<UpdateAppearanceResult> {
    const existing = this.records.get(id);
    if (!existing) {
      return { success: false, found: false };
    }

    const updated: SavedCalculationRecord = {
      ...existing,
      curveColor: updates.curveColor || existing.curveColor,
      direction: updates.direction || existing.direction,
      updatedAt: Date.now(),
    };

    this.records.set(id, updated);
    return { success: true, found: true };
  }

  async deleteRecord(id: string): Promise<DeleteResult> {
    const found = this.records.delete(id);
    return { success: true, found };
  }

  async clearHistory(): Promise<ClearResult> {
    const clearedCount = this.records.size;
    this.records.clear();
    return { success: true, clearedCount };
  }

  dispose(): void {
    this.records.clear();
  }
}
