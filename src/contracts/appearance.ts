/**
 * Appearance and Color Contracts for Intersect (Phase V9).
 *
 * Requirements:
 * 1. Single active curve color customization with serializable hex format (#RRGGBB).
 * 2. Curated finite palette for distinct calculations contrasting with dark background (#08090d),
 *    surface F (#5b8ec7), and surface G (#8f94a0).
 * 3. Deterministic sequence for default colors across new calculations.
 * 4. Hex validation and normalization routines.
 */

export const DEFAULT_CURVE_PALETTE_COLOR = '#f5eedb'; // Warm off-white (Reference)

/**
 * Curated finite palette of perceptually distinct, high-contrast colors
 * calibrated for Intersect's near-black dark mode (#08090d).
 */
export const CURVE_PALETTE: readonly string[] = [
  '#f5eedb', // 0: Warm off-white (Reference Default)
  '#fbbf24', // 1: Amber Gold
  '#34d399', // 2: Emerald Mint
  '#fb7185', // 3: Coral Rose
  '#38bdf8', // 4: Sky Cyan
  '#c084fc', // 5: Lavender Violet
  '#fb923c', // 6: Tangerine Orange
  '#e879f9', // 7: Orchid Magenta
] as const;

/**
 * Deterministic color allocator across distinct calculations.
 */
export function getNextDefaultCurveColor(calculationIndex: number): string {
  const safeIndex = Math.max(0, Math.floor(calculationIndex));
  return CURVE_PALETTE[safeIndex % CURVE_PALETTE.length] ?? DEFAULT_CURVE_PALETTE_COLOR;
}

/**
 * Validates opaque sRGB hexadecimal string (#RRGGBB or RRGGBB).
 */
export function isValidHexColor(hex: string): boolean {
  if (typeof hex !== 'string') return false;
  const clean = hex.trim().replace(/^#/, '');
  return /^[0-9a-fA-F]{6}$/.test(clean);
}

/**
 * Normalizes valid hex string into lowercase '#rrggbb' format.
 * Returns null if input is invalid.
 */
export function normalizeHexColor(hex: string): string | null {
  if (!isValidHexColor(hex)) return null;
  const clean = hex.trim().replace(/^#/, '').toLowerCase();
  return `#${clean}`;
}

/**
 * Serializable appearance record attached to calculation snapshot.
 * Prepared for Phase V10 persistence.
 */
export interface CurveAppearance {
  readonly curveColor: string;
}
