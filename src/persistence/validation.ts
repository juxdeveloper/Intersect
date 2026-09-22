/**
 * Validation, serialization, and size estimation utilities for Intersect persistence.
 */

import {
  HISTORY_MAX_RECORD_BYTES,
  validateStrictSavedRecord,
  type SavedCalculationRecord,
  type HistoryListingSummary,
  type CalculationResult,
  type TraversalDirection,
} from '../contracts';

/**
 * Accurately estimates UTF-8 encoded byte size of a record or object.
 */
export function estimatePayloadByteSize(obj: unknown): number {
  try {
    const jsonStr = JSON.stringify(obj);
    if (typeof TextEncoder !== 'undefined') {
      return new TextEncoder().encode(jsonStr).length;
    }
    // Fallback: 1 char ~= 1-2 bytes
    return jsonStr.length * 1.2;
  } catch {
    return 0;
  }
}

/**
 * Creates a compact listing summary from a stored record.
 */
export function createListingSummaryFromRecord(
  record: SavedCalculationRecord,
  byteSize?: number,
): HistoryListingSummary {
  const req = record.request;
  const surfaceF = record.surfaceF || req?.surfaceF?.rawInput || 'F';
  const surfaceG = record.surfaceG || req?.surfaceG?.rawInput || 'G';
  const direction: TraversalDirection = record.direction || req?.direction || 'forward';
  const statusKind: CalculationResult['status'] = record.result?.status || 'unsupported';

  let summaryLabel = '';
  if (record.result?.status === 'verified-curve') {
    const curve = record.result.curve;
    summaryLabel = `r(t) = (${curve.x}, ${curve.y}, ${curve.z})`;
  } else if (record.result?.status === 'empty-bounded') {
    summaryLabel = record.result.proofScope === 'global' ? 'Global emptiness' : 'Bounded emptiness';
  } else if (record.result?.status === 'degenerate') {
    summaryLabel = record.result.nature === 'isolated-point' ? 'Isolated point' : record.result.message;
  } else if (record.result?.status === 'inconclusive') {
    summaryLabel = 'Could not determine';
  }

  return {
    id: record.id,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt || record.createdAt,
    surfaceF,
    surfaceG,
    direction,
    curveColor: record.curveColor,
    statusKind,
    isExample: record.isExample,
    title: record.title,
    isCompatible: true,
    isCorrupt: false,
    summaryLabel: summaryLabel.length > 80 ? `${summaryLabel.slice(0, 77)}...` : summaryLabel,
    byteSize: byteSize ?? estimatePayloadByteSize(record),
  };
}

/**
 * Safely parses and validates an unknown raw item retrieved from IndexedDB.
 * If corrupt, returns a marked summary so the item can be quarantined/deleted
 * rather than crashing the list (Section 9).
 */
export function safeValidateRecordItem(raw: unknown): {
  valid: boolean;
  record?: SavedCalculationRecord;
  summary: HistoryListingSummary;
} {
  const validation = validateStrictSavedRecord(raw);

  if (validation.valid && validation.record) {
    return {
      valid: true,
      record: validation.record,
      summary: createListingSummaryFromRecord(validation.record),
    };
  }

  // Corrupt or incompatible record fallback summary
  const fallbackId = (raw && typeof raw === 'object' && typeof (raw as Record<string, unknown>).id === 'string')
    ? (raw as Record<string, unknown>).id as string
    : `corrupt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

  const fallbackCreated = (raw && typeof raw === 'object' && typeof (raw as Record<string, unknown>).createdAt === 'number')
    ? (raw as Record<string, unknown>).createdAt as number
    : Date.now();

  const fallbackSummary: HistoryListingSummary = {
    id: fallbackId,
    createdAt: fallbackCreated,
    updatedAt: fallbackCreated,
    surfaceF: 'Unknown',
    surfaceG: 'Unknown',
    direction: 'forward',
    curveColor: '#888888',
    statusKind: validation.isIncompatible ? 'incompatible' : 'corrupt',
    isCompatible: !validation.isIncompatible,
    isCorrupt: !!validation.isCorrupt,
    summaryLabel: validation.error || 'Corrupted record',
  };

  return {
    valid: false,
    summary: fallbackSummary,
  };
}

/**
 * Checks if a record exceeds the single-record payload size budget.
 */
export function isRecordOversized(record: SavedCalculationRecord): {
  oversized: boolean;
  byteSize: number;
} {
  const byteSize = estimatePayloadByteSize(record);
  return {
    oversized: byteSize > HISTORY_MAX_RECORD_BYTES,
    byteSize,
  };
}
