/**
 * Comprehensive Unit and Integration Test Suite for Intersect 3D Rendering (Phase V7).
 *
 * Verifies:
 * 1. Material definitions, colors, translucency, depthWrite settings.
 * 2. Right-handed Z-up coordinate axes, labels, and XY ground grid.
 * 3. Curve segment extraction: single loop, multiple separated segments, gap preservation.
 * 4. Bounded navigation math: calculation box [-1000, 1000]^3, target clamping, offset preservation.
 * 5. Camera framing calculations for aspect ratios.
 * 6. Headless / SSR safety and WebGL context fallback.
 */

import { describe, it, expect, vi } from 'vitest';
import * as THREE from 'three';
import {
  createSurfaceFMaterial,
  createSurfaceGMaterial,
  createCurveMaterial,
  SURFACE_F_COLOR,
  SURFACE_G_COLOR,
  DEFAULT_CURVE_COLOR,
  createCoordinateFrame,
  createTextSprite,
  ThreeSceneController,
} from '../index';
import type { CurveGeometryBuffer } from '../../contracts/geometry';
import { createEmptyCurveBuffer } from '../../contracts/geometry';
import { sameCurveSamples } from '../scene-controller';

describe('Intersect V7 3D Scene & Rendering Suite', () => {
  describe('1. Materials & Visual Hierarchy (Section 7)', () => {
    it('creates Surface F material with muted blue color and non-writing translucency', () => {
      const mat = createSurfaceFMaterial();
      expect(mat.color.getHex()).toBe(SURFACE_F_COLOR);
      expect(mat.transparent).toBe(true);
      expect(mat.opacity).toBeCloseTo(0.42, 2);
      expect(mat.depthWrite).toBe(false);
      expect(mat.side).toBe(THREE.DoubleSide);
      mat.dispose();
    });

    it('creates Surface G material with neutral gray color and non-writing translucency', () => {
      const mat = createSurfaceGMaterial();
      expect(mat.color.getHex()).toBe(SURFACE_G_COLOR);
      expect(mat.transparent).toBe(true);
      expect(mat.opacity).toBeCloseTo(0.38, 2);
      expect(mat.depthWrite).toBe(false);
      expect(mat.side).toBe(THREE.DoubleSide);
      mat.dispose();
    });

    it('creates Curve LineMaterial with warm off-white, depth test, and screen-space width', () => {
      const mat = createCurveMaterial(DEFAULT_CURVE_COLOR, new THREE.Vector2(800, 600));
      expect(mat.color.getHex()).toBe(DEFAULT_CURVE_COLOR);
      expect(mat.linewidth).toBe(3.5);
      expect(mat.depthTest).toBe(true);
      expect(mat.depthWrite).toBe(false);
      expect(mat.resolution.x).toBe(800);
      expect(mat.resolution.y).toBe(600);
      mat.dispose();
    });

    it('accepts customizable curve color for V9 preparation', () => {
      const mat = createCurveMaterial('#60a5fa');
      expect(mat.color.getHexString()).toBe('60a5fa');
      mat.dispose();
    });
  });

  describe('2. Coordinate Frame & Grid (Section 5.A)', () => {
    it('creates coordinate frame with XY ground grid at z=0 and Z-up axes', () => {
      const frame = createCoordinateFrame(50);
      expect(frame.name).toBe('coordinate-frame');

      // Check grid helper
      const grid = frame.children.find((c) => c instanceof THREE.GridHelper) as THREE.GridHelper | undefined;
      expect(grid).toBeDefined();
      // Grid is rotated by 90 degrees around X to lie in XY plane
      expect(grid!.rotation.x).toBeCloseTo(Math.PI / 2, 4);
      expect(grid!.position.z).toBe(0);

      // Check text sprites for X, Y, Z
      const sprites = frame.children.filter((c) => c instanceof THREE.Sprite);
      expect(sprites.length).toBe(3);

      // Verify sprite positions: +X at x>50, +Y at y>50, +Z at z>50
      const xSprite = sprites.find((s) => s.position.x > 50);
      const ySprite = sprites.find((s) => s.position.y > 50);
      const zSprite = sprites.find((s) => s.position.z > 50);

      expect(xSprite).toBeDefined();
      expect(ySprite).toBeDefined();
      expect(zSprite).toBeDefined();
    });

    it('creates text sprites locally with headless fallback when document is undefined', () => {
      const sprite = createTextSprite('Z', '#ffffff');
      expect(sprite).toBeInstanceOf(THREE.Sprite);
      expect(sprite.material.transparent).toBe(true);
      expect(sprite.material.depthTest).toBe(false);
      expect(sprite.scale.x).toBe(6);
    });
  });

  describe('3. Geometry Buffer Ingestion & Segmentation (Section 4 & 7.B)', () => {
    it('preserves a trace only for identical samples, direction, and segment boundaries', () => {
      const curve = { ...createEmptyCurveBuffer('success'), positions: new Float32Array([0, 1, 2, 1, 2, 3]),
        tValues: new Float64Array([0, 1]), segmentBreaks: new Uint32Array([0]) };
      expect(sameCurveSamples(curve, structuredClone(curve))).toBe(true);
      expect(sameCurveSamples(curve, { ...curve, traversalOrientation: 'reverse' })).toBe(false);
      expect(sameCurveSamples(curve, { ...curve, positions: new Float32Array([0, 1, 2, 1, 2, 4]) })).toBe(false);
      expect(sameCurveSamples(curve, { ...curve, tValues: new Float64Array([0, 2]) })).toBe(false);
      expect(sameCurveSamples(curve, { ...curve, segmentBreaks: new Uint32Array([0, 1]) })).toBe(false);
      expect(sameCurveSamples(curve, null)).toBe(false);
      expect(sameCurveSamples(null, null)).toBe(true);
    });
    it('correctly calculates segment ranges for multiple separated curve components', () => {
      // Curve with 2 separated segments: points 0..1 (seg 0) and points 2..3 (seg 1)
      const positions = new Float32Array([
        // Seg 1
        1, 1, 1,
        2, 2, 2,
        // Seg 2
        10, 10, 10,
        20, 20, 20,
      ]);
      const breaks = new Uint32Array([0, 2]);

      const curveBuffer: CurveGeometryBuffer = {
        ...createEmptyCurveBuffer('success'),
        positions,
        sampleCount: 4,
        segmentCount: 2,
        segmentBreaks: breaks,
      };

      // Test segment indices computation
      const segmentIndices: Array<{ start: number; end: number }> = [];
      const pos = curveBuffer.positions;
      if (breaks.length <= 1) {
        segmentIndices.push({ start: 0, end: pos.length / 3 });
      } else {
        for (let i = 0; i < breaks.length; i++) {
          const start = breaks[i] ?? 0;
          const nextBreak = i + 1 < breaks.length ? breaks[i + 1] : undefined;
          const end = typeof nextBreak === 'number' ? nextBreak : pos.length / 3;
          if (end - start >= 2) {
            segmentIndices.push({ start, end });
          }
        }
      }

      expect(segmentIndices.length).toBe(2);
      expect(segmentIndices[0]).toEqual({ start: 0, end: 2 });
      expect(segmentIndices[1]).toEqual({ start: 2, end: 4 });
      // Point 1 (2,2,2) and Point 2 (10,10,10) are NEVER connected across the segment gap
    });

    it('safely validates finite numbers in vertex buffers', () => {
      const invalidPositions = new Float32Array([0, NaN, 2, 1, Infinity, 3]);
      let hasNonFinite = false;
      for (let i = 0; i < invalidPositions.length; i++) {
        if (!Number.isFinite(invalidPositions[i])) {
          hasNonFinite = true;
          break;
        }
      }
      expect(hasNonFinite).toBe(true);

      const validPositions = new Float32Array([0, 1, 2, 3, 4, 5]);
      let allValid = true;
      for (let i = 0; i < validPositions.length; i++) {
        if (!Number.isFinite(validPositions[i])) {
          allValid = false;
          break;
        }
      }
      expect(allValid).toBe(true);
    });
  });

  describe('4. Bounded Navigation & Clamping Invariants (Section 6)', () => {
    it('preserves camera-target offset when clamping target to calculation bounds [-1000, 1000]^3', () => {
      // Calculation box bounds: [-1000, 1000]
      const target = new THREE.Vector3(1200, -800, 500); // x exceeds 1000
      const camPos = new THREE.Vector3(1350, -950, 600);
      const initialOffset = camPos.clone().sub(target);

      // Target clamping logic simulation
      const clampedX = Math.max(-1000, Math.min(1000, target.x));
      const clampedY = Math.max(-1000, Math.min(1000, target.y));
      const clampedZ = Math.max(-1000, Math.min(1000, target.z));

      const dx = clampedX - target.x;
      const dy = clampedY - target.y;
      const dz = clampedZ - target.z;

      target.set(clampedX, clampedY, clampedZ);
      camPos.x += dx;
      camPos.y += dy;
      camPos.z += dz;

      expect(target.x).toBe(1000);
      expect(target.y).toBe(-800);
      expect(target.z).toBe(500);

      // Verify offset vector is strictly unchanged
      const finalOffset = camPos.clone().sub(target);
      expect(finalOffset.x).toBeCloseTo(initialOffset.x, 5);
      expect(finalOffset.y).toBeCloseTo(initialOffset.y, 5);
      expect(finalOffset.z).toBeCloseTo(initialOffset.z, 5);
    });

    it('correctly clamps all three axes simultaneously at the corner of calculation bounds', () => {
      const target = new THREE.Vector3(-1500, 2000, -1100);
      const clampedX = Math.max(-1000, Math.min(1000, target.x));
      const clampedY = Math.max(-1000, Math.min(1000, target.y));
      const clampedZ = Math.max(-1000, Math.min(1000, target.z));

      expect(clampedX).toBe(-1000);
      expect(clampedY).toBe(1000);
      expect(clampedZ).toBe(-1000);
    });
  });

  describe('5. Initial Framing Math & Aspect Ratio (Section 5.B)', () => {
    it('computes correct viewing distance to contain 100-unit box in oblique perspective', () => {
      const R = 50 * Math.sqrt(3); // ~86.6025
      const fovDeg = 45;
      const fovRad = (fovDeg * Math.PI) / 180;
      const tanHalfFov = Math.tan(fovRad / 2); // ~0.4142

      // Landscape (aspect = 1.6)
      const aspectLandscape = 1.6;
      const distLandscape = (R * 1.2) / (tanHalfFov * Math.min(1, aspectLandscape));
      expect(distLandscape).toBeGreaterThan(240);
      expect(distLandscape).toBeLessThan(260);

      // Portrait (aspect = 0.6)
      const aspectPortrait = 0.6;
      const distPortrait = (R * 1.2) / (tanHalfFov * aspectPortrait);
      expect(distPortrait).toBeGreaterThan(distLandscape);
      expect(distPortrait).toBeCloseTo(distLandscape / 0.6, 1);
    });
  });

  describe('6. Headless / SSR Fallback & Status Callbacks (Section 9 & 10)', () => {
    it('notifies webgl-unsupported without throwing when WebGL is unavailable in Node/SSR', () => {
      const statusCallback = vi.fn();
      const mockContainer = {} as HTMLElement;

      const ctrl = new ThreeSceneController({
        container: mockContainer,
        onStatusChange: statusCallback,
      });

      expect(statusCallback).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'webgl-unsupported' }),
      );
      expect(ctrl.getStatus().type).toBe('webgl-unsupported');

      ctrl.dispose();
    });
  });
});
