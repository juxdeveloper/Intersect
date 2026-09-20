/**
 * ThreeSceneController for Intersect Phase V7.
 *
 * Implements the core 3D scene, Z-up camera, OrbitControls, materials,
 * geometry ingestion, bounded navigation, rendering lifecycle, and cleanup.
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { Line2 } from 'three/examples/jsm/lines/Line2.js';
import { LineGeometry } from 'three/examples/jsm/lines/LineGeometry.js';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
import type { WorldBounds } from '../contracts/bounds';
import type { GeometryResult, MeshGeometryBuffer, CurveGeometryBuffer } from '../contracts/geometry';
import type { ThreeSceneControllerOptions, ViewportStatus } from './types';
import {
  createSurfaceFMaterial,
  createSurfaceGMaterial,
  createSurfaceFGuideMaterial,
  createSurfaceGGuideMaterial,
  createCurveMaterial,
  SURFACE_F_COLOR_DARK,
  SURFACE_F_COLOR_LIGHT,
  SURFACE_G_COLOR_DARK,
  SURFACE_G_COLOR_LIGHT,
  DEFAULT_CURVE_COLOR_DARK,
} from './materials';
import { CoordinateFrameManager } from './grid-axes';
import { CurveAnimator, type AnimationState } from './curve-animator';

export class ThreeSceneController {
  private container: HTMLElement | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private renderer: THREE.WebGLRenderer | null = null;
  private scene: THREE.Scene | null = null;
  private camera: THREE.PerspectiveCamera | null = null;
  private controls: OrbitControls | null = null;

  // Geometry groups & Managers
  private coordManager: CoordinateFrameManager | null = null;
  private surfaceFGroup: THREE.Group | null = null;
  private surfaceGGroup: THREE.Group | null = null;
  private curveGroup: THREE.Group | null = null;

  // Materials & Animation
  private isDarkTheme = true;
  private surfaceFMaterial: THREE.MeshStandardMaterial | null = null;
  private surfaceGMaterial: THREE.MeshStandardMaterial | null = null;
  private curveMaterial: LineMaterial | null = null;
  private activeCurveColor: string | number = DEFAULT_CURVE_COLOR_DARK;
  private curveAnimator: CurveAnimator | null = null;
  private activeCurveDirection: string | null = null;

  // Retained state for context restoration and change detection
  private lastGeometryResult: GeometryResult | null = null;
  private activeCalculationId: string | number | null = null;
  private currentRenderRegion: WorldBounds = {
    x: { min: -50, max: 50 },
    y: { min: -50, max: 50 },
    z: { min: -50, max: 50 },
  };

  // Rendering lifecycle & animation loop
  private isDisposed = false;
  private isLoopRunning = false;
  private isPointerDown = false;
  private animationFrameId: number | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private regionDebounceTimer: ReturnType<typeof setTimeout> | null = null;

  // Settled detection
  private lastCamPos = new THREE.Vector3();
  private lastTarget = new THREE.Vector3();

  // Callbacks
  private readonly onRegionChange?: (newRegion: WorldBounds) => void;
  private readonly onStatusChange?: (status: ViewportStatus) => void;
  private readonly onAnimationStateChange?: (state: AnimationState) => void;

  constructor(options: ThreeSceneControllerOptions) {
    if (options.initialCurveColor !== undefined) {
      this.activeCurveColor = options.initialCurveColor;
    }
    this.onRegionChange = options.onRegionChange;
    this.onStatusChange = options.onStatusChange;
    this.onAnimationStateChange = options.onAnimationStateChange;
    this.mount(options.container);
  }

  public getCanvas(): HTMLCanvasElement | null {
    return this.canvas;
  }

  public getActiveCalculationId(): string | number | null {
    return this.activeCalculationId;
  }

  public getStatus(): ViewportStatus {
    if (!this.renderer) {
      return { type: 'webgl-unsupported', message: 'WebGL 3D graphics could not be initialized.' };
    }
    return { type: 'ready' };
  }

  /**
   * Mounts the WebGL scene into the DOM container.
   */
  public mount(container: HTMLElement): void {
    if (this.isDisposed) return;
    this.container = container;

    // 1. Check WebGL support cleanly
    if (!this.checkWebGLSupport()) {
      this.onStatusChange?.({
        type: 'webgl-unsupported',
        message: 'WebGL is not supported or was blocked by your browser/device.',
      });
      return;
    }

    try {
      const width = Math.max(container.clientWidth, 100);
      const height = Math.max(container.clientHeight, 100);
      const aspect = width / height;

      // 2. Initialize Three.js Scene
      this.scene = new THREE.Scene();
      this.scene.background = new THREE.Color(0x08090d);

      // 3. Initialize Perspective Camera with +Z Up
      this.camera = new THREE.PerspectiveCamera(45, aspect, 1.0, 10000.0);
      this.camera.up.set(0, 0, 1);

      // 4. Initialize WebGL Renderer
      this.renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: false,
        powerPreference: 'high-performance',
      });
      this.renderer.setSize(width, height, false);
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      this.canvas = this.renderer.domElement;
      this.canvas.className = 'three-viewport-canvas';
      this.canvas.style.display = 'block';
      this.canvas.style.width = '100%';
      this.canvas.style.height = '100%';
      this.canvas.style.touchAction = 'none';

      // Attach canvas to container
      this.container.appendChild(this.canvas);

      // 5. Lighting Setup (Key, Fill, Top, Ambient)
      const ambientLight = new THREE.AmbientLight(0xffffff, 0.52);
      this.scene.add(ambientLight);

      const keyLight = new THREE.DirectionalLight(0xffffff, 0.88);
      keyLight.position.set(75, -85, 110);
      this.scene.add(keyLight);

      const fillLight = new THREE.DirectionalLight(0x8ca0ba, 0.42);
      fillLight.position.set(-75, 85, -30);
      this.scene.add(fillLight);

      const topLight = new THREE.DirectionalLight(0xffffff, 0.3);
      topLight.position.set(0, 0, 100);
      this.scene.add(topLight);

      // 6. Coordinate Frame & Numbered Axes (+Z Up)
      this.coordManager = new CoordinateFrameManager(50, this.isDarkTheme);
      this.scene.add(this.coordManager.group);

      // 7. Surface & Curve Groups
      this.surfaceFGroup = new THREE.Group();
      this.surfaceFGroup.name = 'surface-f-group';
      this.scene.add(this.surfaceFGroup);

      this.surfaceGGroup = new THREE.Group();
      this.surfaceGGroup.name = 'surface-g-group';
      this.scene.add(this.surfaceGGroup);

      this.curveGroup = new THREE.Group();
      this.curveGroup.name = 'curve-group';
      this.scene.add(this.curveGroup);

      // 8. Materials
      this.surfaceFMaterial = createSurfaceFMaterial();
      this.surfaceGMaterial = createSurfaceGMaterial();
      this.curveMaterial = createCurveMaterial(
        this.activeCurveColor,
        new THREE.Vector2(width, height),
      );

      // 8b. Curve Animator for Phase V9
      this.curveAnimator = new CurveAnimator({
        scene: this.scene,
        curveGroup: this.curveGroup,
        camera: this.camera,
        curveMaterial: this.curveMaterial,
        initialColor: this.activeCurveColor,
        onStateChange: (state) => {
          this.onAnimationStateChange?.(state);
        },
        onRequestRender: () => {
          this.requestRender();
        },
      });

      // 9. OrbitControls Configuration
      this.controls = new OrbitControls(this.camera, this.canvas);
      this.controls.target.set(0, 0, 0);
      this.controls.enableDamping = true;
      this.controls.dampingFactor = 0.05;
      this.controls.minDistance = 2.0;
      this.controls.maxDistance = 3500.0;
      this.controls.minPolarAngle = 0.01;
      this.controls.maxPolarAngle = Math.PI - 0.01;
      this.controls.touches = {
        ONE: THREE.TOUCH.ROTATE,
        TWO: THREE.TOUCH.DOLLY_PAN,
      };

      // Set initial oblique camera framing
      this.setInitialFraming(aspect);

      // 10. Event Listeners
      this.attachEventListeners();

      // Initial render
      this.render();
      this.onStatusChange?.({ type: 'ready' });
    } catch (err) {
      console.error('ThreeSceneController initialization failed:', err);
      this.onStatusChange?.({
        type: 'webgl-unsupported',
        message: err instanceof Error ? err.message : 'Failed to initialize WebGL context',
      });
    }
  }

  private checkWebGLSupport(): boolean {
    if (typeof window === 'undefined' || typeof document === 'undefined') return false;
    try {
      const testCanvas = document.createElement('canvas');
      return Boolean(
        window.WebGLRenderingContext &&
          (testCanvas.getContext('webgl2') ||
            testCanvas.getContext('webgl') ||
            testCanvas.getContext('experimental-webgl')),
      );
    } catch {
      return false;
    }
  }

  /**
   * Sets initial oblique perspective camera framing for the [-50, 50]^3 reference box.
   */
  private setInitialFraming(aspect: number): void {
    if (!this.camera || !this.controls) return;

    // Frame the active reference region (radius ~15) to comfortably fill the viewport without empty void borders
    const R = 15.0;
    const vFovRad = (this.camera.fov * Math.PI) / 180;
    const tanHalfVFov = Math.tan(vFovRad / 2);
    // Limiting half angle depends on aspect ratio
    const limitingTan = aspect >= 1.0 ? tanHalfVFov : tanHalfVFov * aspect;
    // Distance required to contain bounding sphere with 15% visual padding
    const distance = (R * 1.15) / limitingTan;

    // Oblique unit vector matching reference (+X down-left, +Y down-right, +Z up)
    const dir = new THREE.Vector3(1.15, -1.35, 0.95).normalize();

    this.controls.target.set(0, 0, 0);
    this.camera.position.copy(dir.multiplyScalar(distance));
    this.camera.lookAt(0, 0, 0);
    this.controls.update();

    this.lastCamPos.copy(this.camera.position);
    this.lastTarget.copy(this.controls.target);
  }

  private attachEventListeners(): void {
    if (!this.canvas || !this.controls) return;

    // Controls change triggers render loop
    this.controls.addEventListener('change', this.handleControlsChange);

    // Pointer activity tracking
    this.canvas.addEventListener('pointerdown', this.handlePointerDown);
    window.addEventListener('pointerup', this.handlePointerUp);
    window.addEventListener('pointercancel', this.handlePointerUp);

    // Context loss & restore handling
    this.canvas.addEventListener('webglcontextlost', this.handleContextLost);
    this.canvas.addEventListener('webglcontextrestored', this.handleContextRestored);

    // Visibility change handling
    document.addEventListener('visibilitychange', this.handleVisibilityChange);

    // ResizeObserver
    if (this.container && typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver((entries) => {
        for (const entry of entries) {
          const { width, height } = entry.contentRect;
          if (width > 0 && height > 0) {
            this.resize(width, height);
          }
        }
      });
      this.resizeObserver.observe(this.container);
    }
  }

  private handlePointerDown = (): void => {
    this.isPointerDown = true;
    this.startLoop();
  };

  private handlePointerUp = (): void => {
    this.isPointerDown = false;
  };

  private handleControlsChange = (): void => {
    if (this.camera && this.coordManager) {
      this.coordManager.updateForCamera(this.camera);
    }
    this.startLoop();
    this.scheduleRegionCheck();
  };

  private handleVisibilityChange = (): void => {
    if (document.hidden) {
      this.stopLoop();
    } else {
      this.requestRender();
    }
  };

  private handleContextLost = (event: Event): void => {
    event.preventDefault();
    this.stopLoop();
    this.onStatusChange?.({
      type: 'context-lost',
      message: 'WebGL context was lost. Attempting to restore graphics...',
    });
  };

  private handleContextRestored = (): void => {
    if (this.isDisposed) return;
    try {
      // Re-upload materials and re-install retained geometry
      if (this.container) {
        const width = this.container.clientWidth;
        const height = this.container.clientHeight;
        this.surfaceFMaterial = createSurfaceFMaterial();
        this.surfaceGMaterial = createSurfaceGMaterial();
        this.curveMaterial = createCurveMaterial(
          this.activeCurveColor,
          new THREE.Vector2(width, height),
        );
        if (this.lastGeometryResult) {
          this.updateGeometry(this.lastGeometryResult);
        }
      }
      this.onStatusChange?.({ type: 'ready' });
      this.requestRender();
    } catch (err) {
      console.error('Failed to restore WebGL context:', err);
    }
  };

  /**
   * Clamps controls.target to calculation bounds [-1000, 1000]^3
   * and preserves camera-target offset to prevent jumps.
   */
  private clampNavigationBounds(): void {
    if (!this.controls || !this.camera) return;

    const tx = this.controls.target.x;
    const ty = this.controls.target.y;
    const tz = this.controls.target.z;

    const clampedX = Math.max(-1000, Math.min(1000, tx));
    const clampedY = Math.max(-1000, Math.min(1000, ty));
    const clampedZ = Math.max(-1000, Math.min(1000, tz));

    const dx = clampedX - tx;
    const dy = clampedY - ty;
    const dz = clampedZ - tz;

    if (dx !== 0 || dy !== 0 || dz !== 0) {
      this.controls.target.set(clampedX, clampedY, clampedZ);
      this.camera.position.x += dx;
      this.camera.position.y += dy;
      this.camera.position.z += dz;
    }
  }

  /**
   * Evaluates if user navigation has settled outside the current render region,
   * debouncing geometry region requests to avoid excessive meshing.
   */
  private scheduleRegionCheck(): void {
    if (!this.onRegionChange || !this.controls || !this.camera) return;

    if (this.regionDebounceTimer) {
      clearTimeout(this.regionDebounceTimer);
    }

    this.regionDebounceTimer = setTimeout(() => {
      this.checkAndRequestRegionUpdate();
    }, 450);
  }

  private checkAndRequestRegionUpdate(): void {
    if (!this.controls || !this.camera || !this.onRegionChange) return;

    const target = this.controls.target;
    const camPos = this.camera.position;
    const distance = camPos.distanceTo(target);

    // Compute visible span at current distance
    const vFovRad = (this.camera.fov * Math.PI) / 180;
    const halfSpan = Math.max(50, Math.min(400, distance * Math.tan(vFovRad / 2) * 1.25));

    // Current region center and span
    const curXCenter = (this.currentRenderRegion.x.min + this.currentRenderRegion.x.max) / 2;
    const curYCenter = (this.currentRenderRegion.y.min + this.currentRenderRegion.y.max) / 2;
    const curZCenter = (this.currentRenderRegion.z.min + this.currentRenderRegion.z.max) / 2;
    const curSpan = (this.currentRenderRegion.x.max - this.currentRenderRegion.x.min) / 2;

    const targetDist = Math.hypot(target.x - curXCenter, target.y - curYCenter, target.z - curZCenter);
    const spanRatio = halfSpan / curSpan;

    // Trigger update if target moved > 40% of span or zoom changed by > 1.8x
    if (targetDist > curSpan * 0.4 || spanRatio > 1.8 || spanRatio < 0.55) {
      const newRegion: WorldBounds = {
        x: {
          min: Math.max(-1000, Math.round(target.x - halfSpan)),
          max: Math.min(1000, Math.round(target.x + halfSpan)),
        },
        y: {
          min: Math.max(-1000, Math.round(target.y - halfSpan)),
          max: Math.min(1000, Math.round(target.y + halfSpan)),
        },
        z: {
          min: Math.max(-1000, Math.round(target.z - halfSpan)),
          max: Math.min(1000, Math.round(target.z + halfSpan)),
        },
      };

      this.currentRenderRegion = newRegion;
      this.onRegionChange(newRegion);
    }
  }

  /**
   * Starts the on-demand rendering loop while damping or user interaction is active.
   */
  private startLoop(): void {
    if (this.isLoopRunning || this.isDisposed) return;
    this.isLoopRunning = true;
    this.loop();
  }

  private stopLoop(): void {
    this.isLoopRunning = false;
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  public isRendering(): boolean {
    return this.isLoopRunning;
  }

  private loop = (): void => {
    if (!this.isLoopRunning || this.isDisposed) return;

    const controlsChanged = this.controls?.update() ?? false;
    this.clampNavigationBounds();
    this.render();

    // Check if controls have settled
    if (!this.isPointerDown && this.camera && this.controls) {
      const camDeltaSq = this.camera.position.distanceToSquared(this.lastCamPos);
      const targetDeltaSq = this.controls.target.distanceToSquared(this.lastTarget);

      this.lastCamPos.copy(this.camera.position);
      this.lastTarget.copy(this.controls.target);

      if (!controlsChanged || (camDeltaSq < 1e-5 && targetDeltaSq < 1e-5)) {
        this.stopLoop();
        return;
      }
    }

    this.animationFrameId = requestAnimationFrame(this.loop);
  };

  /**
   * Renders a single frame.
   */
  public render(): void {
    if (!this.renderer || !this.scene || !this.camera || this.isDisposed) return;
    this.renderer.render(this.scene, this.camera);
  }

  /**
   * Requests a single frame render on demand.
   */
  public requestRender(): void {
    if (this.isLoopRunning || this.isDisposed) return;
    requestAnimationFrame(() => this.render());
  }

  /**
   * Resizes renderer and camera to match container dimensions.
   */
  public resize(width?: number, height?: number): void {
    if (!this.container || !this.renderer || !this.camera || this.isDisposed) return;

    const w = width ?? this.container.clientWidth;
    const h = height ?? this.container.clientHeight;

    if (w <= 0 || h <= 0) return;

    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();

    this.renderer.setSize(w, h, false);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

    if (this.curveMaterial) {
      this.curveMaterial.resolution.set(w, h);
    }

    this.requestRender();
  }

  /**
   * Resets camera and controls to initial oblique view of [-50, 50]^3 reference box.
   */
  public resetView(): void {
    if (!this.camera || !this.controls || !this.container || this.isDisposed) return;

    const aspect = Math.max(this.container.clientWidth, 1) / Math.max(this.container.clientHeight, 1);
    this.setInitialFraming(aspect);

    // Reset render region to default
    this.currentRenderRegion = {
      x: { min: -50, max: 50 },
      y: { min: -50, max: 50 },
      z: { min: -50, max: 50 },
    };

    this.onRegionChange?.(this.currentRenderRegion);
    this.requestRender();
  }

  /**
   * Updates or sets the curve color (custom picker Phase V9).
   */
  public setCurveColor(color: string | number): void {
    this.activeCurveColor = color;
    if (this.curveMaterial) {
      const hex = typeof color === 'string' ? new THREE.Color(color).getHex() : color;
      this.curveMaterial.color.setHex(hex);
    }
    this.curveAnimator?.setColor(color);
    this.requestRender();
  }

  /**
   * Sets viewport theme (light / dark) and updates background, axes, and surface materials.
   */
  public setTheme(theme: 'light' | 'dark'): void {
    const isDark = theme === 'dark';
    if (this.isDarkTheme === isDark && this.scene) return;
    this.isDarkTheme = isDark;

    if (this.scene) {
      this.scene.background = new THREE.Color(isDark ? 0x0c0d12 : 0xf6f7fa);
    }
    if (this.coordManager) {
      this.coordManager.setTheme(isDark);
      if (this.camera) this.coordManager.updateForCamera(this.camera);
    }
    if (this.surfaceFMaterial) {
      this.surfaceFMaterial.color.setHex(isDark ? SURFACE_F_COLOR_DARK : SURFACE_F_COLOR_LIGHT);
      this.surfaceFMaterial.opacity = isDark ? 0.40 : 0.45;
    }
    if (this.surfaceGMaterial) {
      this.surfaceGMaterial.color.setHex(isDark ? SURFACE_G_COLOR_DARK : SURFACE_G_COLOR_LIGHT);
      this.surfaceGMaterial.opacity = isDark ? 0.35 : 0.40;
    }
    this.requestRender();
  }

  /**
   * Adjusts viewport rendering resolution and fidelity to match the active quality preset.
   */
  public setQuality(quality: 'low' | 'medium' | 'high' | 'draft' | 'default'): void {
    if (!this.renderer || !this.container || this.isDisposed) return;
    const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
    let targetDpr = 1.0;
    if (quality === 'low' || quality === 'draft') {
      targetDpr = Math.min(dpr, 1.25);
    } else if (quality === 'medium' || quality === 'default') {
      targetDpr = Math.min(dpr, 1.75);
    } else {
      targetDpr = Math.min(dpr, 2.5);
    }

    this.renderer.setPixelRatio(targetDpr);
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    if (w > 0 && h > 0) {
      this.renderer.setSize(w, h, false);
      if (this.curveMaterial) {
        this.curveMaterial.resolution.set(w * targetDpr, h * targetDpr);
      }
    }
    this.requestRender();
  }

  /**
   * Installs V6 geometry buffers into the Three.js scene.
   * Atomic replacement guarantees old and new geometry are never mixed.
   */
  public updateGeometry(result: GeometryResult | null): void {
    if (this.isDisposed || !this.scene) return;

    this.lastGeometryResult = result;

    if (!result) {
      this.clearGeometry();
      return;
    }

    const isNewCalculation = String(result.calculationId) !== String(this.activeCalculationId);
    const isDirectionChange =
      result.curve?.traversalOrientation !== undefined &&
      this.activeCurveDirection !== null &&
      result.curve.traversalOrientation !== this.activeCurveDirection;
    const autoPlay = isNewCalculation || isDirectionChange;

    this.activeCalculationId = result.calculationId;
    if (result.curve?.traversalOrientation) {
      this.activeCurveDirection = result.curve.traversalOrientation;
    }

    // 1. Install Surface F
    this.installSurfaceMesh(this.surfaceFGroup, result.surfaceF, this.surfaceFMaterial);

    // 2. Install Surface G
    this.installSurfaceMesh(this.surfaceGGroup, result.surfaceG, this.surfaceGMaterial);

    // 3. Install Intersection Curve and configure trace animation
    this.installCurveSegments(this.curveGroup, result.curve, autoPlay);

    this.requestRender();
  }

  private installSurfaceMesh(
    group: THREE.Group | null,
    buffer: MeshGeometryBuffer | null,
    material: THREE.Material | null,
  ): void {
    if (!group || !material) return;

    // Dispose old children in group
    this.disposeGroupChildren(group);

    if (!buffer || buffer.status !== 'success' && buffer.status !== 'partial-budget-limited') {
      return;
    }

    // Validate buffer invariants
    if (
      buffer.positions.length === 0 ||
      buffer.indices.length === 0 ||
      buffer.positions.length % 3 !== 0 ||
      buffer.indices.length % 3 !== 0
    ) {
      return;
    }

    // Verify finite values
    for (let i = 0; i < Math.min(buffer.positions.length, 300); i++) {
      if (!Number.isFinite(buffer.positions[i])) {
        console.warn('Non-finite vertex coordinates in mesh buffer');
        return;
      }
    }

    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.BufferAttribute(buffer.positions, 3));

    if (buffer.normals.length === buffer.positions.length) {
      geom.setAttribute('normal', new THREE.BufferAttribute(buffer.normals, 3));
    } else {
      geom.computeVertexNormals();
    }

    geom.setIndex(new THREE.BufferAttribute(buffer.indices, 1));

    const mesh = new THREE.Mesh(geom, material);
    mesh.renderOrder = 1;
    group.add(mesh);

    // Install subtle coordinate section guide curves (Section 4.C)
    if (buffer.guideCurvesPositions && buffer.guideCurvesPositions.length > 0) {
      const guideGeom = new THREE.BufferGeometry();
      guideGeom.setAttribute('position', new THREE.BufferAttribute(buffer.guideCurvesPositions, 3));
      const guideMat = group === this.surfaceFGroup
        ? createSurfaceFGuideMaterial(this.isDarkTheme)
        : createSurfaceGGuideMaterial(this.isDarkTheme);
      const guideLines = new THREE.LineSegments(guideGeom, guideMat);
      guideLines.renderOrder = 3;
      group.add(guideLines);
    }
  }

  private installCurveSegments(
    group: THREE.Group | null,
    curveBuffer: CurveGeometryBuffer | null,
    autoPlay = true,
  ): void {
    if (!group || !this.curveMaterial) return;

    // Dispose old curve segments
    this.disposeGroupChildren(group);

    if (!curveBuffer || curveBuffer.status !== 'success' && curveBuffer.status !== 'partial-budget-limited') {
      this.curveAnimator?.installCurve(null, [], null, null, false);
      return;
    }

    const pos = curveBuffer.positions;
    const breaks = curveBuffer.segmentBreaks;

    if (pos.length < 6) {
      // Need at least 2 points (6 floats) to form a line segment
      this.curveAnimator?.installCurve(null, [], null, null, false);
      return;
    }

    // Determine segment bounds from segmentBreaks
    const segmentIndices: Array<{ start: number; end: number }> = [];

    if (breaks.length <= 1) {
      // Single continuous segment
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

    // Build Line2 object for each disconnected segment
    const createdLines: Line2[] = [];
    for (const seg of segmentIndices) {
      const segCoords: number[] = [];
      for (let idx = seg.start; idx < seg.end; idx++) {
        const x = pos[idx * 3] ?? 0;
        const y = pos[idx * 3 + 1] ?? 0;
        const z = pos[idx * 3 + 2] ?? 0;
        segCoords.push(x, y, z);
      }

      if (segCoords.length >= 6) {
        const lineGeom = new LineGeometry();
        lineGeom.setPositions(segCoords);

        const line = new Line2(lineGeom, this.curveMaterial);
        line.renderOrder = 10;
        group.add(line);
        createdLines.push(line);
      }
    }

    // Delegate progressive reveal and moving arrow to CurveAnimator
    this.curveAnimator?.installCurve(
      curveBuffer,
      createdLines,
      this.activeCalculationId,
      curveBuffer.traversalOrientation,
      autoPlay,
    );
  }

  public clearGeometry(): void {
    if (this.surfaceFGroup) this.disposeGroupChildren(this.surfaceFGroup);
    if (this.surfaceGGroup) this.disposeGroupChildren(this.surfaceGGroup);
    if (this.curveGroup) this.disposeGroupChildren(this.curveGroup);
    this.curveAnimator?.installCurve(null, [], null, null, false);
    this.lastGeometryResult = null;
    this.requestRender();
  }

  /**
   * Animation playback control methods for Phase V9.
   */
  public playAnimation(): void {
    this.curveAnimator?.play();
  }

  public pauseAnimation(): void {
    this.curveAnimator?.pause();
  }

  public resumeAnimation(): void {
    this.curveAnimator?.resume();
  }

  public replayAnimation(): void {
    this.curveAnimator?.replay();
  }

  public skipAnimationToEnd(): void {
    this.curveAnimator?.skipToEnd();
  }

  public getAnimationState(): AnimationState {
    return this.curveAnimator?.getState() ?? 'unavailable';
  }

  private disposeGroupChildren(group: THREE.Group): void {
    while (group.children.length > 0) {
      const child = group.children[0];
      if (!child) break;
      group.remove(child);
      if (child instanceof THREE.Mesh || child instanceof Line2 || child instanceof THREE.Line) {
        child.geometry?.dispose();
      }
    }
  }

  /**
   * Fully disposes renderer, controls, geometries, materials, observers, and listeners.
   */
  public dispose(): void {
    if (this.isDisposed) return;
    this.isDisposed = true;

    this.stopLoop();

    if (this.regionDebounceTimer) {
      clearTimeout(this.regionDebounceTimer);
      this.regionDebounceTimer = null;
    }

    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }

    if (this.controls) {
      this.controls.removeEventListener('change', this.handleControlsChange);
      this.controls.dispose();
      this.controls = null;
    }

    if (this.canvas) {
      this.canvas.removeEventListener('pointerdown', this.handlePointerDown);
      this.canvas.removeEventListener('webglcontextlost', this.handleContextLost);
      this.canvas.removeEventListener('webglcontextrestored', this.handleContextRestored);
    }

    if (typeof window !== 'undefined') {
      window.removeEventListener('pointerup', this.handlePointerUp);
      window.removeEventListener('pointercancel', this.handlePointerUp);
    }
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', this.handleVisibilityChange);
    }

    this.clearGeometry();

    if (this.curveAnimator) {
      this.curveAnimator.dispose();
      this.curveAnimator = null;
    }

    if (this.coordManager) {
      this.coordManager.dispose();
      this.coordManager = null;
    }

    this.surfaceFMaterial?.dispose();
    this.surfaceGMaterial?.dispose();
    this.curveMaterial?.dispose();

    if (this.renderer) {
      this.renderer.dispose();
      if (this.canvas && this.canvas.parentElement) {
        this.canvas.parentElement.removeChild(this.canvas);
      }
      this.renderer = null;
      this.canvas = null;
    }

    this.scene = null;
    this.camera = null;
    this.container = null;
  }
}
