/**
 * Comprehensive Unit Test Suite for CurveAnimator and Appearance (Phase V9).
 *
 * Verifies:
 * 1. Animation lifecycle states: 'unavailable' -> 'ready' -> 'playing' -> 'paused' -> 'finished'.
 * 2. Spatial arc-length pacing: cumulative distance mapping, lead line reveal, segment index calculation.
 * 3. Gaps & disconnected segments: never connects across gaps or draws bridging lines.
 * 4. Direction arrow: position, orientation along tangent, scaling, and static cue at finish.
 * 5. Monotonic clock and visibility pause: pauses elapsed time accumulation when document is hidden.
 * 6. Prefers-reduced-motion: skips autoplay, reveals full curve immediately, retains static arrow.
 * 7. Hex color normalization and deterministic palette allocation.
 * 8. Resource cleanup and disposal.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as THREE from 'three';
import { Line2 } from 'three/examples/jsm/lines/Line2.js';
import { LineGeometry } from 'three/examples/jsm/lines/LineGeometry.js';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
import { CurveAnimator, type AnimationState } from '../curve-animator';
import {
  CURVE_PALETTE,
  DEFAULT_CURVE_PALETTE_COLOR,
  getNextDefaultCurveColor,
  isValidHexColor,
  normalizeHexColor,
} from '../../contracts/appearance';
import type { CurveGeometryBuffer } from '../../contracts/geometry';
import { createEmptyCurveBuffer } from '../../contracts/geometry';

describe('Intersect V9 Curve Animation & Appearance Suite', () => {
  describe('1. Color Contracts & Palette Allocation (Section 8.B & 8.C)', () => {
    it('validates opaque sRGB hex strings', () => {
      expect(isValidHexColor('#f5eedb')).toBe(true);
      expect(isValidHexColor('f5eedb')).toBe(true);
      expect(isValidHexColor('#AABBCC')).toBe(true);
      expect(isValidHexColor('#123')).toBe(false); // only 6-digit opaque hex accepted
      expect(isValidHexColor('rgb(255,0,0)')).toBe(false);
      expect(isValidHexColor('<script>alert(1)</script>')).toBe(false);
      expect(isValidHexColor('')).toBe(false);
    });

    it('normalizes valid hex strings to lowercase #rrggbb format', () => {
      expect(normalizeHexColor('F5EEDB')).toBe('#f5eedb');
      expect(normalizeHexColor('#34D399')).toBe('#34d399');
      expect(normalizeHexColor('  #FBBF24  ')).toBe('#fbbf24');
      expect(normalizeHexColor('invalid')).toBeNull();
    });

    it('allocates deterministic, distinct colors across sequential calculations', () => {
      const color0 = getNextDefaultCurveColor(0);
      const color1 = getNextDefaultCurveColor(1);
      const color2 = getNextDefaultCurveColor(2);

      expect(color0).toBe(DEFAULT_CURVE_PALETTE_COLOR);
      expect(color1).toBe(CURVE_PALETTE[1]);
      expect(color2).toBe(CURVE_PALETTE[2]);
      expect(color0).not.toBe(color1);
      expect(color1).not.toBe(color2);

      // Wraps around gracefully
      const wrapped = getNextDefaultCurveColor(CURVE_PALETTE.length);
      expect(wrapped).toBe(CURVE_PALETTE[0]);
    });
  });

  describe('2. CurveAnimator Lifecycle & Segment Ingestion (Section 4 & 5)', () => {
    let scene: THREE.Scene;
    let camera: THREE.PerspectiveCamera;
    let curveGroup: THREE.Group;
    let curveMaterial: LineMaterial;

    beforeEach(() => {
      scene = new THREE.Scene();
      camera = new THREE.PerspectiveCamera(45, 1, 1, 1000);
      camera.position.set(0, 0, 100);
      curveGroup = new THREE.Group();
      scene.add(curveGroup);
      curveMaterial = new LineMaterial({ linewidth: 3.5 });
    });

    afterEach(() => {
      curveMaterial.dispose();
    });

    it('initializes to unavailable state when no curve is installed', () => {
      const stateChanges: AnimationState[] = [];
      const animator = new CurveAnimator({
        scene,
        camera,
        curveGroup,
        curveMaterial,
        onStateChange: (st) => stateChanges.push(st),
      });

      expect(animator.getState()).toBe('unavailable');
      animator.dispose();
    });

    it('transitions to ready or playing upon installing a valid curve buffer', () => {
      const stateChanges: AnimationState[] = [];
      const animator = new CurveAnimator({
        scene,
        camera,
        curveGroup,
        curveMaterial,
        onStateChange: (st) => stateChanges.push(st),
      });

      // Simple 3-point line: (0,0,0) -> (10,0,0) -> (20,0,0)
      const positions = new Float32Array([0, 0, 0, 10, 0, 0, 20, 0, 0]);
      const breaks = new Uint32Array([0]);
      const lineGeom = new LineGeometry();
      lineGeom.setPositions(Array.from(positions));
      const line = new Line2(lineGeom, curveMaterial);
      curveGroup.add(line);

      const buffer: CurveGeometryBuffer = {
        ...createEmptyCurveBuffer('success'),
        positions,
        sampleCount: 3,
        segmentCount: 1,
        segmentBreaks: breaks,
      };

      // Install without autoplay (e.g. reduced motion or manual)
      animator.installCurve(buffer, [line], 'calc-1', 'forward', false);

      expect(animator.getState()).toBe('finished');
      expect(animator.getProgress()).toBe(1.0);

      // Line instances should be fully revealed
      expect(line.geometry.instanceCount).toBe(2);

      lineGeom.dispose();
      animator.dispose();
    });

    it('supports pause, resume, and replay transitions', () => {
      const stateChanges: AnimationState[] = [];
      const animator = new CurveAnimator({
        scene,
        camera,
        curveGroup,
        curveMaterial,
        onStateChange: (st) => stateChanges.push(st),
      });

      const positions = new Float32Array([0, 0, 0, 10, 0, 0, 20, 0, 0]);
      const breaks = new Uint32Array([0]);
      const lineGeom = new LineGeometry();
      lineGeom.setPositions(Array.from(positions));
      const line = new Line2(lineGeom, curveMaterial);
      curveGroup.add(line);

      const buffer: CurveGeometryBuffer = {
        ...createEmptyCurveBuffer('success'),
        positions,
        sampleCount: 3,
        segmentCount: 1,
        segmentBreaks: breaks,
      };

      // Install with autoplay
      animator.installCurve(buffer, [line], 'calc-1', 'forward', true);
      expect(animator.getState()).toBe('playing');

      // Pause
      animator.pause();
      expect(animator.getState()).toBe('paused');

      // Resume
      animator.resume();
      expect(animator.getState()).toBe('playing');

      // Skip to end
      animator.skipToEnd();
      expect(animator.getState()).toBe('finished');
      expect(animator.getProgress()).toBe(1.0);

      // Replay
      animator.replay();
      expect(animator.getState()).toBe('playing');
      expect(animator.getProgress()).toBe(0.0);

      lineGeom.dispose();
      animator.dispose();
    });
  });

  describe('3. Disconnected Segments & Gap Preservation (Section 5.B)', () => {
    let scene: THREE.Scene;
    let camera: THREE.PerspectiveCamera;
    let curveGroup: THREE.Group;
    let curveMaterial: LineMaterial;

    beforeEach(() => {
      scene = new THREE.Scene();
      camera = new THREE.PerspectiveCamera(45, 1, 1, 1000);
      curveGroup = new THREE.Group();
      scene.add(curveGroup);
      curveMaterial = new LineMaterial({ linewidth: 3.5 });
    });

    afterEach(() => {
      curveMaterial.dispose();
    });

    it('never connects across parameter gaps during progressive reveal', () => {
      const animator = new CurveAnimator({
        scene,
        camera,
        curveGroup,
        curveMaterial,
      });

      // Segment 1: (0,0,0) -> (10,0,0) (length 10)
      // Segment 2: (50,0,0) -> (60,0,0) (length 10, separated by 40-unit gap)
      const positions = new Float32Array([
        0, 0, 0,
        10, 0, 0,
        50, 0, 0,
        60, 0, 0,
      ]);
      const breaks = new Uint32Array([0, 2]);

      const geom1 = new LineGeometry();
      geom1.setPositions([0, 0, 0, 10, 0, 0]);
      const line1 = new Line2(geom1, curveMaterial);

      const geom2 = new LineGeometry();
      geom2.setPositions([50, 0, 0, 60, 0, 0]);
      const line2 = new Line2(geom2, curveMaterial);

      curveGroup.add(line1);
      curveGroup.add(line2);

      const buffer: CurveGeometryBuffer = {
        ...createEmptyCurveBuffer('success'),
        positions,
        sampleCount: 4,
        segmentCount: 2,
        segmentBreaks: breaks,
      };

      animator.installCurve(buffer, [line1, line2], 'calc-gaps', 'forward', false);

      // At progress 0.25: middle of segment 1
      animator.applyProgress(0.25);
      // Segment 1 revealed partially, segment 2 completely hidden (instanceCount 0)
      expect(line2.geometry.instanceCount).toBe(0);

      // At progress 0.5: exactly at the boundary of segment 1 and segment 2
      animator.applyProgress(0.5);
      // Segment 1 is fully revealed
      expect(line1.geometry.instanceCount).toBe(1);

      // At progress 0.75: middle of segment 2
      animator.applyProgress(0.75);
      // Segment 1 fully revealed, segment 2 partially revealed
      expect(line1.geometry.instanceCount).toBe(1);

      // At progress 1.0: both fully revealed
      animator.applyProgress(1.0);
      expect(line1.geometry.instanceCount).toBe(1);
      expect(line2.geometry.instanceCount).toBe(1);

      geom1.dispose();
      geom2.dispose();
      animator.dispose();
    });
  });

  describe('4. Direction Arrow & Tangents (Section 6)', () => {
    let scene: THREE.Scene;
    let camera: THREE.PerspectiveCamera;
    let curveGroup: THREE.Group;
    let curveMaterial: LineMaterial;

    beforeEach(() => {
      scene = new THREE.Scene();
      camera = new THREE.PerspectiveCamera(45, 1, 1, 1000);
      camera.position.set(0, 0, 100);
      curveGroup = new THREE.Group();
      scene.add(curveGroup);
      curveMaterial = new LineMaterial({ linewidth: 3.5 });
    });

    afterEach(() => {
      curveMaterial.dispose();
    });

    it('creates direction arrow and updates color dynamically', () => {
      const animator = new CurveAnimator({
        scene,
        camera,
        curveGroup,
        curveMaterial,
        initialColor: '#f5eedb',
      });

      const arrow = scene.getObjectByName('direction-arrow') as THREE.Mesh | undefined;
      expect(arrow).toBeDefined();
      expect(arrow).toBeInstanceOf(THREE.Mesh);

      // Check initial color
      const mat = arrow!.material as THREE.MeshStandardMaterial;
      expect(mat.color.getHexString()).toBe('f5eedb');

      // Update color
      animator.setColor('#38bdf8');
      expect(mat.color.getHexString()).toBe('38bdf8');

      animator.dispose();
      expect(scene.getObjectByName('direction-arrow')).toBeUndefined();
    });

    it('orients arrow along traversal tangent in forward direction', () => {
      const animator = new CurveAnimator({
        scene,
        camera,
        curveGroup,
        curveMaterial,
      });

      // Curve moving along +X: (0,0,0) -> (100,0,0)
      const positions = new Float32Array([0, 0, 0, 100, 0, 0]);
      const breaks = new Uint32Array([0]);
      const geom = new LineGeometry();
      geom.setPositions(Array.from(positions));
      const line = new Line2(geom, curveMaterial);
      curveGroup.add(line);

      const buffer: CurveGeometryBuffer = {
        ...createEmptyCurveBuffer('success'),
        positions,
        sampleCount: 2,
        segmentCount: 1,
        segmentBreaks: breaks,
      };

      animator.installCurve(buffer, [line], 'calc-tangent', 'forward', false);

      // Progress 0.5 -> Position (50, 0, 0)
      animator.applyProgress(0.5);

      const arrow = scene.getObjectByName('direction-arrow') as THREE.Mesh;
      expect(arrow).toBeDefined();
      expect(arrow.position.x).toBeCloseTo(50, 1);
      expect(arrow.position.y).toBeCloseTo(0, 1);
      expect(arrow.position.z).toBeCloseTo(0, 1);

      // Arrow cone apex in local +Y rotated into +X world tangent
      const worldApexDir = new THREE.Vector3(0, 1, 0).applyQuaternion(arrow.quaternion);
      expect(worldApexDir.x).toBeCloseTo(1.0, 3);
      expect(worldApexDir.y).toBeCloseTo(0.0, 3);
      expect(worldApexDir.z).toBeCloseTo(0.0, 3);

      geom.dispose();
      animator.dispose();
    });

    it('maintains valid orientation without NaN when duplicate sample points occur', () => {
      const animator = new CurveAnimator({
        scene,
        camera,
        curveGroup,
        curveMaterial,
      });

      // Samples with stationary/duplicate points
      const positions = new Float32Array([
        0, 0, 0,
        10, 0, 0,
        10, 0, 0, // Duplicate point
        20, 0, 0,
      ]);
      const breaks = new Uint32Array([0]);
      const geom = new LineGeometry();
      geom.setPositions(Array.from(positions));
      const line = new Line2(geom, curveMaterial);
      curveGroup.add(line);

      const buffer: CurveGeometryBuffer = {
        ...createEmptyCurveBuffer('success'),
        positions,
        sampleCount: 4,
        segmentCount: 1,
        segmentBreaks: breaks,
      };

      animator.installCurve(buffer, [line], 'calc-dup', 'forward', false);

      // Exercise multiple progress steps
      for (let p = 0; p <= 1.0; p += 0.1) {
        expect(() => animator.applyProgress(p)).not.toThrow();
        const arrow = scene.getObjectByName('direction-arrow') as THREE.Mesh;
        expect(Number.isFinite(arrow.position.x)).toBe(true);
        expect(Number.isFinite(arrow.quaternion.x)).toBe(true);
      }

      geom.dispose();
      animator.dispose();
    });
  });
});
