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

/**
 * Comprehensive strict validation of a stored record before restoration.
 * Validates payload version, mathematical discriminants, exact expressions,
 * intervals, bounds, direction, and color (Section 9).
 */
export function validateStrictSavedRecord(record: unknown): {
  valid: boolean;
  record?: SavedCalculationRecord;
  isCorrupt?: boolean;
  isIncompatible?: boolean;
  error?: string;
} {
  if (!record || typeof record !== 'object') {
    return { valid: false, isCorrupt: true, error: 'Record must be a non-null object.' };
  }

  const r = record as Record<string, unknown>;

  if (typeof r.id !== 'string' || r.id.trim().length === 0) {
    return { valid: false, isCorrupt: true, error: 'Missing or invalid record ID.' };
  }

  if (typeof r.schemaVersion !== 'number') {
    return { valid: false, isCorrupt: true, error: 'Missing or invalid schemaVersion.' };
  }

  // Check future unknown schema version
  if (r.schemaVersion > CURRENT_PERSISTENCE_SCHEMA_VERSION) {
    return {
      valid: false,
      isIncompatible: true,
      error: `Unsupported future schema version (${r.schemaVersion} > ${CURRENT_PERSISTENCE_SCHEMA_VERSION}).`,
    };
  }

  if (typeof r.createdAt !== 'number' || !Number.isFinite(r.createdAt)) {
    return { valid: false, isCorrupt: true, error: 'Invalid createdAt timestamp.' };
  }

  if (typeof r.curveColor !== 'string' || !isValidHexColor(r.curveColor)) {
    return { valid: false, isCorrupt: true, error: `Invalid curveColor: ${String(r.curveColor)}` };
  }

  if (!r.request || typeof r.request !== 'object') {
    return { valid: false, isCorrupt: true, error: 'Missing calculation request payload.' };
  }

  if (!r.result || typeof r.result !== 'object') {
    return { valid: false, isCorrupt: true, error: 'Missing calculation result payload.' };
  }

  const res = r.result as Record<string, unknown>;
  const allowedStatuses = [
    'verified-curve',
    'empty-bounded',
    'degenerate',
    'inconclusive',
    'unsupported',
    'invalid-input',
    'cancelled',
    'runtime-failure',
  ];

  if (typeof res.status !== 'string' || !allowedStatuses.includes(res.status)) {
    return { valid: false, isCorrupt: true, error: `Invalid result status: ${String(res.status)}` };
  }

  // If verified-curve, validate curve structure
  if (res.status === 'verified-curve') {
    if (!res.curve || typeof res.curve !== 'object') {
      return { valid: false, isCorrupt: true, error: 'Verified curve result missing exact curve object.' };
    }
    const c = res.curve as Record<string, unknown>;
    if (typeof c.paramSymbol !== 'string' || typeof c.x !== 'string' || typeof c.y !== 'string' || typeof c.z !== 'string') {
      return { valid: false, isCorrupt: true, error: 'Exact curve missing coordinates or paramSymbol.' };
    }
    if (!c.domain || typeof c.domain !== 'object') {
      return { valid: false, isCorrupt: true, error: 'Exact curve missing parameter domain.' };
    }
  }

  // Extract raw equations if missing at top-level
  const req = r.request as Record<string, unknown>;
  const surfaceF = typeof r.surfaceF === 'string' ? r.surfaceF : (req.surfaceF as Record<string, unknown>)?.rawInput as string ?? '';
  const surfaceG = typeof r.surfaceG === 'string' ? r.surfaceG : (req.surfaceG as Record<string, unknown>)?.rawInput as string ?? '';
  const direction = (r.direction === 'reverse' || req.direction === 'reverse') ? 'reverse' : 'forward';

  const normalized: SavedCalculationRecord = {
    ...(r as unknown as SavedCalculationRecord),
    surfaceF,
    surfaceG,
    direction,
    statusKind: res.status as CalculationResult['status'],
    updatedAt: typeof r.updatedAt === 'number' ? r.updatedAt : (r.createdAt as number),
  };

  return { valid: true, record: normalized };
}
