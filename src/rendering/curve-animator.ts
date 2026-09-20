/**
 * CurveAnimator for Intersect Phase V9.
 *
 * Responsibilities:
 * 1. Manages animation lifecycle: 'unavailable' | 'ready' | 'playing' | 'paused' | 'finished'.
 * 2. Progressively reveals the active Line2 curve segments based on spatial arc-length pacing.
 * 3. Never draws across parameter gaps or disconnected segments.
 * 4. Animates a single restrained moving direction arrow at the trace head pointing along traversal.
 * 5. Handles cusps, duplicate samples, and gaps without NaN rotations or fabricated connections.
 * 6. Preserves a static direction cue at completion and honors prefers-reduced-motion.
 * 7. Manages monotonic clock elapsed time, pausing accumulation when document is hidden.
 */

import * as THREE from 'three';
import { Line2 } from 'three/examples/jsm/lines/Line2.js';
import { LineGeometry } from 'three/examples/jsm/lines/LineGeometry.js';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
import type { CurveGeometryBuffer } from '../contracts/geometry';
import { DEFAULT_CURVE_COLOR } from './materials';

export type AnimationState = 'unavailable' | 'ready' | 'playing' | 'paused' | 'finished';

export interface CurveAnimatorOptions {
  scene: THREE.Scene;
  curveGroup: THREE.Group;
  camera: THREE.PerspectiveCamera;
  curveMaterial: LineMaterial;
  initialColor?: string | number;
  onStateChange?: (state: AnimationState) => void;
  onRequestRender?: () => void;
}

interface SegmentData {
  startIdx: number;
  endIdx: number;
  line: Line2;
  points: THREE.Vector3[];
  cumLengths: number[];
  totalLength: number;
  globalStartDist: number;
  globalEndDist: number;
}

export class CurveAnimator {
  private readonly scene: THREE.Scene;
  private readonly camera: THREE.PerspectiveCamera;
  private readonly curveMaterial: LineMaterial;
  private readonly onStateChange?: (state: AnimationState) => void;
  private readonly onRequestRender?: () => void;

  // Lifecycle state
  private state: AnimationState = 'unavailable';
  private animationDurationMs = 2600; // Calibrated 2.6s for educational pacing
  private startTime = 0;
  private elapsedTime = 0;
  private progress = 0; // 0 to 1
  private isDisposed = false;
  private animFrameId: number | null = null;

  // Curve geometry and segment cache
  private segments: SegmentData[] = [];
  private totalArcLength = 0;
  private activeColor: string | number = DEFAULT_CURVE_COLOR;

  // Lead line for smooth continuous vertex-to-vertex reveal
  private leadLine: Line2 | null = null;
  private leadGeom: LineGeometry | null = null;

  // Direction arrow
  private arrowMesh: THREE.Mesh | null = null;
  private arrowMaterial: THREE.MeshStandardMaterial | null = null;
  private lastValidTangent = new THREE.Vector3(0, 1, 0);

  // Stale detection
  private activeCalculationId: string | number | null = null;
  private activeDirection: string | null = null;

  constructor(options: CurveAnimatorOptions) {
    this.scene = options.scene;
    this.camera = options.camera;
    this.curveMaterial = options.curveMaterial;
    this.activeColor = options.initialColor ?? DEFAULT_CURVE_COLOR;
    this.onStateChange = options.onStateChange;
    this.onRequestRender = options.onRequestRender;

    this.initArrowAndLead();

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', this.handleVisibilityChange);
    }
  }

  public getState(): AnimationState {
    return this.state;
  }

  public getProgress(): number {
    return this.progress;
  }

  public getActiveCalculationId(): string | number | null {
    return this.activeCalculationId;
  }

  public getActiveDirection(): string | null {
    return this.activeDirection;
  }

  /**
   * Initializes arrow cone and lead line primitives once for bounded resource allocation.
   */
  private initArrowAndLead(): void {
    // 1. Direction Arrow: Cone geometry
    // Base radius 0.22, height 0.70, 16 radial segments.
    // Three.js cone points along +Y by default.
    // We translate so apex is at (0, 0, 0) and base is at (0, -0.7, 0).
    const coneGeom = new THREE.ConeGeometry(0.22, 0.70, 16);
    coneGeom.translate(0, -0.35, 0);

    const colorHex = typeof this.activeColor === 'string'
      ? new THREE.Color(this.activeColor).getHex()
      : this.activeColor;

    this.arrowMaterial = new THREE.MeshStandardMaterial({
      color: colorHex,
      roughness: 0.35,
      metalness: 0.15,
      depthTest: true,
      depthWrite: false,
    });

    this.arrowMesh = new THREE.Mesh(coneGeom, this.arrowMaterial);
    this.arrowMesh.name = 'direction-arrow';
    this.arrowMesh.renderOrder = 15;
    this.arrowMesh.visible = false;
    this.scene.add(this.arrowMesh);

    // 2. Smooth Lead Line Segment
    this.leadGeom = new LineGeometry();
    this.leadGeom.setPositions([0, 0, 0, 0, 0, 0]);
    this.leadLine = new Line2(this.leadGeom, this.curveMaterial);
    this.leadLine.name = 'lead-curve-segment';
    this.leadLine.renderOrder = 11;
    this.leadLine.visible = false;
    this.scene.add(this.leadLine);
  }

  /**
   * Sets or updates active curve and arrow color.
   */
  public setColor(color: string | number): void {
    this.activeColor = color;
    const colorHex = typeof color === 'string'
      ? new THREE.Color(color).getHex()
      : color;

    if (this.arrowMaterial) {
      this.arrowMaterial.color.setHex(colorHex);
    }
    this.onRequestRender?.();
  }

  /**
   * Installs new curve buffer and rebuilds cached segment distance lookup.
   * @param curveBuffer V6 curve geometry buffer
   * @param lines Array of Line2 objects created for the segments
   * @param calculationId Current calculation identifier
   * @param direction Current traversal orientation ('forward' | 'reverse')
   * @param autoPlay Whether to automatically start playback (subject to reduced motion)
   */
  public installCurve(
    curveBuffer: CurveGeometryBuffer | null,
    lines: Line2[],
    calculationId: string | number | null,
    direction: string | null,
    autoPlay = true,
  ): void {
    this.stopAnimationLoop();

    this.activeCalculationId = calculationId;
    this.activeDirection = direction;

    if (
      !curveBuffer ||
      (curveBuffer.status !== 'success' && curveBuffer.status !== 'partial-budget-limited') ||
      curveBuffer.positions.length < 6 ||
      lines.length === 0
    ) {
      this.segments = [];
      this.totalArcLength = 0;
      this.progress = 0;
      if (this.arrowMesh) this.arrowMesh.visible = false;
      if (this.leadLine) this.leadLine.visible = false;
      this.setState('unavailable');
      return;
    }

    const pos = curveBuffer.positions;
    const breaks = curveBuffer.segmentBreaks;
    const totalPoints = pos.length / 3;

    // Build segment index spans
    const spans: Array<{ start: number; end: number }> = [];
    if (breaks.length <= 1) {
      spans.push({ start: 0, end: totalPoints });
    } else {
      for (let i = 0; i < breaks.length; i++) {
        const start = breaks[i] ?? 0;
        const nextBreak = i + 1 < breaks.length ? breaks[i + 1] : undefined;
        const end = typeof nextBreak === 'number' ? nextBreak : totalPoints;
        if (end - start >= 2) {
          spans.push({ start, end });
        }
      }
    }

    if (spans.length === 0) {
      this.segments = [];
      this.totalArcLength = 0;
      this.setState('unavailable');
      return;
    }

    // Build segments lookup data
    this.segments = [];
    let cumulativeDist = 0;

    for (let s = 0; s < spans.length; s++) {
      const span = spans[s]!;
      const line = lines[s];
      if (!line) continue;

      const pts: THREE.Vector3[] = [];
      const cumLengths: number[] = [0];
      let segLen = 0;

      for (let idx = span.start; idx < span.end; idx++) {
        const x = pos[idx * 3] ?? 0;
        const y = pos[idx * 3 + 1] ?? 0;
        const z = pos[idx * 3 + 2] ?? 0;
        const pt = new THREE.Vector3(x, y, z);
        pts.push(pt);

        if (pts.length > 1) {
          const prevPt = pts[pts.length - 2]!;
          const d = pt.distanceTo(prevPt);
          segLen += d;
          cumLengths.push(segLen);
        }
      }

      this.segments.push({
        startIdx: span.start,
        endIdx: span.end,
        line,
        points: pts,
        cumLengths,
        totalLength: segLen,
        globalStartDist: cumulativeDist,
        globalEndDist: cumulativeDist + segLen,
      });

      cumulativeDist += segLen;
    }

    this.totalArcLength = cumulativeDist;

    if (this.totalArcLength <= 1e-6) {
      this.setState('unavailable');
      return;
    }

    // Check user's prefers-reduced-motion setting
    const prefersReducedMotion =
      typeof window !== 'undefined' && typeof window.matchMedia === 'function'
        ? Boolean(window.matchMedia('(prefers-reduced-motion: reduce)').matches)
        : false;

    if (prefersReducedMotion || !autoPlay) {
      // Show full curve immediately without autoplay, display static arrow at end
      this.progress = 1.0;
      this.elapsedTime = this.animationDurationMs;
      this.applyProgress(1.0);
      this.setState('finished');
    } else {
      // Start tracing from beginning
      this.progress = 0;
      this.elapsedTime = 0;
      this.applyProgress(0.0);
      this.setState('ready');
      this.play();
    }
  }

  private setState(newState: AnimationState): void {
    if (this.state !== newState) {
      this.state = newState;
      this.onStateChange?.(newState);
    }
  }

  public play(): void {
    if (this.segments.length === 0 || this.totalArcLength <= 1e-6) return;
    this.stopAnimationLoop();

    this.startTime = performance.now() - this.elapsedTime;
    this.setState('playing');
    if (typeof requestAnimationFrame === 'function') {
      this.animFrameId = requestAnimationFrame(this.animLoop);
    } else {
      this.animFrameId = setTimeout(this.animLoop, 16) as unknown as number;
    }
  }

  public pause(): void {
    if (this.state !== 'playing') return;
    this.stopAnimationLoop();
    this.setState('paused');
    this.onRequestRender?.();
  }

  public resume(): void {
    if (this.state !== 'paused') return;
    this.play();
  }

  public replay(): void {
    if (this.state === 'unavailable' || this.segments.length === 0) return;
    this.progress = 0;
    this.elapsedTime = 0;
    this.applyProgress(0);
    this.play();
  }

  public skipToEnd(): void {
    if (this.state === 'unavailable' || this.segments.length === 0) return;
    this.stopAnimationLoop();
    this.progress = 1.0;
    this.elapsedTime = this.animationDurationMs;
    this.applyProgress(1.0);
    this.setState('finished');
    this.onRequestRender?.();
  }

  private stopAnimationLoop(): void {
    if (this.animFrameId !== null) {
      if (typeof cancelAnimationFrame === 'function') {
        cancelAnimationFrame(this.animFrameId);
      } else {
        clearTimeout(this.animFrameId);
      }
      this.animFrameId = null;
    }
  }

  private handleVisibilityChange = (): void => {
    if (document.hidden) {
      if (this.state === 'playing') {
        // Pause elapsed time accumulation while hidden to prevent giant leaps
        this.stopAnimationLoop();
      }
    } else {
      if (this.state === 'playing') {
        // Resume with adjusted start time
        this.startTime = performance.now() - this.elapsedTime;
        this.animLoop();
      }
    }
  };

  private animLoop = (): void => {
    if (this.isDisposed || this.state !== 'playing') return;

    const now = performance.now();
    this.elapsedTime = now - this.startTime;
    const rawProgress = this.elapsedTime / this.animationDurationMs;

    if (rawProgress >= 1.0) {
      this.progress = 1.0;
      this.applyProgress(1.0);
      this.setState('finished');
      this.onRequestRender?.();
      return;
    }

    this.progress = Math.max(0, Math.min(1.0, rawProgress));
    this.applyProgress(this.progress);
    this.onRequestRender?.();

    if (typeof requestAnimationFrame === 'function') {
      this.animFrameId = requestAnimationFrame(this.animLoop);
    } else {
      this.animFrameId = setTimeout(this.animLoop, 16) as unknown as number;
    }
  };

  /**
   * Evaluates curve position, tangent, and reveals line segments for a given progress in [0, 1].
   */
  public applyProgress(u: number): void {
    if (this.segments.length === 0 || this.totalArcLength <= 1e-6) {
      if (this.arrowMesh) this.arrowMesh.visible = false;
      if (this.leadLine) this.leadLine.visible = false;
      return;
    }

    const clampedU = Math.max(0, Math.min(1.0, u));

    // Full reveal at completion
    if (clampedU >= 1.0) {
      for (const seg of this.segments) {
        seg.line.geometry.instanceCount = Math.max(0, seg.points.length - 1);
      }
      if (this.leadLine) this.leadLine.visible = false;

      // Position static direction cue arrow at end of last segment (or middle)
      const lastSeg = this.segments[this.segments.length - 1]!;
      const pts = lastSeg.points;
      if (pts.length >= 2) {
        const pEnd = pts[pts.length - 1]!;
        const pPrev = pts[pts.length - 2]!;
        const dir = new THREE.Vector3().subVectors(pEnd, pPrev);
        if (dir.lengthSq() > 1e-8) {
          dir.normalize();
          this.lastValidTangent.copy(dir);
        }
        this.positionArrow(pEnd, this.lastValidTangent);
      }
      return;
    }

    const currentDist = clampedU * this.totalArcLength;

    // Find which segment currentDist falls into
    let activeSegIndex = 0;
    for (let i = 0; i < this.segments.length; i++) {
      const seg = this.segments[i]!;
      if (i === this.segments.length - 1) {
        if (currentDist >= seg.globalStartDist) {
          activeSegIndex = i;
          break;
        }
      } else {
        if (currentDist >= seg.globalStartDist && currentDist < seg.globalEndDist) {
          activeSegIndex = i;
          break;
        }
      }
    }

    const activeSeg = this.segments[activeSegIndex]!;
    const localDist = Math.max(0, Math.min(activeSeg.totalLength, currentDist - activeSeg.globalStartDist));

    // Find which sample edge [k, k+1] inside activeSeg
    const cum = activeSeg.cumLengths;
    let k = 0;
    for (let i = 0; i < cum.length - 1; i++) {
      if (localDist >= (cum[i] ?? 0) && localDist <= (cum[i + 1] ?? 0)) {
        k = i;
        break;
      }
      if (localDist > (cum[i + 1] ?? 0)) {
        k = i;
      }
    }

    const d0 = cum[k] ?? 0;
    const d1 = cum[k + 1] ?? (d0 + 1e-6);
    const edgeLen = d1 - d0;
    const alpha = edgeLen > 1e-8 ? (localDist - d0) / edgeLen : 0;

    const p0 = activeSeg.points[k] ?? activeSeg.points[0]!;
    const p1 = activeSeg.points[k + 1] ?? p0;

    // Interpolate continuous 3D head position
    const currentPos = new THREE.Vector3().lerpVectors(p0, p1, alpha);

    // Compute local segment tangent along traversal
    const tangent = new THREE.Vector3().subVectors(p1, p0);
    if (tangent.lengthSq() > 1e-8) {
      tangent.normalize();
      this.lastValidTangent.copy(tangent);
    }

    // 1. Reveal segment lines
    for (let s = 0; s < this.segments.length; s++) {
      const seg = this.segments[s]!;
      if (s < activeSegIndex) {
        // Fully revealed
        seg.line.geometry.instanceCount = Math.max(0, seg.points.length - 1);
      } else if (s === activeSegIndex) {
        // Revealed up to point k
        seg.line.geometry.instanceCount = k;
      } else {
        // Hidden (future segments)
        seg.line.geometry.instanceCount = 0;
      }
    }

    // 2. Smooth lead line connecting sample k to currentPos
    if (this.leadLine && this.leadGeom) {
      if (alpha > 1e-4 && p0.distanceToSquared(currentPos) > 1e-8) {
        this.leadGeom.setPositions([
          p0.x, p0.y, p0.z,
          currentPos.x, currentPos.y, currentPos.z,
        ]);
        this.leadLine.visible = true;
      } else {
        this.leadLine.visible = false;
      }
    }

    // 3. Position and orient direction arrow
    this.positionArrow(currentPos, this.lastValidTangent);
  }

  /**
   * Positions, orients, and scales the moving direction arrow at the given 3D position.
   */
  private positionArrow(pos: THREE.Vector3, tangent: THREE.Vector3): void {
    if (!this.arrowMesh) return;

    this.arrowMesh.position.copy(pos);

    // Orient cone: Cone apex points along +Y in local space.
    // Rotate +Y into unit tangent vector.
    const up = new THREE.Vector3(0, 1, 0);
    const q = new THREE.Quaternion().setFromUnitVectors(up, tangent);
    this.arrowMesh.quaternion.copy(q);

    // Scale dynamically with camera distance to remain crisp without dominating graph
    const camDist = this.camera.position.distanceTo(pos);
    const dynamicScale = Math.max(0.35, Math.min(1.2, camDist * 0.005));
    this.arrowMesh.scale.set(dynamicScale, dynamicScale, dynamicScale);

    this.arrowMesh.visible = true;
  }

  public dispose(): void {
    if (this.isDisposed) return;
    this.isDisposed = true;

    this.stopAnimationLoop();

    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', this.handleVisibilityChange);
    }

    if (this.arrowMesh) {
      this.scene.remove(this.arrowMesh);
      this.arrowMesh.geometry?.dispose();
      this.arrowMesh = null;
    }

    this.arrowMaterial?.dispose();
    this.arrowMaterial = null;

    if (this.leadLine) {
      this.scene.remove(this.leadLine);
      this.leadGeom?.dispose();
      this.leadLine = null;
      this.leadGeom = null;
    }

    this.segments = [];
  }
}
