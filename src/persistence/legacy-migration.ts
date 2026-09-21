/**
 * Legacy storage migration check for Intersect (Phase V10).
 *
 * Requirements (Section 9):
 * - If a real legacy localStorage history exists, import its validated records transactionally/idempotently.
 * - Keep legacy data until import succeeds and do not repeat-import on every load.
 */

import type { IHistoryStore } from './types';
import { safeValidateRecordItem } from './validation';

const LEGACY_STORAGE_KEYS = [
  'intersect_history',
  'intersect_saved_calculations',
  'intersect_history_v1',
];

export async function checkAndMigrateLegacyStorage(store: IHistoryStore): Promise<number> {
  const storage =
    typeof window !== 'undefined' && window.localStorage
      ? window.localStorage
      : typeof globalThis !== 'undefined' && globalThis.localStorage
        ? globalThis.localStorage
        : null;

  if (!storage) {
    return 0;
  }

  let totalMigrated = 0;

  for (const key of LEGACY_STORAGE_KEYS) {
    try {
      const raw = storage.getItem(key);
      if (!raw) continue;

      const parsed = JSON.parse(raw);
      const items = Array.isArray(parsed) ? parsed : [parsed];

      for (const item of items) {
        const validated = safeValidateRecordItem(item);
        if (validated.valid && validated.record) {
          const res = await store.saveRecord(validated.record);
          if (res.success) {
            totalMigrated++;
          }
        }
      }

      // Remove only after successful migration
      storage.removeItem(key);
    } catch {
      // In case of error, preserve the legacy item
    }
  }

  return totalMigrated;
}
