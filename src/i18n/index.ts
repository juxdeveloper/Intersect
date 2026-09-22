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

export const translations: Record<SupportedLanguage, Translations> = {
  es: {
    credits: {
      label: 'Créditos',
      creator: 'Creado y desarrollado por',
      collaborator: 'Colaborador',
    },
    app: {
      title: 'Intersect',
      subtitle: 'Intersección de superficies',
      offlineReady: 'Disponible sin conexión',
      offlinePreparing: 'Preparando modo sin conexión...',
      offlineError: 'Error al preparar sin conexión',
    },
    header: {
      history: 'Historial',
      themeAuto: 'Tema automático',
      themeLight: 'Tema claro',
      themeDark: 'Tema oscuro',
      themeLabelAuto: 'Auto',
      themeLabelLight: 'Claro',
      themeLabelDark: 'Oscuro',
      langEs: 'Español',
      langEn: 'Inglés',
      langToggleTitle: 'Cambiar a inglés',
      langToggleAria: 'Cambiar a inglés',
      installApp: 'Instalar aplicación',
    },
    inputs: {
      surfaceF: 'Superficie F',
      surfaceG: 'Superficie G',
      placeholderF: 'Ej: x^2 + y^2 = 4',
      placeholderG: 'Ej: z = x + y',
      openKeyboard: 'Abrir teclado matemático',
      closeKeyboard: 'Cerrar teclado matemático',
      openKeyboardTitle: 'Abrir teclado virtual',
      closeKeyboardTitle: 'Ocultar teclado virtual',
      mathEquationAria: 'Ecuación matemática para',
      calculate: 'Calcular',
      calculating: 'Calculando...',
      cancel: 'Cancelar',
      loadExample: 'Restablecer al ejemplo de referencia (x² + y² = 4 & z = x + y)',
      loadingSymPy: 'Cargando SymPy...',
      loadingPyodide: 'Cargando Pyodide...',
      solving: 'Resolviendo...',
      initializingAndSolving: 'Inicializando Pyodide y resolviendo...',
      solvingExact: 'Resolviendo intersección simbólica exacta...',
      cancelled: 'Cálculo cancelado.',
      autoCalculating: 'Calculando automáticamente...',
      autoCalculated: 'Cálculo actualizado.',
    },
    orientation: {
      title: 'Orientación',
      forward: 'Anversa',
      reverse: 'Reversa',
      forwardHint: 'Parámetro t creciente (+t dirección canónica)',
      reverseHint: 'Parámetro t decreciente (-t dirección invertida)',
    },
    viewport: {
      replay: 'Reproducir',
      pause: 'Pausa',
      resume: 'Continuar',
      pauseTitle: 'Pausa (Espacio)',
      resumeTitle: 'Continuar (Espacio)',
      replayTitle: 'Reproducir (Espacio)',
      resetViewTitle: 'Restablecer vista (R)',
      detail: 'Detalle',
      detailLow: 'Bajo',
      detailMedium: 'Medio',
      detailHigh: 'Alto',
      detailStandard: 'Medio',
      detailUltra: 'Alto',
      resetView: 'Restablecer vista',
      legendF: 'Superficie F',
      legendG: 'Superficie G',
      legendCurve: 'Curva de intersección',
      legendAria: 'Leyenda del gráfico',
      orbitHint: 'Arrastrar para rotar • Mayús+arrastrar para desplazar • Rueda para zoom',
      generatingGeometry: 'Generando geometría 3D...',
      webglNotSupported: 'WebGL no compatible',
      webglRequired: 'Se requiere WebGL para la visualización 3D.',
    },
    curve: {
      yourCurve: 'Tu curva',
      editColor: 'Editar color de la curva',
      closedCurve: 'Curva cerrada',
      openArc: 'Arco abierto',
      colorPickerTitle: 'Color de la curva',
      presetColors: 'Colores predefinidos',
      hexColorLabel: 'Color hexadecimal',
      hexError: 'Debe ser #RRGGBB',
      apply: 'Aplicar',
      cancel: 'Cancelar',
      closeEsc: 'Cerrar (Esc)',
      activePreview: 'Vista previa activa:',
      swatchColorAria: 'Color de muestra',
    },
    results: {
      title: 'Resultado',
      noIntersection: 'No existe intersección en la región delimitada',
      inconclusive: 'No se pudo determinar la intersección exacta en los límites dados',
      isolatedPoint: 'Punto aislado degenerado',
      tangentPoint: 'El plano es tangente a la superficie en un punto aislado.',
      viewDerivation: 'Ver procedimiento',
      hideDerivation: 'Ocultar procedimiento',
      derivationCollapsed: 'Ver procedimiento',
      derivationExpanded: 'Ocultar procedimiento',
      step: 'Paso',
      scope: 'Alcance',
      draftEdited: 'Borrador editado • El resultado refleja las ecuaciones calculadas',
      globalProof: 'Demostración global en ℝ³',
      boundedRegion: 'Región delimitada [-1000, 1000]³',
      proofScopeGlobal: 'Prueba global',
      proofScopeBounded: 'Región acotada [-1000, 1000]³',
    },
    history: {
      title: 'Historial de cálculos',
      empty: 'No hay cálculos guardados aún.',
      emptySubtitle: 'Los cálculos y resultados verificados se guardan automáticamente en tu navegador.',
      restore: 'Restaurar',
      delete: 'Eliminar',
      clearAll: 'Borrar todo',
      confirmClear: '¿Confirmar?',
      confirmTitle: 'Haz clic para confirmar el borrado',
      closeAria: 'Cerrar historial',
      closeTitle: 'Cerrar historial',
      justNow: 'Ahora mismo',
      degradedNotice: 'Historial solo de sesión: IndexedDB no está disponible.',
      blockedNotice: 'Almacenamiento bloqueado temporalmente por otra pestaña.',
      dismissNotice: 'Descartar aviso',
      badgeVerified: 'Verificado',
      badgeEmpty: 'Vacío',
      badgeDegenerate: 'Degenerado',
      badgeInconclusive: 'No concluyente',
      badgeCorrupt: 'Dañado',
      badgeIncompatible: 'Incompatible',
      badgeActive: 'Activo',
      badgeRev: 'Rev',
      badgeFwd: 'Anv',
      clickToReopen: 'Haz clic para reabrir el cálculo',
      deleteThisRecord: 'Eliminar este registro',
      openCalcPrefix: 'Abrir cálculo:',
      curveColorSaved: 'Color guardado de la curva:',
      curveColorAria: 'Color de curva',
      deleteCalcPrefix: 'Eliminar cálculo',
    },
    errors: {
      emptyEquation: 'Por favor, ingresa una ecuación para ambas superficies.',
      syntaxError: 'Error de sintaxis matemática. Revisa los términos y signos.',
      solverFailed: 'El motor algebraico no pudo resolver la intersección exacta.',
      restoreFailed: 'No se pudo restaurar el registro de cálculo: registro no encontrado o dañado.',
      historyCleared: 'Historial de cálculos borrado.',
      retryRuntime: 'Reintentar entorno',
      errorLabel: 'Error: ',
      statusLabel: 'Estado: ',
      successLabel: 'Éxito: ',
      runtimeError: 'Error de ejecución: ',
      calculationOutcome: 'Resultado del cálculo: ',
    },
  },
  en: {
    credits: {
      label: 'Credits',
      creator: 'Created & Developed by',
      collaborator: 'Collaborator',
    },
    app: {
      title: 'Intersect',
      subtitle: 'Surface intersection',
      offlineReady: 'Available offline',
      offlinePreparing: 'Preparing offline mode...',
      offlineError: 'Failed to prepare offline',
    },
    header: {
      history: 'History',
      themeAuto: 'Auto theme',
      themeLight: 'Light theme',
      themeDark: 'Dark theme',
      themeLabelAuto: 'Auto',
      themeLabelLight: 'Light',
      themeLabelDark: 'Dark',
      langEs: 'Spanish',
      langEn: 'English',
      langToggleTitle: 'Switch to Spanish',
      langToggleAria: 'Switch to Spanish',
      installApp: 'Install app',
    },
    inputs: {
      surfaceF: 'Surface F',
      surfaceG: 'Surface G',
      placeholderF: 'e.g. x^2 + y^2 = 4',
      placeholderG: 'e.g. z = x + y',
      openKeyboard: 'Open math keyboard',
      closeKeyboard: 'Close math keyboard',
      openKeyboardTitle: 'Open virtual keyboard',
      closeKeyboardTitle: 'Hide virtual keyboard',
      mathEquationAria: 'Mathematical equation for',
      calculate: 'Calculate',
      calculating: 'Calculating...',
      cancel: 'Cancel',
      loadExample: 'Reset to reference example (x² + y² = 4 & z = x + y)',
      loadingSymPy: 'Loading SymPy...',
      loadingPyodide: 'Loading Pyodide...',
      solving: 'Solving...',
      initializingAndSolving: 'Initializing Pyodide and solving...',
      solvingExact: 'Solving exact symbolic intersection in Pyodide/SymPy Web Worker...',
      cancelled: 'Calculation was cancelled.',
      autoCalculating: 'Calculating automatically...',
      autoCalculated: 'Calculation updated.',
    },
    orientation: {
      title: 'Orientation',
      forward: 'Forward',
      reverse: 'Reverse',
      forwardHint: 'Increasing parameter traversal (+t canonical direction)',
      reverseHint: 'Decreasing parameter traversal (-t reversed direction)',
    },
    viewport: {
      replay: 'Replay',
      pause: 'Pause',
      resume: 'Resume',
      pauseTitle: 'Pause (Space)',
      resumeTitle: 'Resume (Space)',
      replayTitle: 'Replay (Space)',
      resetViewTitle: 'Reset view (R)',
      detail: 'Detail',
      detailLow: 'Low',
      detailMedium: 'Medium',
      detailHigh: 'High',
      detailStandard: 'Medium',
      detailUltra: 'High',
      resetView: 'Reset view',
      legendF: 'Surface F',
      legendG: 'Surface G',
      legendCurve: 'Intersection curve',
      legendAria: 'Graph legend',
      orbitHint: 'Drag to orbit • Shift+drag to pan • Scroll to zoom',
      generatingGeometry: 'Generating 3D geometry...',
      webglNotSupported: 'WebGL Not Supported',
      webglRequired: 'WebGL is required for 3D visualization.',
    },
    curve: {
      yourCurve: 'Your curve',
      editColor: 'Edit curve color',
      closedCurve: 'Closed curve',
      openArc: 'Open arc',
      colorPickerTitle: 'Curve Color',
      presetColors: 'Preset colors',
      hexColorLabel: 'Hexadecimal Color',
      hexError: 'Must be #RRGGBB',
      apply: 'Apply',
      cancel: 'Cancel',
      closeEsc: 'Close (Esc)',
      activePreview: 'Active preview:',
      swatchColorAria: 'Color swatch',
    },
    results: {
      title: 'Intersection Result',
      noIntersection: 'No real intersection exists in the bounded region',
      inconclusive: 'Could not determine exact intersection within the specified bounds',
      isolatedPoint: 'Degenerate isolated point',
      tangentPoint: 'The plane is tangent to the surface at a single isolated point.',
      viewDerivation: 'View procedure',
      hideDerivation: 'Hide procedure',
      derivationCollapsed: 'View procedure',
      derivationExpanded: 'Hide procedure',
      step: 'Step',
      scope: 'Scope',
      draftEdited: 'Draft edited • Result reflects calculated equations',
      globalProof: 'Global proof in ℝ³',
      boundedRegion: 'Bounded region [-1000, 1000]³',
      proofScopeGlobal: 'Global proof',
      proofScopeBounded: 'Bounded region [-1000, 1000]³',
    },
    history: {
      title: 'Calculation History',
      empty: 'No saved calculations yet.',
      emptySubtitle: 'Submitted calculations and verified outcomes are saved automatically to your browser’s local database.',
      restore: 'Restore',
      delete: 'Delete',
      clearAll: 'Clear all',
      confirmClear: 'Confirm Clear?',
      confirmTitle: 'Click again to confirm clear',
      closeAria: 'Close history drawer',
      closeTitle: 'Close history',
      justNow: 'Just now',
      degradedNotice: 'Session-only history: browser IndexedDB is unavailable or restricted.',
      blockedNotice: 'Storage temporarily blocked by another open tab.',
      dismissNotice: 'Dismiss notice',
      badgeVerified: 'Verified',
      badgeEmpty: 'Empty',
      badgeDegenerate: 'Degenerate',
      badgeInconclusive: 'Inconclusive',
      badgeCorrupt: 'Corrupt',
      badgeIncompatible: 'Incompatible',
      badgeActive: 'Active',
      badgeRev: 'Rev',
      badgeFwd: 'Fwd',
      clickToReopen: 'Click to reopen calculation',
      deleteThisRecord: 'Delete this record',
      openCalcPrefix: 'Open calculation:',
      curveColorSaved: 'Saved curve color:',
      curveColorAria: 'Curve color',
      deleteCalcPrefix: 'Delete calculation',
    },
    errors: {
      emptyEquation: 'Please enter an equation for both surfaces.',
      syntaxError: 'Mathematical syntax error. Check terms and symbols.',
      solverFailed: 'Algebraic solver was unable to solve the exact intersection.',
      restoreFailed: 'Could not restore calculation record: record not found or corrupted.',
      historyCleared: 'Calculation history cleared.',
      retryRuntime: 'Retry Runtime',
      errorLabel: 'Error: ',
      statusLabel: 'Status: ',
      successLabel: 'Success: ',
      runtimeError: 'Runtime error: ',
      calculationOutcome: 'Calculation outcome: ',
    },
  },
};