import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { Header } from './components/Header';
import { EquationInputSection, type MathFieldInputHandle } from './components/EquationInputSection';
import { DirectionToggle } from './components/DirectionToggle';
import { ResultSection } from './components/ResultSection';
import { GraphViewport } from './components/GraphViewport';
import {
  createCalculationRequest,
  prepareCalculationRequest,
  createFiniteEndpoint,
  createInterval,
  type TraversalDirection,
  type ExactCurve,
  type DerivationRecord,
  type VerifiedCurveResult,
  type CalculationResult,
  type EquationDiagnostic,
  type WorldBounds,
  type ExpressionNode,
} from './contracts';
import { useSymPyRuntime } from './runtime';
import { useGeometry } from './geometry';
import { parseMathInput } from './math';
import { prepareSurfaceEquation } from './math/pipeline';
import { createSymbolNode } from './math/ast';
import type { GeometryRequest } from './contracts/geometry';
import {
  DEFAULT_CURVE_PALETTE_COLOR,
  getNextDefaultCurveColor,
} from './contracts/appearance';
import { useHistory } from './persistence';
import { HistoryDrawer } from './components/HistoryDrawer';
import { type QualityLevel } from './components/GraphViewport';
import {
  getInitialLanguage,
  saveLanguagePreference,
  type SupportedLanguage,
  translations,
  getLocalizedDiagnosticMessage,
  getLocalizedSolverMessage,
  getLocalizedProofExplanation,
  getLocalizedStepExplanation,
} from './i18n';
import {
  getInitialThemePreference,
  saveThemePreference,
  applyTheme,
  resolveEffectiveTheme,
  type ThemePreference,
  type EffectiveTheme,
} from './styles/theme';
import { pwaManager, type PwaStatus } from './pwa/pwa-manager';

interface SubmittedCalculation {
  surfaceF: string;
  surfaceG: string;
  direction: TraversalDirection;
  calculationId: string | number;
  result: CalculationResult | null;
  isExample: boolean;
  curveColor?: string;
  savedRecordId?: string | null;
}

export const App: React.FC = () => {
  // Localization (Spanish first-visit default, persisted preference)
  const [lang, setLang] = useState<SupportedLanguage>(getInitialLanguage);
  const t = translations[lang] ?? translations.es;

  // Synchronize persisted language with document metadata after every load.
  useEffect(() => {
    saveLanguagePreference(lang);
  }, [lang]);

  // Theming (Auto initial default, light / dark options, persisted)
  const [themePref, setThemePref] = useState<ThemePreference>(getInitialThemePreference);
  const [effectiveTheme, setEffectiveTheme] = useState<EffectiveTheme>(() =>
    resolveEffectiveTheme(getInitialThemePreference()),
  );

  // PWA installation and offline status
  const [canInstall, setCanInstall] = useState<boolean>(() => pwaManager.canInstall());
  const [, setPwaStatus] = useState<PwaStatus>(() => pwaManager.getStatus());

  // Listen to theme preference changes and system dark/light events
  useEffect(() => {
    const eff = applyTheme(themePref);
    setEffectiveTheme(eff);
    saveThemePreference(themePref);

    if (themePref === 'auto' && typeof window !== 'undefined') {
      const media = window.matchMedia('(prefers-color-scheme: light)');
      const listener = () => {
        const updatedEff = applyTheme('auto');
        setEffectiveTheme(updatedEff);
      };
      media.addEventListener('change', listener);
      return () => media.removeEventListener('change', listener);
    }
  }, [themePref]);

  // Language preference handler
  const handleLanguageChange = useCallback((newLang: SupportedLanguage) => {
    setLang(newLang);
    saveLanguagePreference(newLang);
  }, []);

  // Subscribe to PWA readiness and install prompt events
  useEffect(() => {
    return pwaManager.subscribe((status) => {
      setPwaStatus(status);
      setCanInstall(pwaManager.canInstall());
    });
  }, []);
  // Persistence / History integration (Phase V10)
  const {
    status: historyStatus,
    summaries: historySummaries,
    activeRecordId,
    notice: historyNotice,
    saveCalculation,
    updateAppearance: updateHistoryAppearance,
    getRecordForRestore,
    deleteRecord: deleteHistoryRecord,
    clearAllHistory,
    clearNotice: clearHistoryNotice,
    setActiveRecordId,
  } = useHistory();

  const [isHistoryDrawerOpen, setIsHistoryDrawerOpen] = useState(false);
  const historyTriggerRef = useRef<HTMLButtonElement | null>(null);

  // Editable draft states
  const [surfaceF, setSurfaceF] = useState<string>('x^2 + y^2 = 4');
  const [surfaceG, setSurfaceG] = useState<string>('z = x + y');
  const [direction, setDirection] = useState<TraversalDirection>('forward');
  const [activeCurveColor, setActiveCurveColor] = useState<string>(DEFAULT_CURVE_PALETTE_COLOR);
  const [calculationSeqCount, setCalculationSeqCount] = useState<number>(0);
  const [renderRegion, setRenderRegion] = useState<WorldBounds>({
    x: { min: -50, max: 50 },
    y: { min: -50, max: 50 },
    z: { min: -50, max: 50 },
  });
  const [geometryQuality, setGeometryQuality] = useState<QualityLevel>('high');

  // Diagnostics and validation
  const [fDiagnostic, setFDiagnostic] = useState<EquationDiagnostic | null>(null);
  const [gDiagnostic, setGDiagnostic] = useState<EquationDiagnostic | null>(null);
  const [statusFeedback, setStatusFeedback] = useState<{
    type: 'info' | 'error' | 'success';
    message: string;
  } | null>(null);

  // Field element handles for focus management
  const surfaceFRef = useRef<MathFieldInputHandle | null>(null);
  const surfaceGRef = useRef<MathFieldInputHandle | null>(null);

  // Reference curves and derivations
  const referenceForwardCurve: ExactCurve = useMemo(
    () => ({
      paramSymbol: 't',
      x: '2 cos t',
      y: '2 sin t',
      z: '2 cos t + 2 sin t',
      domain: {
        intervals: [
          createInterval(
            createFiniteEndpoint('0', 0),
            true,
            createFiniteEndpoint('2π', 2 * Math.PI),
            false,
          ),
        ],
      },
      direction: 'forward',
      traversal: {
        orientation: 'forward',
        parameterMapping: {
          type: 'identity',
          formula: 't = t',
          canonicalParam: 't',
          orientedParam: 't',
        },
        isClosed: true,
        isPeriodic: true,
        period: '2*pi',
        segmentCount: 1,
        disjointGapsPreserved: true,
      },
      verification: {
        status: 'verified',
        scope: 'Algebraically verified on t in [0, 2π); F(r(t))=0 and G(r(t))=0 identically.',
        surfaceFIdentityHolds: true,
        surfaceGIdentityHolds: true,
        domainSingularitiesChecked: true,
        method: 'symbolic_identity',
        verifiedAt: 1700000000000,
      },
    }),
    [],
  );

  const referenceReverseCurve: ExactCurve = useMemo(
    () => ({
      paramSymbol: 'u',
      x: '2 cos(-u)',
      y: '2 sin(-u)',
      z: '2 cos(-u) + 2 sin(-u)',
      domain: {
        intervals: [
          createInterval(
            createFiniteEndpoint('0', 0),
            false,
            createFiniteEndpoint('2π', 2 * Math.PI),
            true,
          ),
        ],
      },
      direction: 'reverse',
      traversal: {
        orientation: 'reverse',
        parameterMapping: {
          type: 'finite_reflection',
          formula: 't = 2*pi - u',
          canonicalParam: 't',
          orientedParam: 'u',
        },
        isClosed: true,
        isPeriodic: true,
        period: '2*pi',
        segmentCount: 1,
        disjointGapsPreserved: true,
      },
      verification: {
        status: 'verified',
        scope: 'Algebraically verified on u in (0, 2π]; F(r(u))=0 and G(r(u))=0 identically.',
        surfaceFIdentityHolds: true,
        surfaceGIdentityHolds: true,
        domainSingularitiesChecked: true,
        method: 'symbolic_identity',
        verifiedAt: 1700000000000,
      },
    }),
    [],
  );

  const referenceForwardDerivation: DerivationRecord = useMemo(
    () => ({
      strategyName: 'Cylindrical Projection & Linear Substitution',
      steps: [
        {
          stepNumber: 1,
          title: 'State surface equations and domain restrictions',
          formulaText: 'F(x,y,z): x^2 + y^2 = 4,  G(x,y,z): z = x + y',
          explanation:
            'Surface F is a circular cylinder of radius 2 parallel to the z-axis. Surface G is an affine plane.',
        },
        {
          stepNumber: 2,
          title: 'Parameterize circular cylinder cross-section',
          formulaText: 'x^2 + y^2 = 4  ⇒  x(t) = 2 cos(t),  y(t) = 2 sin(t)',
          explanation:
            'The projection onto the xy-plane is a circle of radius 2. Choose canonical parameter t ∈ [0, 2π).',
          validityConditions: ['t ∈ [0, 2π)'],
        },
        {
          stepNumber: 3,
          title: 'Substitute into planar surface G',
          formulaText: 'z = x + y  ⇒  z(t) = 2 cos(t) + 2 sin(t)',
          explanation:
            'Surface G defines z explicitly as x + y. Directly evaluate along the parameterized x(t) and y(t).',
        },
        {
          stepNumber: 4,
          title: 'Establish parameter domain and bounding box check',
          formulaText: 't ∈ [0, 2π),  ||r(t)|| ≤ 2√3 < 1000',
          explanation:
            'The curve is completely contained within the calculation bounds [-1000, 1000]³.',
          validityConditions: ['t ∈ [0, 2π)'],
        },
        {
          stepNumber: 5,
          title: 'Verify algebraic surface membership',
          formulaText:
            '(2 cos t)² + (2 sin t)² - 4 = 0  ✓,  z(t) - (x(t) + y(t)) = 0  ✓',
          explanation:
            'Both surface equations are identically satisfied for all real t in [0, 2π).',
        },
        {
          stepNumber: 6,
          title: 'Result scope and component coverage',
          formulaText: 'Closed periodic space ellipse',
          explanation:
            'Single closed smooth elliptic component formed by the planar section of the cylinder.',
        },
      ],
    }),
    [],
  );

  const referenceReverseDerivation: DerivationRecord = useMemo(
    () => ({
      strategyName: 'Cylindrical Projection & Linear Substitution',
      steps: [
        ...referenceForwardDerivation.steps,
        {
          stepNumber: 7,
          title: 'Reparameterize for reverse traversal',
          formulaText:
            't = 2π - u  ⇒  r_rev(u) = (2 cos(-u), 2 sin(-u), 2 cos(-u) + 2 sin(-u))',
          explanation:
            'Finite reflection t = 2π - u traverses the closed ellipse in reverse with parameter u ∈ (0, 2π] while preserving identical geometry and algebraic validity.',
          validityConditions: ['u ∈ (0, 2π]'],
        },
      ],
    }),
    [referenceForwardDerivation],
  );

  const sampleVerifiedResult: VerifiedCurveResult = useMemo(() => {
    const isReverse = direction === 'reverse';
    return {
      status: 'verified-curve',
      curve: isReverse ? referenceReverseCurve : referenceForwardCurve,
      canonicalCurve: referenceForwardCurve,
      reverseCurve: referenceReverseCurve,
      derivation: isReverse ? referenceReverseDerivation : referenceForwardDerivation,
      canonicalDerivation: referenceForwardDerivation,
      reverseDerivation: referenceReverseDerivation,
      componentScope: 'Single continuous closed ellipse component',
    };
  }, [
    direction,
    referenceForwardCurve,
    referenceReverseCurve,
    referenceForwardDerivation,
    referenceReverseDerivation,
  ]);

  // Immutable Submitted Calculation Snapshot
  const [submittedCalc, setSubmittedCalc] = useState<SubmittedCalculation>({
    surfaceF: 'x^2 + y^2 = 4',
    surfaceG: 'z = x + y',
    direction: 'forward',
    calculationId: 'ref-initial',
    result: sampleVerifiedResult,
    isExample: true,
    curveColor: DEFAULT_CURVE_PALETTE_COLOR,
  });

  // Draft vs submitted dirty detection
  const isDraftDirty = useMemo(() => {
    return surfaceF !== submittedCalc.surfaceF || surfaceG !== submittedCalc.surfaceG;
  }, [surfaceF, surfaceG, submittedCalc]);

  // Synchronously adapt calculation result to current traversal orientation
  const displayedCalculationResult: CalculationResult | null = useMemo(() => {
    const rawResult = submittedCalc.result;
    if (!rawResult) return null;
    if (rawResult.status !== 'verified-curve') return rawResult;

    const isReverse = direction === 'reverse';
    const curve = isReverse
      ? (rawResult.reverseCurve ?? rawResult.curve)
      : (rawResult.canonicalCurve ?? rawResult.curve);
    const derivation = isReverse
      ? (rawResult.reverseDerivation ?? rawResult.derivation)
      : (rawResult.canonicalDerivation ?? rawResult.derivation);

    return {
      ...rawResult,
      curve,
      derivation,
    };
  }, [submittedCalc.result, direction]);

  // Web Worker Runtime integration
  const {
    state: runtimeState,
    stage: runtimeStage,
    isBusy,
    isInitializing,
    calculateIntersection,
    cancel,
    retry,
    init,
  } = useSymPyRuntime();

  // Eagerly pre-warm the Pyodide/SymPy Web Worker on mount so user calculations are instant
  useEffect(() => {
    init().catch(() => {});
  }, [init]);

  // Active exact curve for geometry sampling
  const activeCurve = useMemo(() => {
    if (displayedCalculationResult?.status === 'verified-curve') {
      return displayedCalculationResult.curve;
    }
    return null;
  }, [displayedCalculationResult]);

  // Debounced surface inputs for live interactive 3D surface rendering as you type
  const [debouncedSurfaceF, setDebouncedSurfaceF] = useState(surfaceF);
  const [debouncedSurfaceG, setDebouncedSurfaceG] = useState(surfaceG);
  const lastValidFASTRef = useRef<ExpressionNode | null>(null);
  const lastValidGASTRef = useRef<ExpressionNode | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSurfaceF(surfaceF);
    }, 150);
    return () => clearTimeout(timer);
  }, [surfaceF]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSurfaceG(surfaceG);
    }, 150);
    return () => clearTimeout(timer);
  }, [surfaceG]);

  const surfaceFAst = useMemo(() => {
    const fPrep = prepareSurfaceEquation(
      { id: 'f', label: debouncedSurfaceF, rawInput: debouncedSurfaceF, format: 'latex' },
      'surfaceF',
    );
    if (fPrep.success) {
      lastValidFASTRef.current = fPrep.equation.residual;
      return fPrep.equation.residual;
    }
    const p = parseMathInput(debouncedSurfaceF, 'surfaceF');
    if (p.success) {
      lastValidFASTRef.current = p.ast;
      return p.ast;
    }
    return lastValidFASTRef.current ?? createSymbolNode('z');
  }, [debouncedSurfaceF]);

  const surfaceGAst = useMemo(() => {
    const gPrep = prepareSurfaceEquation(
      { id: 'g', label: debouncedSurfaceG, rawInput: debouncedSurfaceG, format: 'latex' },
      'surfaceG',
    );
    if (gPrep.success) {
      lastValidGASTRef.current = gPrep.equation.residual;
      return gPrep.equation.residual;
    }
    const p = parseMathInput(debouncedSurfaceG, 'surfaceG');
    if (p.success) {
      lastValidGASTRef.current = p.ast;
      return p.ast;
    }
    return lastValidGASTRef.current ?? createSymbolNode('z');
  }, [debouncedSurfaceG]);

  // Geometry Worker integration
  const {
    result: geometryResult,
    isGenerating: isGeometryGenerating,
    requestGeometry,
  } = useGeometry();

  const geometryRequest = useMemo<GeometryRequest>(() => {
    // Only draw the intersection curve if inputs match the calculated result
    const shouldDrawCurve = !isDraftDirty && activeCurve && activeCurve.traversal;

    return {
      jobId: `geom-${debouncedSurfaceF}-${debouncedSurfaceG}-${submittedCalc.calculationId}-${direction}-${renderRegion.x.min}_${renderRegion.x.max}-${geometryQuality}-${shouldDrawCurve ? 'with-curve' : 'no-curve'}`,
      calculationId: String(submittedCalc.calculationId),
      workerGeneration: 1,
      surfaceF: {
        id: 'surface-f',
        label: debouncedSurfaceF,
        residual: surfaceFAst,
      },
      surfaceG: {
        id: 'surface-g',
        label: debouncedSurfaceG,
        residual: surfaceGAst,
      },
      curve: shouldDrawCurve
        ? {
            paramSymbol: activeCurve.paramSymbol,
            xExpr: activeCurve.x,
            yExpr: activeCurve.y,
            zExpr: activeCurve.z,
            exactCurve: activeCurve,
            traversal: activeCurve.traversal,
          }
        : null,
      worldBounds: {
        x: { min: -1000, max: 1000 },
        y: { min: -1000, max: 1000 },
        z: { min: -1000, max: 1000 },
      },
      renderRegion,
      quality: geometryQuality,
    };
  }, [
    debouncedSurfaceF,
    debouncedSurfaceG,
    surfaceFAst,
    surfaceGAst,
    submittedCalc.calculationId,
    direction,
    isDraftDirty,
    activeCurve,
    renderRegion,
    geometryQuality,
  ]);

  useEffect(() => {
    requestGeometry(geometryRequest).catch(() => {
      // Ignored if cancelled/superseded
    });
  }, [geometryRequest, requestGeometry]);

  // Primary calculation executor
  const executeCalculation = useCallback(
    async (
      targetF: string,
      targetG: string,
      targetDir: TraversalDirection,
      moveFocusOnError = false,
    ) => {
      // Validate inputs using the established V2 parser & pipeline
      const rawReq = createCalculationRequest(targetF, targetG, targetDir);
      const prepResult = prepareCalculationRequest(rawReq);

      if (!prepResult.valid) {
        const fErr = prepResult.diagnostics.find((d) => d.surface === 'surfaceF') ?? null;
        const gErr = prepResult.diagnostics.find((d) => d.surface === 'surfaceG') ?? null;
        setFDiagnostic(fErr);
        setGDiagnostic(gErr);

        // Predictably move focus to the first actionable input error if user pressed Enter
        if (moveFocusOnError) {
          if (fErr) {
            surfaceFRef.current?.focus();
          } else if (gErr) {
            surfaceGRef.current?.focus();
          }
        }

        setStatusFeedback({
          type: 'error',
          message: getLocalizedDiagnosticMessage(fErr ?? gErr, lang) || t.errors.syntaxError,
        });
        return;
      }

      // Clear diagnostics on valid submission
      setFDiagnostic(null);
      setGDiagnostic(null);

      // Immediately flush debounced values for 3D surfaces
      setDebouncedSurfaceF(targetF);
      setDebouncedSurfaceG(targetG);

      const newCalculationId = Date.now();

      try {
        setStatusFeedback({
          type: 'info',
          message: isInitializing
            ? t.inputs.initializingAndSolving
            : t.inputs.solvingExact,
        });

        const calcResult = await calculateIntersection(prepResult.request);

        // Allocate next default curve color from finite curated palette
        const nextSeq = calculationSeqCount + 1;
        setCalculationSeqCount(nextSeq);
        const allocatedColor = getNextDefaultCurveColor(nextSeq);
        setActiveCurveColor(allocatedColor);

        // Create new immutable submitted calculation snapshot
        setSubmittedCalc({
          surfaceF: targetF,
          surfaceG: targetG,
          direction: targetDir,
          calculationId: newCalculationId,
          result: calcResult,
          isExample: false,
          curveColor: allocatedColor,
          savedRecordId: null,
        });

        // Save calculation snapshot to persistent history (Phase V10)
        saveCalculation({
          surfaceF: targetF,
          surfaceG: targetG,
          direction: targetDir,
          curveColor: allocatedColor,
          bounds: {
            x: { min: -1000, max: 1000 },
            y: { min: -1000, max: 1000 },
            z: { min: -1000, max: 1000 },
          },
          result: calcResult,
          request: prepResult.request,
          isExample: false,
        })
          .then((saveRes) => {
            if (saveRes.success && saveRes.recordId) {
              setSubmittedCalc((prev) =>
                prev.calculationId === newCalculationId
                  ? { ...prev, savedRecordId: saveRes.recordId }
                  : prev,
              );
            }
          })
          .catch(() => {
            // Persistence failure degrades gracefully without breaking active calculation
          });

        // Reset reference view region
        setRenderRegion({
          x: { min: -50, max: 50 },
          y: { min: -50, max: 50 },
          z: { min: -50, max: 50 },
        });

        if (calcResult.status === 'verified-curve') {
          setStatusFeedback(null);
        } else if (calcResult.status === 'empty-bounded') {
          const scopeLabel =
            calcResult.proofScope === 'global'
              ? t.results.proofScopeGlobal
              : t.results.proofScopeBounded;
          const explanation = calcResult.proofExplanation
            ? getLocalizedProofExplanation(calcResult.proofExplanation, lang)
            : t.results.noIntersection;
          setStatusFeedback({
            type: 'info',
            message: `${t.results.noIntersection} (${scopeLabel}): ${explanation}`,
          });
        } else if (calcResult.status === 'degenerate') {
          const msg = calcResult.message ? getLocalizedSolverMessage(calcResult.message, lang) : t.results.isolatedPoint;
          const exp = calcResult.explanation ? getLocalizedStepExplanation(calcResult.explanation, lang) : '';
          setStatusFeedback({
            type: 'info',
            message: `${t.results.isolatedPoint}: ${msg}. ${exp}`,
          });
        } else if (calcResult.status === 'inconclusive') {
          const msg = calcResult.message ? getLocalizedSolverMessage(calcResult.message, lang) : t.results.inconclusive;
          setStatusFeedback({
            type: 'info',
            message: `${t.results.inconclusive}: ${msg}`,
          });
        } else {
          setStatusFeedback({
            type: 'error',
            message: `${t.errors.calculationOutcome}${calcResult.status}`,
          });
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.toLowerCase().includes('cancel') || msg.toLowerCase().includes('superseded')) {
          // Normal cancellation/superseding from auto-calculation typing
          return;
        }
        setStatusFeedback({
          type: 'error',
          message: `${t.errors.runtimeError}${msg}`,
        });
      }
    },
    [
      isInitializing,
      calculateIntersection,
      calculationSeqCount,
      saveCalculation,
      lang,
      t.inputs.initializingAndSolving,
      t.inputs.solvingExact,
      t.results.noIntersection,
      t.results.isolatedPoint,
      t.results.inconclusive,
      t.results.proofScopeGlobal,
      t.results.proofScopeBounded,
      t.errors.calculationOutcome,
      t.errors.runtimeError,
      t.errors.syntaxError,
    ],
  );

  // Immediate calculation on Enter key
  const handleImmediateCalculate = useCallback(() => {
    executeCalculation(surfaceF, surfaceG, direction, true);
  }, [executeCalculation, surfaceF, surfaceG, direction]);

  // Runtime transitions must not restart the input debounce or supersede the same job.
  const executeCalculationRef = useRef(executeCalculation);
  useEffect(() => {
    executeCalculationRef.current = executeCalculation;
  }, [executeCalculation]);

  // Automatic Calculation effect: debounced calculation on valid equation modifications
  useEffect(() => {
    // Avoid re-calculating if inputs already match the submitted calculation
    if (
      surfaceF === submittedCalc.surfaceF &&
      surfaceG === submittedCalc.surfaceG &&
      direction === submittedCalc.direction
    ) {
      return;
    }

    // Don't calculate if either input is completely blank
    if (!surfaceF.trim() || !surfaceG.trim()) {
      return;
    }

    const timer = setTimeout(() => {
      // Validate inputs before auto-triggering solver
      const rawReq = createCalculationRequest(surfaceF, surfaceG, direction);
      const prep = prepareCalculationRequest(rawReq);
      if (prep.valid) {
        executeCalculationRef.current(surfaceF, surfaceG, direction, false);
      } else {
        const fErr = prep.diagnostics.find((d) => d.surface === 'surfaceF') ?? null;
        const gErr = prep.diagnostics.find((d) => d.surface === 'surfaceG') ?? null;
        setFDiagnostic(fErr);
        setGDiagnostic(gErr);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [
    surfaceF,
    surfaceG,
    direction,
    submittedCalc.surfaceF,
    submittedCalc.surfaceG,
    submittedCalc.direction,
  ]);

  // Handle direction changes and synchronize committed history record
  const handleDirectionChange = useCallback(
    (newDirection: TraversalDirection) => {
      setDirection(newDirection);
      if (submittedCalc.result?.status === 'verified-curve') {
        setSubmittedCalc((prev) => ({
          ...prev,
          direction: newDirection,
        }));
        if (submittedCalc.savedRecordId) {
          updateHistoryAppearance(submittedCalc.savedRecordId, { direction: newDirection }).catch(() => {});
        }
      }
    },
    [submittedCalc.result, submittedCalc.savedRecordId, updateHistoryAppearance],
  );

  // Load reference example handler
  const handleLoadExample = useCallback(() => {
    setSurfaceF('x^2 + y^2 = 4');
    setSurfaceG('z = x + y');
    setDebouncedSurfaceF('x^2 + y^2 = 4');
    setDebouncedSurfaceG('z = x + y');
    setDirection('forward');
    setActiveCurveColor(DEFAULT_CURVE_PALETTE_COLOR);
    setFDiagnostic(null);
    setGDiagnostic(null);
    setActiveRecordId(null);
    const newId = Date.now();
    setSubmittedCalc({
      surfaceF: 'x^2 + y^2 = 4',
      surfaceG: 'z = x + y',
      direction: 'forward',
      calculationId: newId,
      result: sampleVerifiedResult,
      isExample: true,
      curveColor: DEFAULT_CURVE_PALETTE_COLOR,
      savedRecordId: null,
    });
    setRenderRegion({
      x: { min: -50, max: 50 },
      y: { min: -50, max: 50 },
      z: { min: -50, max: 50 },
    });
    setStatusFeedback(null);
  }, [sampleVerifiedResult, setActiveRecordId]);

  // Handle committed curve color change and sync to history
  const handleCurveColorChange = useCallback(
    (newColor: string) => {
      setActiveCurveColor(newColor);
      setSubmittedCalc((prev) => ({
        ...prev,
        curveColor: newColor,
      }));
      if (submittedCalc.savedRecordId) {
        updateHistoryAppearance(submittedCalc.savedRecordId, { curveColor: newColor }).catch(() => {});
      }
    },
    [submittedCalc.savedRecordId, updateHistoryAppearance],
  );

  const handlePreviewCurveColor = useCallback((preview: string) => {
    setActiveCurveColor(preview);
  }, []);

  // One-click restoration from local history (Section 8)
  const handleRestoreRecord = useCallback(
    async (recordId: string) => {
      const record = await getRecordForRestore(recordId);
      if (!record) {
        setStatusFeedback({
          type: 'error',
          message: t.errors.restoreFailed,
        });
        return;
      }

      const surfF = record.surfaceF || record.request?.surfaceF?.rawInput || '';
      const surfG = record.surfaceG || record.request?.surfaceG?.rawInput || '';
      const dir = record.direction || record.request?.direction || 'forward';
      const color = record.curveColor || DEFAULT_CURVE_PALETTE_COLOR;
      const restoreCalcId = `restore-${Date.now()}`;

      // 1. Cancel in-progress calculation if any
      if (isBusy || isInitializing) {
        cancel('Cancelled for history restore');
      }

      // 2. Apply saved submitted snapshot to editable inputs
      setSurfaceF(surfF);
      setSurfaceG(surfG);
      setDebouncedSurfaceF(surfF);
      setDebouncedSurfaceG(surfG);
      setDirection(dir);
      setActiveCurveColor(color);
      setFDiagnostic(null);
      setGDiagnostic(null);

      // 3. Restore submitted snapshot
      setSubmittedCalc({
        surfaceF: surfF,
        surfaceG: surfG,
        direction: dir,
        calculationId: restoreCalcId,
        result: record.result,
        isExample: !!record.isExample,
        curveColor: color,
        savedRecordId: record.id,
      });

      // 4. Reset reference view region
      setRenderRegion({
        x: { min: -50, max: 50 },
        y: { min: -50, max: 50 },
        z: { min: -50, max: 50 },
      });

      setStatusFeedback(null);
    },
    [getRecordForRestore, isBusy, isInitializing, cancel],
  );

  // Delete a history record
  const handleDeleteRecord = useCallback(
    async (id: string) => {
      await deleteHistoryRecord(id);
      // If deleted record is currently displayed, disconnect savedRecordId (Section 10)
      setSubmittedCalc((prev) => (prev.savedRecordId === id ? { ...prev, savedRecordId: null } : prev));
    },
    [deleteHistoryRecord],
  );

  // Clear all history
  const handleClearAllHistory = useCallback(async () => {
    await clearAllHistory();
    setSubmittedCalc((prev) => ({ ...prev, savedRecordId: null }));
    setStatusFeedback({
      type: 'info',
      message: t.errors.historyCleared,
    });
  }, [clearAllHistory, t.errors.historyCleared]);

  return (
    <div className="app-container">
      {/* Sidebar Controls */}
      <aside className="sidebar" aria-label={lang === 'es' ? 'Entradas de ecuaciones y configuración' : 'Equation Inputs and Calculation Settings'}>
        <div className="sidebar-content">
          <Header
            lang={lang}
            onLanguageChange={handleLanguageChange}
            theme={themePref}
            onThemeChange={setThemePref}
            onOpenHistory={() => setIsHistoryDrawerOpen(true)}
            historyTriggerRef={historyTriggerRef}
            historyCount={historySummaries.length}
            canInstall={canInstall}
            onInstall={() => pwaManager.promptInstall()}
          />

          {/* Surface F Equation Field */}
          <EquationInputSection
            ref={surfaceFRef}
            id="surface-f-input"
            label={t.inputs.surfaceF}
            value={surfaceF}
            onChange={(val) => {
              setSurfaceF(val);
              setFDiagnostic(null);
            }}
            onSubmit={handleImmediateCalculate}
            placeholder={t.inputs.placeholderF}
            diagnostic={fDiagnostic}
            lang={lang}
          />

          {/* Surface G Equation Field */}
          <EquationInputSection
            ref={surfaceGRef}
            id="surface-g-input"
            label={t.inputs.surfaceG}
            value={surfaceG}
            onChange={(val) => {
              setSurfaceG(val);
              setGDiagnostic(null);
            }}
            onSubmit={handleImmediateCalculate}
            placeholder={t.inputs.placeholderG}
            diagnostic={gDiagnostic}
            lang={lang}
          />

          {/* Traversal Orientation Control */}
          <DirectionToggle
            direction={direction}
            onChange={handleDirectionChange}
            disabled={isBusy}
            lang={lang}
          />

          {/* Automatic calculation indicator & Cancel Button */}
          {(isBusy || isInitializing) && (
            <div className="calculation-actions" role="status" aria-live="polite">
              <div className="auto-calculating-indicator">
                <span className="spinner-dot" aria-hidden="true" />
                <span className="auto-calculating-text">
                  {isInitializing
                    ? runtimeStage === 'loading-packages'
                      ? t.inputs.loadingSymPy
                      : t.inputs.loadingPyodide
                    : t.inputs.autoCalculating}
                </span>
              </div>
              <button
                type="button"
                id="cancel-calculation-btn"
                className="cancel-btn"
                onClick={() => cancel('User cancelled calculation')}
                aria-label={t.inputs.cancel}
              >
                {t.inputs.cancel}
              </button>
            </div>
          )}

          {/* Status and Feedback Box */}
          {statusFeedback && (
            <div
              className="v1-status-box"
              role="status"
              aria-live="polite"
              style={{
                borderColor:
                  statusFeedback.type === 'error'
                    ? '#f87171'
                    : statusFeedback.type === 'success'
                      ? '#4ade80'
                      : 'rgba(91, 142, 199, 0.4)',
              }}
            >
              {statusFeedback.type === 'error' ? (
                <strong style={{ color: '#f87171' }}>{t.errors.errorLabel}</strong>
              ) : statusFeedback.type === 'success' ? (
                <strong style={{ color: '#4ade80' }}>{t.errors.successLabel}</strong>
              ) : (
                <strong style={{ color: '#7eb3ea' }}>{t.errors.statusLabel}</strong>
              )}
              {statusFeedback.message}
              {runtimeState === 'failed' && (
                <button
                  type="button"
                  className="retry-btn"
                  onClick={() => retry()}
                  aria-label={t.errors.retryRuntime}
                >
                  {t.errors.retryRuntime}
                </button>
              )}
            </div>
          )}

          {/* Calculation Result Presentation */}
          <ResultSection
            result={displayedCalculationResult}
            calculationId={submittedCalc.calculationId}
            curveColor={activeCurveColor}
            onCurveColorChange={handleCurveColorChange}
            onPreviewCurveColor={handlePreviewCurveColor}
            isExample={submittedCalc.isExample}
            isDraftDirty={isDraftDirty}
            submittedEquations={{
              surfaceF: submittedCalc.surfaceF,
              surfaceG: submittedCalc.surfaceG,
            }}
            lang={lang}
          />

          {/* Load Reference Example Helper */}
          <div className="example-loader-bar">
            <button
              type="button"
              className="example-link-btn"
              onClick={handleLoadExample}
              title={t.inputs.loadExample}
            >
              {t.inputs.loadExample}
            </button>
          </div>
          <footer className="app-credits" aria-label={t.credits.label}>
            <p>{t.credits.creator} Angel Joseph Estrada Santos (@juxdeveloper)</p>
            <p>{t.credits.collaborator}: Hanniel Cardoso Jaramillo (@HannDev2)</p>
          </footer>
        </div>
      </aside>

      {/* 3D Viewport Graph Region */}
      <GraphViewport
        surfaceFText={debouncedSurfaceF}
        surfaceGText={debouncedSurfaceG}
        curveColor={activeCurveColor}
        geometryResult={geometryResult}
        isGeometryGenerating={isGeometryGenerating}
        onRegionChange={setRenderRegion}
        quality={geometryQuality}
        onQualityChange={setGeometryQuality}
        lang={lang}
        theme={effectiveTheme}
      />

      {/* Local History Drawer (Phase V10) */}
      <HistoryDrawer
        isOpen={isHistoryDrawerOpen}
        onClose={() => setIsHistoryDrawerOpen(false)}
        summaries={historySummaries}
        activeRecordId={activeRecordId}
        status={historyStatus}
        notice={historyNotice}
        onSelectRecord={handleRestoreRecord}
        onDeleteRecord={handleDeleteRecord}
        onClearAll={handleClearAllHistory}
        onClearNotice={clearHistoryNotice}
        triggerRef={historyTriggerRef}
        lang={lang}
      />
    </div>
  );
};
