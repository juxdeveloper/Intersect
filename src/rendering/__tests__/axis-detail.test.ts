import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { CoordinateFrameManager, axisLabelPixels } from '../grid-axes';

describe('Projected axis readability', () => {
  it('grows labels modestly with zoom and caps both extremes', () => {
    expect(axisLabelPixels(5)).toBeGreaterThan(axisLabelPixels(40));
    expect(axisLabelPixels(0.00001)).toBe(19);
    expect(axisLabelPixels(10000)).toBe(13);
  });

  it('shows odd numbers at close zoom without overlapping visible label anchors', () => {
    const frame = new CoordinateFrameManager();
    const camera = new THREE.PerspectiveCamera(45, 1.6, 0.01, 10000);
    camera.up.set(0, 0, 1);
    camera.position.set(5, -6, 4);
    camera.lookAt(0, 0, 0);
    frame.updateForCamera(camera, 800, new THREE.Vector3());
    const labels = frame.group.getObjectByName('axes-ticks-group')!.children
      .filter((item): item is THREE.Sprite => item instanceof THREE.Sprite && item.visible);
    expect(labels.some((item) => ['1', '-1', '3', '-3'].includes(item.userData.text))).toBe(true);
    expect(labels.every((item) => item.scale.y < 1)).toBe(true);
    frame.dispose();
  });

  it('releases previous axis geometries and textures on theme changes', () => {
    const frame = new CoordinateFrameManager();
    const mesh = frame.group.children.find((item): item is THREE.Mesh => item instanceof THREE.Mesh)!;
    const dispose = vi.spyOn(mesh.geometry, 'dispose');
    frame.setTheme(false);
    expect(dispose).toHaveBeenCalledOnce();
    frame.dispose();
    expect(frame.group.children).toHaveLength(0);
  });
});
