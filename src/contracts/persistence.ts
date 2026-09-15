/**
 * Persistence contracts and schema for Intersect history.
 *
 * Requirements (Phase V10):
 * - Persisted in browser IndexedDB database ('intersect_db').
 * - Schema versioned to support forward/backward migrations without data loss.
 * - Storage failures (e.g. quota exceeded or incognito blocking) degrade gracefully
 *   without breaking the active calculation workflow (with in-memory session-only fallback).
 * - Stores complete calculation state: inputs, exact outputs, derivation, direction, and committed curve color.
 * - Regenerates display geometry dynamically from restored mathematical data rather than persisting large meshes.
 */

import type { CalculationRequest } from './calculation';
import type { CalculationResult } from './results';
import type { TraversalDirection } from './curve';
import type { WorldBounds } from './bounds';
import { isValidHexColor } from './appearance';

export const CURRENT_PERSISTENCE_SCHEMA_VERSION = 1;
export const CURRENT_RECORD_PAYLOAD_VERSION = 1;

export const DB_NAME = 'intersect_db';
export const DB_VERSION = 1;
export const CALCULATIONS_STORE_NAME = 'calculations';

/**
 * Tunable retention and quota limits in one central location (Section 7).
 */
export const HISTORY_MAX_RECORDS = 100;
export const HISTORY_MAX_RECORD_BYTES = 512 * 1024; // 512 KiB per individual record
export const HISTORY_TOTAL_BUDGET_BYTES = 5 * 1024 * 1024; // 5 MiB conservative encoded budget

export interface SavedCalculationRecord {
  /** Unique calculation record identifier (collision-resistant UUID) */
  readonly id: string;
  /** Schema version for database migration tracking */
  readonly schemaVersion: number;
  /** Payload format version */
  readonly payloadVersion?: number;
  /** Epoch timestamp in ms when calculation was saved (immutable creation time) */
  readonly createdAt: number;
  /** Epoch timestamp in ms when calculation appearance or direction was last updated in place */
  readonly updatedAt?: number;
  /** Complete calculation request (inputs, direction, bounds) */
  readonly request: CalculationRequest;
  /** Calculation result (exact curve, derivation, or verified outcome) */
  readonly result: CalculationResult;
  /** Committed curve color (e.g. "#f5eedb" warm off-white) */
  readonly curveColor: string;
  /** Surface F equation raw LaTeX */
  readonly surfaceF?: string;
  /** Surface G equation raw LaTeX */
  readonly surfaceG?: string;
  /** Traversal direction matching committed state */
  readonly direction?: TraversalDirection;
  /** Calculation bounds */
  readonly bounds?: WorldBounds;
  /** Result status kind for indexing and quick listing */
  readonly statusKind?: CalculationResult['status'];
  /** Optional custom title or notes */
  readonly title?: string;
  /** Whether this calculation was created from the reference example */
  readonly isExample?: boolean;
}

/**
 * Lightweight listing summary item to populate History drawer/panel
 * without deserializing full derivation steps and algebraic certificates.
 */
export interface HistoryListingSummary {
  readonly id: string;
  readonly createdAt: number;
  readonly updatedAt: number;
  readonly surfaceF: string;
  readonly surfaceG: string;
  readonly direction: TraversalDirection;
  readonly curveColor: string;
  readonly statusKind: CalculationResult['status'] | 'corrupt' | 'incompatible';
  readonly isExample?: boolean;
  readonly title?: string;
  readonly isCompatible: boolean;
  readonly isCorrupt: boolean;
  readonly summaryLabel?: string;
  readonly byteSize?: number;
}

/**
 * History store operational status.
 */
export type HistoryStoreStatus = 'uninitialized' | 'ready' | 'degraded' | 'blocked';

/**
 * Basic schema validation for a saved calculation record (backwards-compatible with V1).
 */
export function validateSavedRecord(record: unknown): record is SavedCalculationRecord {
  if (!record || typeof record !== 'object') return false;
  const r = record as Record<string, unknown>;
  return (
    typeof r.id === 'string' &&
    typeof r.schemaVersion === 'number' &&
    typeof r.createdAt === 'number' &&
    typeof r.curveColor === 'string' &&
    r.request !== null &&
    typeof r.request === 'object' &&
    r.result !== null &&
    typeof r.result === 'object'
  );
}