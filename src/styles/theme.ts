/**
 * Theme management for Intersect.
 *
 * Requirements:
 * - Options: 'auto' | 'light' | 'dark'
 * - 'auto' is the initial default, following system prefers-color-scheme.
 * - Explicit user selection persists in localStorage.
 * - Dynamic listener for system scheme changes when 'auto' is active.
 * - Sets data-theme attribute on document.documentElement.
 */

export type ThemePreference = 'auto' | 'light' | 'dark';
export type EffectiveTheme = 'light' | 'dark';

const THEME_STORAGE_KEY = 'intersect_theme';

export function getInitialThemePreference(): ThemePreference {
  if (typeof window === 'undefined') return 'auto';
  try {
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    if (saved === 'auto' || saved === 'light' || saved === 'dark') {
      return saved;
    }
  } catch {
    // Ignore storage failure
  }
  return 'auto';
}

export function getSystemTheme(): EffectiveTheme {
  if (typeof window === 'undefined') return 'dark';
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

export function resolveEffectiveTheme(pref: ThemePreference): EffectiveTheme {
  if (pref === 'auto') {
    return getSystemTheme();
  }
  return pref;
}

export function applyTheme(pref: ThemePreference): EffectiveTheme {
  const effective = resolveEffectiveTheme(pref);
  if (typeof document !== 'undefined') {
    document.documentElement.setAttribute('data-theme', effective);
    document.documentElement.setAttribute('data-theme-preference', pref);
  }
  return effective;
}

export function saveThemePreference(pref: ThemePreference): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(THEME_STORAGE_KEY, pref);
  } catch {
    // Storage unavailable
  }
  applyTheme(pref);
}
