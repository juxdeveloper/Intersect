/**
 * Coordinate Frame and Numbered Axes for Intersect.
 *
 * Implements Section 3 (Numbered, Legible Coordinate References):
 * - Right-handed Cartesian coordinates with +Z up.
 * - Cohesive theme-adjusted axis colors: X red, Y green, Z blue.
 * - Thick axes clearly distinguishable from the neutral grid.
 * - Arrowheads at positive axis tips.
 * - Dynamic zoom-dependent tick marks and numeric labels (1, 2, 5 × 10^k).
 * - Origin label '0' and positive-axis labels (X, Y, Z).
 * - Canvas sprite cache to prevent GC allocations during interaction.
 */

import * as THREE from 'three';

export interface AxisColors {
  x: number;
  y: number;
  z: number;
  gridMain: number;
  gridSub: number;
  text: string;
}

export const DARK_AXIS_COLORS: AxisColors = {
  x: 0xef4444, // Red
  y: 0x22c55e, // Green
  z: 0x3b82f6, // Blue
  gridMain: 0x282c3c,
  gridSub: 0x161822,
  text: '#9ba3b8',
};

export const LIGHT_AXIS_COLORS: AxisColors = {
  x: 0xdc2626, // Red
  y: 0x16a34a, // Green
  z: 0x2563eb, // Blue
  gridMain: 0xd0d5e2,
  gridSub: 0xe8ecf4,
  text: '#4b5563',
};

// Texture cache for numeric label sprites
const spriteTextureCache = new Map<string, THREE.CanvasTexture>();

function getSpriteTexture(text: string, color: string): THREE.CanvasTexture {
  const key = `${text}_${color}`;
  let texture = spriteTextureCache.get(key);
  if (texture) return texture;

  if (typeof document === 'undefined') {
    const canvas = {} as HTMLCanvasElement;
    texture = new THREE.CanvasTexture(canvas);
    spriteTextureCache.set(key, texture);
    return texture;
  }

  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.clearRect(0, 0, 128, 64);
    ctx.font = 'bold 36px system-ui, -apple-system, sans-serif';
    ctx.fillStyle = color;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 64, 32);
  }

  texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  spriteTextureCache.set(key, texture);
  return texture;
}

export function createTextSprite(text: string, color = '#ffffff'): THREE.Sprite {
  const texture = getSpriteTexture(text, color);
  const mat = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthTest: false,
    depthWrite: false,
  });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(6, 3, 1);
  return sprite;
}

export class CoordinateFrameManager {
  public readonly group: THREE.Group;
  private readonly extent: number;
  private gridHelper: THREE.GridHelper;
  private tickGroup: THREE.Group;
  private currentStep = 10;
  private isDark = true;
  private lastCamDist = 0;

  constructor(extent = 50, isDark = true) {
    this.extent = extent;
    this.isDark = isDark;
    this.group = new THREE.Group();
    this.group.name = 'coordinate-frame';

    const colors = isDark ? DARK_AXIS_COLORS : LIGHT_AXIS_COLORS;

    // 1. XY Ground grid at z = 0
    this.gridHelper = new THREE.GridHelper(extent * 2, 20, colors.gridMain, colors.gridSub);
    this.gridHelper.rotation.x = Math.PI / 2;
    this.gridHelper.position.set(0, 0, 0);
    (this.gridHelper.material as THREE.Material).depthWrite = false;
    this.group.add(this.gridHelper);

    // 2. Thick Axis Cylinders and Arrow Cones
    this.buildThickAxes(colors);

    // 3. Dynamic Tick Group
    this.tickGroup = new THREE.Group();
    this.tickGroup.name = 'axes-ticks-group';
    this.group.add(this.tickGroup);

    this.rebuildTicks(10);
  }

  public dispose(): void {
    while (this.group.children.length > 0) {
      const child = this.group.children[0];
      if (child) {
        this.group.remove(child);
      }
    }
  }

  private buildThickAxes(colors: AxisColors): void {
    const axisRadius = 0.12;
    const coneRadius = 0.7;
    const coneHeight = 2.2;

    const createAxisCylinder = (dir: THREE.Vector3, color: number) => {
      // Cylinder default is along Y axis; translate center to length / 2
      const geom = new THREE.CylinderGeometry(axisRadius, axisRadius, this.extent, 12);
      geom.translate(0, this.extent / 2, 0);
      const mat = new THREE.MeshBasicMaterial({
        color,
        depthTest: true,
        depthWrite: false,
      });
      const mesh = new THREE.Mesh(geom, mat);
      mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
      this.group.add(mesh);

      // Arrow cone at tip
      const coneGeom = new THREE.ConeGeometry(coneRadius, coneHeight, 16);
      coneGeom.translate(0, coneHeight / 2, 0);
      const coneMat = new THREE.MeshBasicMaterial({
        color,
        depthTest: true,
        depthWrite: false,
      });
      const cone = new THREE.Mesh(coneGeom, coneMat);
      cone.position.copy(dir.clone().multiplyScalar(this.extent));
      cone.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
      this.group.add(cone);

      // Negative dashed line
      const negGeom = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, 0, 0),
        dir.clone().multiplyScalar(-this.extent),
      ]);
      const negMat = new THREE.LineDashedMaterial({
        color,
        dashSize: 1.5,
        gapSize: 1.5,
        depthTest: true,
        depthWrite: false,
        transparent: true,
        opacity: 0.45,
      });
      const negLine = new THREE.Line(negGeom, negMat);
      negLine.computeLineDistances();
      this.group.add(negLine);
    };

    createAxisCylinder(new THREE.Vector3(1, 0, 0), colors.x);
    createAxisCylinder(new THREE.Vector3(0, 1, 0), colors.y);
    createAxisCylinder(new THREE.Vector3(0, 0, 1), colors.z);

    // Tip label sprites (+X, +Y, +Z)
    const xSprite = createTextSprite('X', `#${colors.x.toString(16).padStart(6, '0')}`);
    xSprite.position.set(this.extent + 4, 0, 0);
    this.group.add(xSprite);

    const ySprite = createTextSprite('Y', `#${colors.y.toString(16).padStart(6, '0')}`);
    ySprite.position.set(0, this.extent + 4, 0);
    this.group.add(ySprite);

    const zSprite = createTextSprite('Z', `#${colors.z.toString(16).padStart(6, '0')}`);
    zSprite.position.set(0, 0, this.extent + 4);
    this.group.add(zSprite);
  }

  public setTheme(isDark: boolean): void {
    if (this.isDark === isDark) return;
    this.isDark = isDark;
    const colors = isDark ? DARK_AXIS_COLORS : LIGHT_AXIS_COLORS;

    // Dispose old group and rebuild
    while (this.group.children.length > 0) {
      const child = this.group.children[0];
      if (child) {
        this.group.remove(child);
      }
    }

    this.gridHelper = new THREE.GridHelper(this.extent * 2, 20, colors.gridMain, colors.gridSub);
    this.gridHelper.rotation.x = Math.PI / 2;
    (this.gridHelper.material as THREE.Material).depthWrite = false;
    this.group.add(this.gridHelper);

    this.buildThickAxes(colors);

    this.tickGroup = new THREE.Group();
    this.group.add(this.tickGroup);
    this.rebuildTicks(this.currentStep);
  }

  /**
   * Updates tick marks and numeric labels dynamically based on camera distance.
   */
  public updateForCamera(camera: THREE.PerspectiveCamera): void {
    const camDist = camera.position.length();
    if (Math.abs(camDist - this.lastCamDist) / Math.max(1, this.lastCamDist) < 0.18) {
      return;
    }
    this.lastCamDist = camDist;

    // Approximate visible span based on distance
    const vFovRad = (camera.fov * Math.PI) / 180;
    const visSpan = 2 * camDist * Math.tan(vFovRad / 2);

    // Desired ~6 to 10 ticks across the span
    const targetStep = visSpan / 8;
    const exponent = Math.floor(Math.log10(targetStep));
    const power = 10 ** exponent;
    const fraction = targetStep / power;

    let step: number;
    if (fraction < 1.8) {
      step = 1 * power;
    } else if (fraction < 4.0) {
      step = 2 * power;
    } else if (fraction < 8.0) {
      step = 5 * power;
    } else {
      step = 10 * power;
    }

    step = Math.max(1, Math.min(25, step));

    if (step !== this.currentStep) {
      this.currentStep = step;
      this.rebuildTicks(step);
    }
  }

  private rebuildTicks(step: number): void {
    // Clear old ticks
    while (this.tickGroup.children.length > 0) {
      const c = this.tickGroup.children[0];
      if (c) this.tickGroup.remove(c);
    }

    const colors = this.isDark ? DARK_AXIS_COLORS : LIGHT_AXIS_COLORS;
    const textColor = colors.text;
    const tickLen = Math.max(0.3, Math.min(1.0, step * 0.08));
    const spriteW = 1.5;
    const spriteH = 0.75;

    const addSprite = (text: string, pos: THREE.Vector3, color = textColor) => {
      const texture = getSpriteTexture(text, color);
      const mat = new THREE.SpriteMaterial({
        map: texture,
        transparent: true,
        depthTest: true,
        depthWrite: false,
      });
      const sprite = new THREE.Sprite(mat);
      sprite.scale.set(spriteW, spriteH, 1);
      sprite.position.copy(pos);
      this.tickGroup.add(sprite);
    };

    // 1. Origin Label
    addSprite('0', new THREE.Vector3(-0.7, -0.7, 0));

    // 2. Ticks along X, Y, Z
    const tickPoints: number[] = [];

    // Ensure labels are spaced at least 4 units apart to prevent collisions
    const labelInterval = step < 3 ? step * 2 : step;

    const addAxisTicks = (axis: 'x' | 'y' | 'z') => {
      const maxVal = Math.min(this.extent - step * 0.5, 50);
      for (let v = step; v <= maxVal; v += step) {
        // Positive and negative ticks
        for (const sign of [1, -1]) {
          const val = v * sign;
          const isLabeled = Math.abs(val) % labelInterval === 0;

          if (axis === 'x') {
            tickPoints.push(val, -tickLen, 0, val, tickLen, 0);
            if (isLabeled) {
              addSprite(String(val), new THREE.Vector3(val, -tickLen - 0.7, 0));
            }
          } else if (axis === 'y') {
            tickPoints.push(-tickLen, val, 0, tickLen, val, 0);
            if (isLabeled) {
              addSprite(String(val), new THREE.Vector3(-tickLen - 0.9, val, 0));
            }
          } else if (axis === 'z') {
            tickPoints.push(-tickLen, 0, val, tickLen, 0, val);
            if (isLabeled) {
              addSprite(String(val), new THREE.Vector3(-tickLen - 0.9, 0, val));
            }
          }
        }
      }
    };

    addAxisTicks('x');
    addAxisTicks('y');
    addAxisTicks('z');

    const tickGeom = new THREE.BufferGeometry();
    tickGeom.setAttribute('position', new THREE.Float32BufferAttribute(tickPoints, 3));
    const tickMat = new THREE.LineBasicMaterial({
      color: this.isDark ? 0x606880 : 0x94a0b8,
      depthTest: true,
      depthWrite: false,
    });
    const tickLines = new THREE.LineSegments(tickGeom, tickMat);
    this.tickGroup.add(tickLines);
  }
}

export function createCoordinateFrame(extent = 50, isDark = true): THREE.Group {
  return new CoordinateFrameManager(extent, isDark).group;
}
