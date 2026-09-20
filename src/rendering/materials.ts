/**
 * Materials for Intersect 3D Viewport.
 *
 * Visual Hierarchy & Rendering Invariants:
 * 1. Surface F: Muted blue translucent, double-sided, depthWrite: false.
 * 2. Surface G: Neutral gray translucent, double-sided, depthWrite: false.
 * 3. Guide Curves: Coordinate section contours with polygonOffset to prevent z-fighting.
 * 4. Intersection Curve: Warm off-white / theme-adjusted, LineMaterial with Line2,
 *    screen-space width 3.5px, renderOrder: 10 to ensure crisp legibility over surfaces.
 */

import * as THREE from 'three';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';

export const SURFACE_F_COLOR_DARK = 0x5b8ec7;
export const SURFACE_F_COLOR_LIGHT = 0x3a75b5;
export const SURFACE_G_COLOR_DARK = 0x8f94a0;
export const SURFACE_G_COLOR_LIGHT = 0x6b7280;

export const DEFAULT_CURVE_COLOR_DARK = 0xf5eedb;
export const DEFAULT_CURVE_COLOR_LIGHT = 0xb45309;

// Backward-compatible color aliases
export const SURFACE_F_COLOR = SURFACE_F_COLOR_DARK;
export const SURFACE_G_COLOR = SURFACE_G_COLOR_DARK;
export const DEFAULT_CURVE_COLOR = DEFAULT_CURVE_COLOR_DARK;

export function createSurfaceFMaterial(isDark = true): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color: isDark ? SURFACE_F_COLOR_DARK : SURFACE_F_COLOR_LIGHT,
    transparent: true,
    opacity: isDark ? 0.42 : 0.45,
    roughness: 0.65,
    metalness: 0.02,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
}

export function createSurfaceGMaterial(isDark = true): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color: isDark ? SURFACE_G_COLOR_DARK : SURFACE_G_COLOR_LIGHT,
    transparent: true,
    opacity: isDark ? 0.38 : 0.42,
    roughness: 0.65,
    metalness: 0.02,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
}

export function createSurfaceFGuideMaterial(isDark = true): THREE.LineBasicMaterial {
  return new THREE.LineBasicMaterial({
    color: isDark ? 0x90b8e8 : 0x2563eb,
    transparent: true,
    opacity: isDark ? 0.45 : 0.50,
    depthTest: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -1.0,
    polygonOffsetUnits: -1.0,
  });
}

export function createSurfaceGGuideMaterial(isDark = true): THREE.LineBasicMaterial {
  return new THREE.LineBasicMaterial({
    color: isDark ? 0xbac0cc : 0x4b5563,
    transparent: true,
    opacity: isDark ? 0.38 : 0.45,
    depthTest: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -1.0,
    polygonOffsetUnits: -1.0,
  });
}

export function createCurveMaterial(
  color: string | number = DEFAULT_CURVE_COLOR_DARK,
  resolution?: THREE.Vector2,
): LineMaterial {
  const mat = new LineMaterial({
    color: typeof color === 'string' ? new THREE.Color(color).getHex() : color,
    linewidth: 3.5,
    worldUnits: false,
    depthTest: true,
    depthWrite: false,
    transparent: false,
  });

  if (resolution) {
    mat.resolution.copy(resolution);
  }

  return mat;
}
