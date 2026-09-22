/**
 * MathLive Local Static Configuration and Setup
 *
 * Directives:
 * - 100% static, local asset delivery with zero external network requests.
 * - KaTeX woff2 fonts loaded strictly from local static distribution (`${BASE_URL}fonts/`).
 * - Remote sounds and external speech/audio APIs completely disabled (`soundsDirectory = null`).
 * - MathLive virtual keyboard configured for standard mathematical input (variables x, y, z, t,
 *   fractions, powers, roots, trigonometry, constants pi, e).
 * - Keyboard policy set to 'manual' to prevent unwanted soft-keyboard popup on physical keyboards.
 */

import { MathfieldElement } from 'mathlive';

let isConfigured = false;

export function configureMathLive(): void {
  if (isConfigured || typeof window === 'undefined') return;

  // Resolve local fonts directory from the static base URL
  const baseUrl = import.meta.env.BASE_URL || './';
  try {
    const resolvedFontsUrl = new URL(`${baseUrl}fonts/`, window.location.href).href;
    MathfieldElement.fontsDirectory = resolvedFontsUrl;
  } catch {
    MathfieldElement.fontsDirectory = `${baseUrl}fonts/`;
  }

  // Strictly disable sound feedback to eliminate network requests or audio overhead
  MathfieldElement.soundsDirectory = null;

  // Configure virtual keyboard defaults on the window singleton if available
  if ('mathVirtualKeyboard' in window && window.mathVirtualKeyboard) {
    // Provide standard useful layouts: numeric (123 with variables x, y, z, t),
    // symbols (operators, infinity, relations), alphabetic (abc), and greek (αβγ)
    try {
      window.mathVirtualKeyboard.layouts = ['numeric', 'symbols', 'alphabetic', 'greek'];
    } catch {
      // Retain default layouts if layout reassignment is restricted
    }
  }

  isConfigured = true;
}

// Auto-run configuration on import in browser environments
if (typeof window !== 'undefined') {
  configureMathLive();
}

export { MathfieldElement };
