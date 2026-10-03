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

// Shared textures are retained only while an axis sprite uses them.
const spriteTextureCache = new Map<string, { texture: THREE.CanvasTexture; references: number }>();

function getSpriteTexture(text: string, color: string): THREE.CanvasTexture {
  const key = `${text}_${color}`;
  const cached = spriteTextureCache.get(key);
  if (cached) { cached.references++; return cached.texture; }
  const canvas = typeof document === 'undefined'
    ? { width: 224, height: 112 } as HTMLCanvasElement
    : document.createElement('canvas');
  canvas.width = 224;
  canvas.height = 112;
  const ctx = typeof canvas.getContext === 'function' ? canvas.getContext('2d') : null;
  if (ctx) {
    ctx.font = '600 72px system-ui, -apple-system, sans-serif';
    canvas.width = Math.ceil(ctx.measureText(text).width + 32);
    ctx.font = '600 72px system-ui, -apple-system, sans-serif';
    ctx.fillStyle = color;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, canvas.width / 2, canvas.height / 2);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.colorSpace = THREE.SRGBColorSpace;
  spriteTextureCache.set(key, { texture, references: 1 });
  return texture;
}

function disposeChildren(group: THREE.Group): void {
  group.traverse((object) => {
    const drawable = object as THREE.Mesh;
    drawable.geometry?.dispose();
    if (object instanceof THREE.Sprite) {
      const key = object.userData.textureKey as string;
      const entry = spriteTextureCache.get(key);
      if (entry && --entry.references === 0) {
        entry.texture.dispose();
        spriteTextureCache.delete(key);
      }
    }
    const materials = Array.isArray(drawable.material) ? drawable.material : [drawable.material];
    for (const material of materials) material?.dispose();
  });
  group.clear();
}

export function createTextSprite(text: string, color = '#ffffff'): THREE.Sprite {
  const texture = getSpriteTexture(text, color);
  const mat = new THREE.SpriteMaterial({
    map: texture, transparent: true, depthTest: false, depthWrite: false, toneMapped: false,
  });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(6, 3, 1);
  sprite.userData = { text, textureKey: `${text}_${color}`, aspect: texture.image.width / texture.image.height };
  sprite.renderOrder = 5;
  return sprite;
}

export function axisLabelPixels(distance: number): number {
  return Math.max(13, Math.min(19, 14 + 1.5 * Math.log2(40 / Math.max(0.1, distance))));
}

export function axisTickStep(worldPerPixel: number, labelPixels: number): number {
  const desired = Math.max(0.1, worldPerPixel * Math.max(52, labelPixels * 3.5));
  const power = 10 ** Math.floor(Math.log10(desired));
  const fraction = desired / power;
  const multiplier = fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 5 ? 5 : 10;
  return Math.max(0.1, Math.min(25, multiplier * power));
}

export class CoordinateFrameManager {
  public readonly group: THREE.Group;
  private readonly extent: number;
  private gridHelper: THREE.GridHelper;
  private tickGroup: THREE.Group;
  private currentStep = 10;
  private isDark = true;
  private locale = 'es';
  private readonly projected = new THREE.Vector3();
  private readonly cameraDirection = new THREE.Vector3();
  private readonly depthOffset = new THREE.Vector3();
  private readonly labels: THREE.Sprite[] = [];
  private readonly boxes: { left: number; top: number; right: number; bottom: number }[] = [];
  private readonly axisDirections = [new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 1)];
  private readonly endpoints = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
  private readonly projectedOrigin = new THREE.Vector3();
  private readonly tickCenters = [0, 0, 0];

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
    disposeChildren(this.group);
    this.labels.length = 0;
    this.boxes.length = 0;
  }

  public setLanguage(locale: string): void {
    if (this.locale === locale) return;
    this.locale = locale;
    this.rebuildTicks(this.currentStep);
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
      mesh.name = 'axis-shaft';
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

    // Release superseded geometry, materials, and text textures before rebuilding.
    disposeChildren(this.group);

    this.gridHelper = new THREE.GridHelper(this.extent * 2, 20, colors.gridMain, colors.gridSub);
    this.gridHelper.rotation.x = Math.PI / 2;
    (this.gridHelper.material as THREE.Material).depthWrite = false;
    this.group.add(this.gridHelper);

    this.buildThickAxes(colors);

    this.tickGroup = new THREE.Group();
    this.tickGroup.name = 'axes-ticks-group';
    this.group.add(this.tickGroup);
    this.rebuildTicks(this.currentStep);
  }

  /** Update sizes from camera depth and suppress actual screen-space collisions. */
  public updateForCamera(camera: THREE.PerspectiveCamera, height = 800, target?: THREE.Vector3): void {
    const distance = target ? camera.position.distanceTo(target) : camera.position.length();
    const tangent = Math.tan(camera.fov * Math.PI / 360);
    const worldPerPixel = 2 * distance * tangent / Math.max(100, height);
    const pixels = axisLabelPixels(distance);
    const step = axisTickStep(worldPerPixel, pixels);
    let centerChanged = false;
    for (let axis = 0; axis < 3; axis++) {
      const coordinate = target ? target.getComponent(axis) : 0;
      const center = Math.round(coordinate / (step * 8)) * step * 8;
      if (center !== this.tickCenters[axis]) centerChanged = true;
      this.tickCenters[axis] = center;
    }
    if (step !== this.currentStep || centerChanged) this.rebuildTicks(step);
    const width = height * camera.aspect;
    camera.updateMatrixWorld();
    camera.getWorldDirection(this.cameraDirection);
    this.projectedOrigin.set(0, 0, 0).project(camera);
    const originX = (this.projectedOrigin.x + 1) * width / 2;
    const originY = (1 - this.projectedOrigin.y) * height / 2;
    let boxCount = 0;
    // Origin gets priority; axis tips and remaining ticks follow.
    const update = (sprite: THREE.Sprite) => {
      this.depthOffset.copy(sprite.position).sub(camera.position);
      const depth = this.depthOffset.dot(this.cameraDirection);
      this.projected.copy(sprite.position).project(camera);
      const x = (this.projected.x + 1) * width / 2;
      const y = (1 - this.projected.y) * height / 2;
      sprite.visible = depth > camera.near && Math.abs(this.projected.x) < 0.98
        && Math.abs(this.projected.y) < 0.94 && Math.abs(this.projected.z) <= 1;
      if (!sprite.visible) return;
      const quadHeight = 2 * depth * tangent * (pixels * 112 / 72) / height;
      sprite.scale.set(quadHeight * sprite.userData.aspect, quadHeight, 1);
      // Offset in screen space rather than making labels drift as world scale changes.
      sprite.center.set(0.5, 1.0);
      const halfWidth = Math.max(pixels * 0.4, String(sprite.userData.text).length * pixels * 0.32);
      const left = x - halfWidth - 4, right = x + halfWidth + 4;
      const top = y + 2, bottom = y + pixels + 10;
      for (let i = 0; i < boxCount; i++) {
        const box = this.boxes[i]!;
        if (left < box.right && right > box.left && top < box.bottom && bottom > box.top) {
          sprite.visible = false;
          return;
        }
      }
      const box = this.boxes[boxCount] ?? (this.boxes[boxCount] = { left: 0, top: 0, right: 0, bottom: 0 });
      box.left = left; box.top = top; box.right = right; box.bottom = bottom;
      boxCount++;
    };
    if (this.labels[0]) update(this.labels[0]);
    for (const child of this.group.children) {
      if (child instanceof THREE.Sprite) update(child);
      else if (child.name === 'axis-shaft') {
        const scale = Math.max(0.003, Math.min(0.12, worldPerPixel * 1.25)) / 0.12;
        child.scale.set(scale, 1, scale);
      }
    }
    // Label each axis only when adjacent values have enough projected spacing.
    const spacing = Math.max(42, pixels * 2.5);
    for (let axis = 0; axis < 3; axis++) {
      const endpoint = this.endpoints[axis]!.copy(this.axisDirections[axis]!).multiplyScalar(step).project(camera);
      const deltaX = (endpoint.x + 1) * width / 2 - originX;
      const deltaY = (1 - endpoint.y) * height / 2 - originY;
      const stride = Math.max(1, Math.ceil(spacing / Math.max(1, Math.hypot(deltaX, deltaY))));
      for (let i = 1; i < this.labels.length; i++) {
        const sprite = this.labels[i]!;
        if (sprite.userData.axis !== axis) continue;
        if (sprite.userData.tickIndex % stride === 0) update(sprite);
        else sprite.visible = false;
      }
    }
  }

  private rebuildTicks(step: number): void {
    this.currentStep = step;
    disposeChildren(this.tickGroup);
    this.labels.length = 0;
    const colors = this.isDark ? DARK_AXIS_COLORS : LIGHT_AXIS_COLORS;
    const tickLen = step * 0.045;
    const formatter = new Intl.NumberFormat(this.locale, { maximumFractionDigits: 4 });
    const origin = createTextSprite('0', colors.text);
    origin.position.set(0, 0, 0);
    this.tickGroup.add(origin);
    this.labels.push(origin);
    const tickPoints: number[] = [];
    // Limit the number of cached sprites at close zoom; offscreen values are unnecessary.
    for (let axis = 0; axis < 3; axis++) {
      const centerIndex = Math.round(this.tickCenters[axis]! / step);
      for (let offset = 0; offset <= 28; offset++) {
        for (const sign of offset === 0 ? [1] : [1, -1]) {
          const index = centerIndex + offset * sign;
          if (index === 0) continue;
          const value = index * step;
          if (Math.abs(value) >= this.extent) continue;
          const point = this.axisDirections[axis]!.clone().multiplyScalar(value);
          const sprite = createTextSprite(formatter.format(value), colors.text);
          sprite.position.copy(point);
          sprite.userData.axis = axis;
          sprite.userData.tickIndex = index;
          this.tickGroup.add(sprite);
          this.labels.push(sprite);
          if (axis === 0) tickPoints.push(value, -tickLen, 0, value, tickLen, 0);
          else if (axis === 1) tickPoints.push(-tickLen, value, 0, tickLen, value, 0);
          else tickPoints.push(-tickLen, 0, value, tickLen, 0, value);
        }
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(tickPoints, 3));
    const material = new THREE.LineBasicMaterial({
      color: this.isDark ? 0x606880 : 0x94a0b8, depthTest: true, depthWrite: false,
    });
    this.tickGroup.add(new THREE.LineSegments(geometry, material));
  }
}

export function createCoordinateFrame(extent = 50, isDark = true): THREE.Group {
  return new CoordinateFrameManager(extent, isDark).group;
}
