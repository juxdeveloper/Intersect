/**
 * Spatial coordinate and bounding box contracts for Intersect.
 *
 * Coordinate Convention:
 * - Standard right-handed Cartesian coordinates.
 * - +Z is oriented UP.
 * - +X is rightward/forward, +Y is orthogonal.
 *
 * Bounded Calculation vs Viewport Clipping:
 * - Mathematical proofs and bounded guarantees apply strictly within `CALCULATION_BOUNDS` ([-1000, 1000]^3).
 * - `INITIAL_REFERENCE_BOUNDS` ([-50, 50]^3) provides initial camera framing.
 * - Viewport clipping does NOT alter or truncate mathematical domains.
 */

export interface AxisRange {
  readonly min: number;
  readonly max: number;
}

export interface WorldBounds {
  readonly x: AxisRange;
  readonly y: AxisRange;
  readonly z: AxisRange;
}

/**
 * Global calculation/navigation bounding region:
 * x, y, z each in [-1000, 1000], a 2000 x 2000 x 2000 block centered at the origin.
 */
export const DEFAULT_CALCULATION_BOUNDS: WorldBounds = Object.freeze({
  x: { min: -1000, max: 1000 },
  y: { min: -1000, max: 1000 },
  z: { min: -1000, max: 1000 },
});

/**
 * Initial reference camera view:
 * x, y, z each in [-50, 50], a 100 x 100 x 100 block centered at the origin.
 */
export const INITIAL_REFERENCE_BOUNDS: WorldBounds = Object.freeze({
  x: { min: -50, max: 50 },
  y: { min: -50, max: 50 },
  z: { min: -50, max: 50 },
});

/**
 * Validates that bounding ranges are finite, non-inverted, and within reasonable limits.
 */
export function validateBounds(bounds: WorldBounds): { valid: boolean; error?: string } {
  const axes = [
    { name: 'X', range: bounds.x },
    { name: 'Y', range: bounds.y },
    { name: 'Z', range: bounds.z },
  ];

  for (const { name, range } of axes) {
    if (!Number.isFinite(range.min) || !Number.isFinite(range.max)) {
      return { valid: false, error: `${name}-axis bounds must be finite numbers.` };
    }
    if (range.min >= range.max) {
      return { valid: false, error: `${name}-axis minimum (${range.min}) must be strictly less than maximum (${range.max}).` };
    }
  }

  return { valid: true };
}
