/**
 * Localization dictionary and management for Intersect.
 *
 * Requirements:
 * - Default language: Spanish ('es'), with English ('en') toggle.
 * - Spanish applies on first visit regardless of browser language.
 * - User selection persisted in localStorage ('intersect_lang').
 * - Keyed translation messages with structured interpolation.
 * - Complete localization: 0% mixed language state across all UI, derivations, messages, and statuses.
 */

export type SupportedLanguage = 'es' | 'en';

export interface Translations {
  credits: {
    label: string;
    creator: string;
    collaborator: string;
  };
  app: {
    title: string;
    subtitle: string;
    offlineReady: string;
    offlinePreparing: string;
    offlineError: string;
  };
  header: {
    history: string;
    themeAuto: string;
    themeLight: string;
    themeDark: string;
    themeLabelAuto: string;
    themeLabelLight: string;
    themeLabelDark: string;
    langEs: string;
    langEn: string;
    langToggleTitle: string;
    langToggleAria: string;
    installApp: string;
  };
  inputs: {
    surfaceF: string;
    surfaceG: string;
    placeholderF: string;
    placeholderG: string;
    openKeyboard: string;
    closeKeyboard: string;
    openKeyboardTitle: string;
    closeKeyboardTitle: string;
    mathEquationAria: string;
    calculate: string;
    calculating: string;
    cancel: string;
    loadExample: string;
    loadingSymPy: string;
    loadingPyodide: string;
    solving: string;
    initializingAndSolving: string;
    solvingExact: string;
    cancelled: string;
    autoCalculating: string;
    autoCalculated: string;
  };
  orientation: {
    title: string;
    forward: string;
    reverse: string;
    forwardHint: string;
    reverseHint: string;
  };
  viewport: {
    replay: string;
    pause: string;
    resume: string;
    pauseTitle: string;
    resumeTitle: string;
    replayTitle: string;
    resetViewTitle: string;
    detail: string;
    detailLow: string;
    detailMedium: string;
    detailHigh: string;
    detailStandard: string;
    detailUltra: string;
    resetView: string;
    legendF: string;
    legendG: string;
    legendCurve: string;
    legendAria: string;
    orbitHint: string;
    generatingGeometry: string;
    webglNotSupported: string;
    webglRequired: string;
  };
  curve: {
    yourCurve: string;
    editColor: string;
    closedCurve: string;
    openArc: string;
    colorPickerTitle: string;
    presetColors: string;
    hexColorLabel: string;
    hexError: string;
    apply: string;
    cancel: string;
    closeEsc: string;
    activePreview: string;
    swatchColorAria: string;
  };
  results: {
    title: string;
    noIntersection: string;
    inconclusive: string;
    isolatedPoint: string;
    tangentPoint: string;
    viewDerivation: string;
    hideDerivation: string;
    derivationCollapsed: string;
    derivationExpanded: string;
    step: string;
    scope: string;
    draftEdited: string;
    globalProof: string;
    boundedRegion: string;
    proofScopeGlobal: string;
    proofScopeBounded: string;
  };
  history: {
    title: string;
    empty: string;
    emptySubtitle: string;
    restore: string;
    delete: string;
    clearAll: string;
    confirmClear: string;
    confirmTitle: string;
    closeAria: string;
    closeTitle: string;
    justNow: string;
    degradedNotice: string;
    blockedNotice: string;
    dismissNotice: string;
    badgeVerified: string;
    badgeEmpty: string;
    badgeDegenerate: string;
    badgeInconclusive: string;
    badgeCorrupt: string;
    badgeIncompatible: string;
    badgeActive: string;
    badgeRev: string;
    badgeFwd: string;
    clickToReopen: string;
    deleteThisRecord: string;
    openCalcPrefix: string;
    curveColorSaved: string;
    curveColorAria: string;
    deleteCalcPrefix: string;
  };
  errors: {
    emptyEquation: string;
    syntaxError: string;
    solverFailed: string;
    restoreFailed: string;
    historyCleared: string;
    retryRuntime: string;
    errorLabel: string;
    statusLabel: string;
    successLabel: string;
    runtimeError: string;
    calculationOutcome: string;
  };
}