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

/**
 * Localizes solver derivation step titles.
 */
export function getLocalizedStepTitle(title: string, lang: SupportedLanguage): string {
  if (lang === 'en') return title;

  const map: Record<string, string> = {
    'State surface equations and domain restrictions': 'Ecuaciones de las superficies y restricciones de dominio',
    'State planar surface equations': 'Ecuaciones de las superficies planas',
    'Compute plane normal vectors and cross product direction': 'Calcular vectores normales de los planos y dirección del producto vectorial',
    'Find particular point and parameterize line': 'Hallar punto particular y parametrizar la recta',
    'Establish parameter domain and bounding box': 'Establecer dominio del parámetro y límites de cálculo',
    'Establish parameter domain and bounding box check': 'Establecer el dominio del parámetro y límites de cálculo',
    'Establish parameter domain and calculation bounds': 'Establecer dominio del parámetro y límites de cálculo',
    'Establish parameter domain': 'Establecer el dominio del parámetro',
    'Verify algebraic surface membership': 'Verificar pertenencia algebraica a las superficies',
    'Verify algebraic surface membership and result scope': 'Verificar pertenencia algebraica a las superficies y alcance del resultado',
    'Result scope and component coverage': 'Alcance del resultado y cobertura de componentes',
    'State surface equations and planar reduction': 'Ecuaciones de superficies y reducción planar',
    'Project center onto cutting plane to find circle center and radius': 'Proyectar centro sobre el plano de corte para hallar centro y radio de la circunferencia',
    'Construct exact orthonormal basis in the cutting plane': 'Construir base ortonormal exacta en el plano de corte',
    'Parameterize intersection circle coordinates': 'Parametrizar coordenadas de la circunferencia de intersección',
    'Parameterize circular cylinder cross-section': 'Parametrizar la sección transversal del cilindro',
    'Substitute into planar surface G': 'Sustituir en la superficie plana G',
    'Eliminate shared quadratic parts': 'Eliminar partes cuadráticas compartidas',
    'Verify global coverage': 'Verificar cobertura global',
    'Reparameterize for reverse traversal': 'Reparametrizar para recorrido en sentido inverso',
    'Plane-Plane Intersection Line': 'Recta de intersección plano-plano',
    'Eliminate dependent coordinate': 'Eliminar coordenada dependiente',
    'Express in parametric vector form': 'Expresar en forma vectorial paramétrica',
    'Quadric reduction': 'Reducción cuadrática',
    'Direct substitution': 'Sustitución directa',
    'Cylindrical Projection & Linear Substitution': 'Proyección cilíndrica y sustitución lineal',
    'Result scope': 'Alcance del resultado',
  };

  if (map[title]) return map[title];

  // Dynamic template matching
  if (title.startsWith('State equations and identify cylinder cross-section in ')) {
    const plane = title.replace('State equations and identify cylinder cross-section in ', '');
    return `Plantear ecuaciones e identificar sección transversal del cilindro en el plano ${plane}`;
  }
  if (title.startsWith('Parameterize elliptic cross-section in ')) {
    const plane = title.replace('Parameterize elliptic cross-section in ', '');
    return `Parametrizar sección transversal elíptica en el plano ${plane}`;
  }
  if (title.startsWith('Substitute parameterized coordinates into planar surface to solve for ')) {
    const variable = title.replace('Substitute parameterized coordinates into planar surface to solve for ', '');
    return `Sustituir coordenadas parametrizadas en la superficie plana para despejar ${variable}`;
  }
  if (title.startsWith('Substitute parameterized coordinates into surface to solve for ')) {
    const variable = title.replace('Substitute parameterized coordinates into surface to solve for ', '');
    return `Sustituir coordenadas parametrizadas en la superficie para despejar ${variable}`;
  }
  if (title.startsWith('State equations and assign spatial coordinate ')) {
    const rest = title.replace('State equations and assign spatial coordinate ', '');
    return `Plantear ecuaciones y asignar coordenada espacial ${rest}`;
  }
  if (title.includes('Solve remaining coordinates in terms of parameter t')) {
    return 'Resolver coordenadas restantes en función del parámetro t';
  }

  return title;
}

/**
 * Localizes solver derivation step explanations.
 */
export function getLocalizedStepExplanation(explanation: string, lang: SupportedLanguage): string {
  if (lang === 'en') return explanation;

  const map: Record<string, string> = {
    'Surface F is a circular cylinder of radius 2 parallel to the z-axis. Surface G is an affine plane.':
      'La Superficie F es un cilindro circular de radio 2 paralelo al eje z. La Superficie G es un plano afín.',
    'The projection onto the xy-plane is a circle of radius 2. Choose canonical parameter t ∈ [0, 2π).':
      'La proyección sobre el plano xy es una circunferencia de radio 2. Se elige el parámetro canónico t ∈ [0, 2π).',
    'Surface G defines z explicitly as x + y. Directly evaluate along the parameterized x(t) and y(t).':
      'La Superficie G define z explícitamente como x + y. Se evalúa directamente a lo largo de x(t) e y(t).',
    'The curve is completely contained within the calculation bounds [-1000, 1000]³.':
      'La curva está contenida completamente dentro de los límites de cálculo [-1000, 1000]³.',
    'Both surface equations are identically satisfied for all real t in [0, 2π).':
      'Ambas ecuaciones se satisfacen idénticamente para todo t real en [0, 2π).',
    'Single closed smooth elliptic component formed by the planar section of the cylinder.':
      'Componente elíptica suave y cerrada formada por la sección plana del cilindro.',
    'Finite reflection t = 2π - u traverses the closed ellipse in reverse with parameter u ∈ (0, 2π] while preserving identical geometry and algebraic validity.':
      'La reflexión finita t = 2π - u recorre la elipse cerrada en sentido inverso con parámetro u ∈ (0, 2π], preservando la geometría e identidades algebraicas.',
    'Two distinct non-parallel planes in three-dimensional space intersect along a one-dimensional straight line.':
      'Dos planos distintos no paralelos en el espacio tridimensional se cortan a lo largo de una recta unidimensional.',
    'The line of intersection is orthogonal to both surface normal vectors, given by their vector cross product n1 x n2.':
      'La recta de intersección es ortogonal a ambos vectores normales, dada por su producto vectorial n1 x n2.',
    'Setting one coordinate to zero determines a particular point p0 common to both planes.':
      'Fijar una coordenada en cero determina un punto particular p0 común a ambos planos.',
    'Intersecting the infinite straight line with calculation bounds [-1000, 1000]^3 establishes the bounded parameter domain.':
      'Intersecar la recta infinita con los límites de cálculo [-1000, 1000]³ establece el dominio acotado del parámetro.',
    'Substituting r(t) into both plane equations satisfies both linear equalities identically.':
      'Sustituir r(t) en ambas ecuaciones de los planos satisface ambas igualdades lineales idénticamente.',
    'Extracted sphere center and radius by completing the square, intersected by the cutting plane.':
      'Se extrajeron el centro y radio de la esfera completando cuadrados, intersecados por el plano de corte.',
    'Two orthogonal unit vectors spanning the cutting plane are constructed via cross products.':
      'Se construyen dos vectores unitarios ortogonales que generan el plano de corte mediante productos vectoriales.',
    'Trigonometric circle parameterization along the orthonormal planar basis.':
      'Parametrización trigonométrica de la circunferencia a lo largo de la base ortonormal del plano.',
    'The parameter t spans one complete period [0, 2*pi) tracing the full closed circular loop once.':
      'El parámetro t abarca un periodo completo [0, 2π) recorriendo la circunferencia cerrada una vez.',
    'The parameter t spans one complete fundamental period [0, 2*pi) tracing the full closed elliptical loop once.':
      'El parámetro t abarca un periodo fundamental completo [0, 2π) recorriendo la elipse cerrada una vez.',
    'Both original surface equations are verified algebraically to hold identically across the parameter domain.':
      'Se verifica algebraicamente que ambas ecuaciones de superficie se satisfacen idénticamente en el dominio del parámetro.',
    'Subtracting the proportional quadratic terms eliminates degree-2 terms, yielding a planar cross-section (radical cutting plane).':
      'Restar los términos cuadráticos proporcionales elimina los términos de segundo grado, generando una sección transversal plana (plano radical).',
    'Algebraically solved the system for remaining coordinates.':
      'Se resolvió algebraicamente el sistema para las coordenadas restantes.',
    'Enforcing calculation bounds [-1000, 1000]^3 and excluding any algebraic singularities or non-real intervals.':
      'Se aplican los límites de cálculo [-1000, 1000]³ y se excluyen singularidades algebraicas o intervalos no reales.',
    'Both original surface equations are verified algebraically to simplify identically to zero.':
      'Se verifica algebraicamente que ambas ecuaciones originales de las superficies se simplifican idénticamente a cero.',
    'Verified complete global coverage without branch omission or sign-constrained loss.':
      'Se verificó la cobertura global completa sin omisión de ramas ni pérdida por restricciones de signo.',
  };

  if (map[explanation]) return map[explanation];

  // Dynamic templates
  if (explanation.startsWith('Applied orientation reversal via exact substitution ')) {
    return 'Se aplicó inversión de orientación mediante sustitución exacta. El dominio del parámetro se transformó correspondientemente, invirtiendo el sentido y preservando la geometría y pertenencia algebraica.';
  }
  if (explanation.startsWith('The cross-section along the ')) {
    return explanation
      .replace('The cross-section along the ', 'La sección transversal en el plano ')
      .replace(' is an ellipse with semi-axes ', ' es una elipse con semiejes ');
  }
  if (explanation.startsWith('Trigonometric parameterization of the elliptic cross section with parameter t in [0, 2*pi)')) {
    return 'Parametrización trigonométrica de la sección elíptica con parámetro t en [0, 2π).';
  }
  if (explanation.startsWith('Evaluating the surface relation along ')) {
    return 'Al evaluar la relación de la superficie a lo largo de las coordenadas parametrizadas se obtiene una fórmula explícita para la coordenada restante.';
  }
  if (explanation.startsWith('Selected spatial coordinate ')) {
    return explanation
      .replace('Selected spatial coordinate ', 'Se seleccionó la coordenada espacial ')
      .replace(' as the curve parameter variable t.', ' como variable de parámetro t de la curva.');
  }
  if (explanation.startsWith('Established result coverage: ')) {
    const scope = explanation.replace('Established result coverage: ', '').replace(/\.$/, '');
    return `Cobertura establecida del resultado: ${getLocalizedScope(scope, lang)}.`;
  }
  if (explanation.includes('Both original surface equations are verified algebraically to hold identically across the parameter domain. Established scope:')) {
    return 'Ambas ecuaciones originales de superficie se verifican algebraicamente como satisfechas en todo el dominio del parámetro.';
  }

  return explanation;
}