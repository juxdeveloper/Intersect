/**
 * Surface Coordinate Guide Curves Generator for Intersect.
 *
 * Implements Section 4.C (GeoGebra-style Coordinate Guides):
 * - Computes coordinate-section guide curves by slicing surface meshes
 *   with a sparse family of coordinate planes (e.g. constant z, constant x, constant y).
 * - Guaranteed to lie exactly on the extracted surface geometry.
 * - Naturally respects domain obligations, gaps, and disconnected sheets.
 * - Produces flat Float32Array line segment positions [x1,y1,z1, x2,y2,z2, ...]
 *   for fast rendering as THREE.LineSegments with depth bias.
 */

import type { WorldBounds } from '../contracts/bounds';

export interface GuideCurvesBuffer {
  /** Flat line segments positions [x1, y1, z1, x2, y2, z2, ...] */
  readonly positions: Float32Array;
  readonly segmentCount: number;
}

/**
 * Computes coordinate section lines by intersecting triangle faces with slicing planes.
 */
export function generateCoordinateGuides(
  positions: Float32Array,
  indices: Uint32Array,
  bounds: WorldBounds | null,
  maxSlicesPerAxis = 10,
): GuideCurvesBuffer {
  if (!bounds || indices.length === 0 || positions.length === 0) {
    return { positions: new Float32Array(0), segmentCount: 0 };
  }

  const { x: bx, y: by, z: bz } = bounds;
  const xSpan = bx.max - bx.min;
  const ySpan = by.max - by.min;
  const zSpan = bz.max - bz.min;

  // Determine slice planes along axes with non-trivial span
  const zPlanes: number[] = [];
  const xPlanes: number[] = [];
  const yPlanes: number[] = [];

  const addPlanes = (min: number, _max: number, span: number, planes: number[]) => {
    if (span < 1e-3) return;
    const count = Math.min(maxSlicesPerAxis, Math.max(4, Math.round(span / 8)));
    const step = span / (count + 1);
    for (let i = 1; i <= count; i++) {
      planes.push(min + i * step);
    }
  };

  addPlanes(bz.min, bz.max, zSpan, zPlanes);
  // Pick at most ONE horizontal slicing family (X or Y) to form a clean orthogonal 2D coordinate grid (avoiding triangular lattices)
  if (xSpan >= ySpan && xSpan >= 0.5) {
    addPlanes(bx.min, bx.max, xSpan, xPlanes);
  } else if (ySpan >= 0.5) {
    addPlanes(by.min, by.max, ySpan, yPlanes);
  }

  const outSegments: number[] = [];
  const numTriangles = Math.floor(indices.length / 3);

  // Helper to slice a triangle with plane: coord == planeVal (axis 0=x, 1=y, 2=z)
  const sliceTriangle = (
    i0: number,
    i1: number,
    i2: number,
    axis: 0 | 1 | 2,
    planeVal: number,
  ) => {
    const p0x = positions[i0 * 3];
    const p0y = positions[i0 * 3 + 1];
    const p0z = positions[i0 * 3 + 2];

    const p1x = positions[i1 * 3];
    const p1y = positions[i1 * 3 + 1];
    const p1z = positions[i1 * 3 + 2];

    const p2x = positions[i2 * 3];
    const p2y = positions[i2 * 3 + 1];
    const p2z = positions[i2 * 3 + 2];

    if (
      p0x === undefined || p0y === undefined || p0z === undefined ||
      p1x === undefined || p1y === undefined || p1z === undefined ||
      p2x === undefined || p2y === undefined || p2z === undefined
    ) {
      return;
    }

    const c0 = axis === 0 ? p0x : axis === 1 ? p0y : p0z;
    const c1 = axis === 0 ? p1x : axis === 1 ? p1y : p1z;
    const c2 = axis === 0 ? p2x : axis === 1 ? p2y : p2z;

    const d0 = c0 - planeVal;
    const d1 = c1 - planeVal;
    const d2 = c2 - planeVal;

    // Check if triangle straddles the plane
    if ((d0 > 0 && d1 > 0 && d2 > 0) || (d0 < 0 && d1 < 0 && d2 < 0)) {
      return;
    }

    const pts: [number, number, number][] = [];

    // Check edge 0-1
    if ((d0 >= 0 && d1 <= 0) || (d0 <= 0 && d1 >= 0)) {
      const denom = d0 - d1;
      if (Math.abs(denom) > 1e-12) {
        const t = d0 / denom;
        pts.push([
          p0x + t * (p1x - p0x),
          p0y + t * (p1y - p0y),
          p0z + t * (p1z - p0z),
        ]);
      }
    }

    // Check edge 1-2
    if ((d1 >= 0 && d2 <= 0) || (d1 <= 0 && d2 >= 0)) {
      const denom = d1 - d2;
      if (Math.abs(denom) > 1e-12) {
        const t = d1 / denom;
        pts.push([
          p1x + t * (p2x - p1x),
          p1y + t * (p2y - p1y),
          p1z + t * (p2z - p1z),
        ]);
      }
    }

    // Check edge 2-0
    if ((d2 >= 0 && d0 <= 0) || (d2 <= 0 && d0 >= 0)) {
      const denom = d2 - d0;
      if (Math.abs(denom) > 1e-12) {
        const t = d2 / denom;
        pts.push([
          p2x + t * (p0x - p2x),
          p2y + t * (p0y - p2y),
          p2z + t * (p0z - p2z),
        ]);
      }
    }

    if (pts.length >= 2) {
      const pA = pts[0];
      const pB = pts[1];
      if (pA && pB) {
        // Only add if non-degenerate segment
        const distSq = (pA[0] - pB[0]) ** 2 + (pA[1] - pB[1]) ** 2 + (pA[2] - pB[2]) ** 2;
        if (distSq > 1e-8) {
          outSegments.push(pA[0], pA[1], pA[2], pB[0], pB[1], pB[2]);
        }
      }
    }
  };

  for (let t = 0; t < numTriangles; t++) {
    const i0 = indices[t * 3];
    const i1 = indices[t * 3 + 1];
    const i2 = indices[t * 3 + 2];
    if (i0 === undefined || i1 === undefined || i2 === undefined) continue;

    for (let p = 0; p < zPlanes.length; p++) {
      const plane = zPlanes[p];
      if (plane !== undefined) sliceTriangle(i0, i1, i2, 2, plane);
    }
    for (let p = 0; p < xPlanes.length; p++) {
      const plane = xPlanes[p];
      if (plane !== undefined) sliceTriangle(i0, i1, i2, 0, plane);
    }
    for (let p = 0; p < yPlanes.length; p++) {
      const plane = yPlanes[p];
      if (plane !== undefined) sliceTriangle(i0, i1, i2, 1, plane);
    }
  }

  const positionsArr = new Float32Array(outSegments);
  return {
    positions: positionsArr,
    segmentCount: Math.floor(positionsArr.length / 6),
  };
}
