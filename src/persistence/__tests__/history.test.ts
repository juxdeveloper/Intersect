import { describe, it, expect, beforeEach } from 'vitest';
import {
  CURRENT_PERSISTENCE_SCHEMA_VERSION,
  CURRENT_RECORD_PAYLOAD_VERSION,
  HISTORY_MAX_RECORDS,
  createFiniteEndpoint,
  createInterval,
  createCalculationRequest,
  type SavedCalculationRecord,
  type VerifiedCurveResult,
  type EmptyBoundedResult,
} from '../../contracts';
import {
  estimatePayloadByteSize,
  isRecordOversized,
  safeValidateRecordItem,
  createListingSummaryFromRecord,
} from '../validation';
import { MemoryHistoryStore } from '../memory-store';
import { HistoryController } from '../history-controller';
import { checkAndMigrateLegacyStorage } from '../legacy-migration';

describe('Intersect V10 Persistence & Validation Suite', () => {
  const sampleVerifiedResult: VerifiedCurveResult = {
    status: 'verified-curve',
    curve: {
      paramSymbol: 't',
      x: '2*cos(t)',
      y: '2*sin(t)',
      z: '2*cos(t) + 2*sin(t)',
      domain: {
        intervals: [
          createInterval(
            createFiniteEndpoint('0', 0),
            true,
            createFiniteEndpoint('2*pi', 2 * Math.PI),
            false,
          ),
        ],
      },
      direction: 'forward',
      verification: {
        status: 'verified',
        scope: 'Algebraically verified on domain',
        surfaceFIdentityHolds: true,
        surfaceGIdentityHolds: true,
        domainSingularitiesChecked: true,
        method: 'symbolic_identity',
        verifiedAt: 1700000000000,
      },
    },
    derivation: {
      strategyName: 'Cylindrical Projection',
      steps: [
        {
          stepNumber: 1,
          title: 'State equations',
          formulaText: 'x^2 + y^2 = 4, z = x + y',
          explanation: 'Surface intersection cylinder and plane.',
        },
      ],
    },
    componentScope: 'Single continuous closed ellipse',
  };

  const sampleRecord: SavedCalculationRecord = {
    id: 'test-rec-1',
    schemaVersion: CURRENT_PERSISTENCE_SCHEMA_VERSION,
    payloadVersion: CURRENT_RECORD_PAYLOAD_VERSION,
    createdAt: 1700000000000,
    updatedAt: 1700000000000,
    surfaceF: 'x^2 + y^2 = 4',
    surfaceG: 'z = x + y',
    direction: 'forward',
    curveColor: '#f5eedb',
    bounds: {
      x: { min: -1000, max: 1000 },
      y: { min: -1000, max: 1000 },
      z: { min: -1000, max: 1000 },
    },
    result: sampleVerifiedResult,
    request: createCalculationRequest('x^2 + y^2 = 4', 'z = x + y'),
    isExample: false,
    statusKind: 'verified-curve',
  };

  describe('1. Payload Validation and Size Estimation', () => {
    it('accurately estimates UTF-8 encoded payload size', () => {
      const size = estimatePayloadByteSize(sampleRecord);
      expect(size).toBeGreaterThan(100);
      expect(size).toBeLessThan(50 * 1024); // Well under 50 KB
    });

    it('identifies oversized records exceeding the 512 KiB budget', () => {
      const normalCheck = isRecordOversized(sampleRecord);
      expect(normalCheck.oversized).toBe(false);

      // Create synthetic giant record
      const giantRecord: SavedCalculationRecord = {
        ...sampleRecord,
        title: 'A'.repeat(600 * 1024), // 600 KB string
      };
      const giantCheck = isRecordOversized(giantRecord);
      expect(giantCheck.oversized).toBe(true);
      expect(giantCheck.byteSize).toBeGreaterThan(512 * 1024);
    });

    it('creates compact listing summaries without full derivation payload', () => {
      const summary = createListingSummaryFromRecord(sampleRecord);
      expect(summary.id).toBe('test-rec-1');
      expect(summary.surfaceF).toBe('x^2 + y^2 = 4');
      expect(summary.surfaceG).toBe('z = x + y');
      expect(summary.curveColor).toBe('#f5eedb');
      expect(summary.statusKind).toBe('verified-curve');
      expect(summary.direction).toBe('forward');
      expect(summary.isCompatible).toBe(true);
      expect(summary.isCorrupt).toBe(false);
    });

    it('safely quarantines corrupted records without crashing', () => {
      const corruptRaw = {
        id: 'bad-row-99',
        schemaVersion: 1,
        createdAt: 'invalid-date', // string instead of number
        curveColor: 'not-a-color',
      };

      const result = safeValidateRecordItem(corruptRaw);
      expect(result.valid).toBe(false);
      expect(result.summary.isCorrupt).toBe(true);
      expect(result.summary.id).toBe('bad-row-99');
      expect(result.summary.statusKind).toBe('corrupt');
    });

    it('marks future unsupported schema versions as incompatible', () => {
      const futureRaw = {
        ...sampleRecord,
        schemaVersion: 999, // Future version
      };

      const result = safeValidateRecordItem(futureRaw);
      expect(result.valid).toBe(false);
      expect(result.summary.isCompatible).toBe(false);
      expect(result.summary.statusKind).toBe('incompatible');
    });
  });

  describe('2. Memory History Store Operations & Retention', () => {
    let store: MemoryHistoryStore;

    beforeEach(async () => {
      store = new MemoryHistoryStore();
      await store.init();
    });

    it('saves and retrieves valid calculation records losslessly', async () => {
      const saveRes = await store.saveRecord(sampleRecord);
      expect(saveRes.success).toBe(true);
      expect(saveRes.recordId).toBe('test-rec-1');

      const retrieved = await store.getRecord('test-rec-1');
      expect(retrieved).not.toBeNull();
      expect(retrieved?.id).toBe(sampleRecord.id);
      expect(retrieved?.surfaceF).toBe(sampleRecord.surfaceF);
      expect(retrieved?.surfaceG).toBe(sampleRecord.surfaceG);
      expect(retrieved?.curveColor).toBe(sampleRecord.curveColor);
      expect(retrieved?.direction).toBe(sampleRecord.direction);
      expect(retrieved?.result.status).toBe('verified-curve');

      const summaries = await store.getAllSummaries();
      expect(summaries.length).toBe(1);
      expect(summaries[0]?.id).toBe('test-rec-1');
    });

    it('enforces atomic retention limit (HISTORY_MAX_RECORDS = 100), evicting oldest records', async () => {
      // Insert 105 records with sequential timestamps
      for (let i = 0; i < 105; i++) {
        const rec: SavedCalculationRecord = {
          ...sampleRecord,
          id: `rec-${i}`,
          createdAt: 1000 + i,
          surfaceF: `x = ${i}`,
        };
        await store.saveRecord(rec);
      }

      const summaries = await store.getAllSummaries();
      expect(summaries.length).toBe(HISTORY_MAX_RECORDS);

      // Oldest records (0 to 4) should have been pruned
      expect(summaries.find((s) => s.id === 'rec-0')).toBeUndefined();
      expect(summaries.find((s) => s.id === 'rec-4')).toBeUndefined();

      // Newest records (5 to 104) should be present
      expect(summaries.find((s) => s.id === 'rec-5')).toBeDefined();
      expect(summaries.find((s) => s.id === 'rec-104')).toBeDefined();

      // Summaries should be ordered newest first (rec-104 first)
      expect(summaries[0]?.id).toBe('rec-104');
    });

    it('updates committed appearance in place without changing creation time or math', async () => {
      await store.saveRecord(sampleRecord);

      const updateRes = await store.updateAppearance('test-rec-1', {
        curveColor: '#34d399',
        direction: 'reverse',
      });

      expect(updateRes.success).toBe(true);
      expect(updateRes.found).toBe(true);

      const updated = await store.getRecord('test-rec-1');
      expect(updated?.curveColor).toBe('#34d399');
      expect(updated?.direction).toBe('reverse');
      // Immutable creation time preserved
      expect(updated?.createdAt).toBe(sampleRecord.createdAt);
      // Math payload untouched
      expect(updated?.surfaceF).toBe('x^2 + y^2 = 4');
      expect(updated?.result.status).toBe('verified-curve');
    });

    it('does NOT resurrect deleted records when a stale appearance update occurs', async () => {
      await store.saveRecord(sampleRecord);

      // Delete the record
      const delRes = await store.deleteRecord('test-rec-1');
      expect(delRes.success).toBe(true);

      // Subsequent stale appearance update
      const updateRes = await store.updateAppearance('test-rec-1', {
        curveColor: '#fbbf24',
      });

      expect(updateRes.found).toBe(false);
      expect(await store.getRecord('test-rec-1')).toBeNull();
    });

    it('clears all history atomically', async () => {
      await store.saveRecord({ ...sampleRecord, id: 'rec-a' });
      await store.saveRecord({ ...sampleRecord, id: 'rec-b' });

      expect((await store.getAllSummaries()).length).toBe(2);

      const clearRes = await store.clearHistory();
      expect(clearRes.success).toBe(true);
      expect(clearRes.clearedCount).toBe(2);

      expect((await store.getAllSummaries()).length).toBe(0);
    });
  });

  describe('3. HistoryController Coordination and Lifecycle', () => {
    let store: MemoryHistoryStore;
    let controller: HistoryController;

    beforeEach(async () => {
      store = new MemoryHistoryStore();
      controller = new HistoryController(store);
      await controller.init();
    });

    it('saves terminal calculation outcomes and tracks active record', async () => {
      const saveRes = await controller.saveCalculation({
        surfaceF: 'x^2 + y^2 = 4',
        surfaceG: 'z = x + y',
        direction: 'forward',
        curveColor: '#f5eedb',
        bounds: {
          x: { min: -1000, max: 1000 },
          y: { min: -1000, max: 1000 },
          z: { min: -1000, max: 1000 },
        },
        result: sampleVerifiedResult,
        request: createCalculationRequest('x^2 + y^2 = 4', 'z = x + y'),
      });

      expect(saveRes.success).toBe(true);
      expect(saveRes.recordId).toBeDefined();
      expect(controller.activeRecordId).toBe(saveRes.recordId);
      expect(controller.summaries.length).toBe(1);
    });

    it('refuses to save incomplete, cancelled, or runtime failures as durable history', async () => {
      const cancelRes = await controller.saveCalculation({
        surfaceF: 'x = 1',
        surfaceG: 'y = 2',
        direction: 'forward',
        curveColor: '#f5eedb',
        bounds: {
          x: { min: -1000, max: 1000 },
          y: { min: -1000, max: 1000 },
          z: { min: -1000, max: 1000 },
        },
        result: {
          status: 'cancelled',
          reason: 'User cancelled',
          cancelledAt: Date.now(),
        },
        request: createCalculationRequest('x = 1', 'y = 2'),
      });

      expect(cancelRes.success).toBe(false);
      expect(controller.summaries.length).toBe(0);
    });

    it('saves proved empty and degenerate outcomes faithfully', async () => {
      const emptyResult: EmptyBoundedResult = {
        status: 'empty-bounded',
        bounds: {
          x: { min: -1000, max: 1000 },
          y: { min: -1000, max: 1000 },
          z: { min: -1000, max: 1000 },
        },
        reasonCode: 'disjoint_planes',
        proofScope: 'global',
        proofExplanation: 'Parallel planes z = 0 and z = 5 do not intersect.',
      };

      const res = await controller.saveCalculation({
        surfaceF: 'z = 0',
        surfaceG: 'z = 5',
        direction: 'forward',
        curveColor: '#f5eedb',
        bounds: {
          x: { min: -1000, max: 1000 },
          y: { min: -1000, max: 1000 },
          z: { min: -1000, max: 1000 },
        },
        result: emptyResult,
        request: createCalculationRequest('z = 0', 'z = 5'),
      });

      expect(res.success).toBe(true);
      expect(controller.summaries[0]?.statusKind).toBe('empty-bounded');
      expect(controller.summaries[0]?.summaryLabel).toContain('Global emptiness');
    });

    it('retrieves full record for one-click restore and updates active record ID', async () => {
      const saveRes = await controller.saveCalculation({
        surfaceF: 'x^2 + y^2 = 4',
        surfaceG: 'z = x + y',
        direction: 'forward',
        curveColor: '#f5eedb',
        bounds: {
          x: { min: -1000, max: 1000 },
          y: { min: -1000, max: 1000 },
          z: { min: -1000, max: 1000 },
        },
        result: sampleVerifiedResult,
        request: createCalculationRequest('x^2 + y^2 = 4', 'z = x + y'),
      });

      controller.setActiveRecordId(null);
      expect(controller.activeRecordId).toBeNull();

      const restored = await controller.getRecordForRestore(saveRes.recordId!);
      expect(restored).not.toBeNull();
      expect(restored?.surfaceF).toBe('x^2 + y^2 = 4');
      expect(controller.activeRecordId).toBe(saveRes.recordId);
    });

    it('clears activeRecordId when active record is deleted or cleared', async () => {
      const saveRes = await controller.saveCalculation({
        surfaceF: 'x^2 + y^2 = 4',
        surfaceG: 'z = x + y',
        direction: 'forward',
        curveColor: '#f5eedb',
        bounds: {
          x: { min: -1000, max: 1000 },
          y: { min: -1000, max: 1000 },
          z: { min: -1000, max: 1000 },
        },
        result: sampleVerifiedResult,
        request: createCalculationRequest('x^2 + y^2 = 4', 'z = x + y'),
      });

      const recId = saveRes.recordId!;
      expect(controller.activeRecordId).toBe(recId);

      await controller.deleteRecord(recId);
      expect(controller.activeRecordId).toBeNull();
      expect(controller.summaries.length).toBe(0);
    });
  });

  describe('4. Legacy Storage Migration', () => {
    let store: MemoryHistoryStore;

    beforeEach(async () => {
      store = new MemoryHistoryStore();
      await store.init();
    });

    it('safely imports legacy localStorage items if present and clears the legacy key', async () => {
      const fakeLocalStorage: Record<string, string> = {
        intersect_history: JSON.stringify([sampleRecord]),
      };

      // Mock localStorage on global
      const originalLocalStorage = globalThis.localStorage;
      globalThis.localStorage = {
        getItem: (k: string) => fakeLocalStorage[k] ?? null,
        setItem: (k: string, v: string) => { fakeLocalStorage[k] = v; },
        removeItem: (k: string) => { delete fakeLocalStorage[k]; },
        clear: () => { Object.keys(fakeLocalStorage).forEach((k) => delete fakeLocalStorage[k]); },
        key: () => null,
        length: 1,
      };

      try {
        const migratedCount = await checkAndMigrateLegacyStorage(store);
        expect(migratedCount).toBe(1);

        const summaries = await store.getAllSummaries();
        expect(summaries.length).toBe(1);
        expect(summaries[0]?.id).toBe('test-rec-1');

        // Legacy key should be removed
        expect(fakeLocalStorage['intersect_history']).toBeUndefined();

        // Repeating migration yields 0
        const secondCount = await checkAndMigrateLegacyStorage(store);
        expect(secondCount).toBe(0);
      } finally {
        globalThis.localStorage = originalLocalStorage;
      }
    });
  });
});
