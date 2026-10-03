import { describe, it, expect } from 'vitest';
import {
  translations,
  getLocalizedStepTitle,
  getLocalizedStepExplanation,
  getLocalizedSolverMessage,
  getLocalizedProofExplanation,
  getLocalizedDiagnosticMessage,
} from '../index';
import { GEOMETRY_BUDGET_PRESETS } from '../../contracts/geometry';

describe('Localization & Quality Presets Verification', () => {
  it('has identical keys for ES and EN dictionaries', () => {
    const es = translations.es;
    const en = translations.en;

    expect(Object.keys(es)).toEqual(Object.keys(en));

    for (const section of Object.keys(es) as (keyof typeof es)[]) {
      const esSection = es[section];
      const enSection = en[section];
      expect(Object.keys(esSection).sort()).toEqual(Object.keys(enSection).sort());

      // Ensure no empty string translations exist
      for (const key of Object.keys(esSection) as (keyof typeof esSection)[]) {
        expect(esSection[key]).toBeTruthy();
        expect(enSection[key]).toBeTruthy();
      }
    }
  });

  it('translates procedure step titles and explanations accurately between ES and EN', () => {
    const rawStep = 'Eliminate shared quadratic parts';
    const esTitle = getLocalizedStepTitle(rawStep, 'es');
    const enTitle = getLocalizedStepTitle(rawStep, 'en');

    expect(esTitle).toBe('Eliminar partes cuadráticas compartidas');
    expect(enTitle).toBe('Eliminate shared quadratic parts');

    const rawExp = 'Verified complete global coverage without branch omission or sign-constrained loss.';
    expect(getLocalizedStepExplanation(rawExp, 'es')).toBe(
      'Se verificó la cobertura global completa sin omisión de ramas ni pérdida por restricciones de signo.',
    );
    expect(getLocalizedStepExplanation(rawExp, 'en')).toBe(rawExp);
  });

  it('translates solver status and explanation messages accurately', () => {
    const solverMsg = 'No real intersection exists in the bounded region';
    expect(getLocalizedSolverMessage(solverMsg, 'es')).toContain('No existe intersección');
    expect(getLocalizedSolverMessage(solverMsg, 'en')).toBe(solverMsg);

    const proofMsg = 'Surfaces do not intersect in the real domain';
    expect(getLocalizedProofExplanation(proofMsg, 'es')).toContain('no se intersectan en el dominio real');
    expect(getLocalizedProofExplanation(proofMsg, 'en')).toBe(proofMsg);
  });

  it('translates math field diagnostics to Spanish without English fallback', () => {
    const diag = {
      surface: 'surfaceF' as const,
      message: 'Surface F equation cannot be empty.',
      reasonCode: 'empty_input',
    };
    const esDiag = getLocalizedDiagnosticMessage(diag, 'es');
    const enDiag = getLocalizedDiagnosticMessage(diag, 'en');

    expect(esDiag).toBe('Por favor, ingresa una ecuación para la superficie.');
    expect(enDiag).toBe('Surface F equation cannot be empty.');
  });

  it('preserves legacy geometry budgets for existing internal requests', () => {
    expect(GEOMETRY_BUDGET_PRESETS.low).toBeDefined();
    expect(GEOMETRY_BUDGET_PRESETS.medium).toBeDefined();
    expect(GEOMETRY_BUDGET_PRESETS.high).toBeDefined();

    const low = GEOMETRY_BUDGET_PRESETS.low;
    const med = GEOMETRY_BUDGET_PRESETS.medium;
    const high = GEOMETRY_BUDGET_PRESETS.high;

    // Grid resolutions increase for finer surface rendering
    expect(low.gridResolution).toBeLessThan(med.gridResolution);
    expect(med.gridResolution).toBeLessThan(high.gridResolution);
    expect(high.gridResolution).toBeGreaterThanOrEqual(112);

    // Curve geometric tolerance is tighter (smaller) for smoother curves
    expect(low.curveGeometricTolerance).toBeGreaterThan(med.curveGeometricTolerance);
    expect(med.curveGeometricTolerance).toBeGreaterThan(high.curveGeometricTolerance);
    expect(high.curveGeometricTolerance).toBeLessThanOrEqual(0.002);

    // Max curve samples allow silkier representation
    expect(low.maxCurveSamples).toBeLessThan(med.maxCurveSamples);
    expect(med.maxCurveSamples).toBeLessThan(high.maxCurveSamples);
    expect(high.maxCurveSamples).toBeGreaterThanOrEqual(14000);
  });

  it('localizes only Auto and Low in the public detail control', () => {
    expect(translations.es.viewport.detailAuto).toBe('Auto');
    expect(translations.es.viewport.detailLow).toBe('Bajo');
    expect(translations.en.viewport.detailAuto).toBe('Auto');
    expect(translations.en.viewport.detailLow).toBe('Low');
    expect(translations.en.viewport).not.toHaveProperty('detailMedium');
    expect(translations.en.viewport).not.toHaveProperty('detailHigh');
  });
});
