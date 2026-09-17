import { describe, it, expect } from 'vitest';
import { extractImplicitSurface } from '../marching-cubes';
import { GEOMETRY_BUDGET_PRESETS, type GeometryBudget } from '../../contracts/geometry';
import {
  createNumberNode,
  createSymbolNode,
  createOperatorNode,
  createRelationNode,
} from '../../math/ast';
import type { WorldBounds } from '../../contracts/bounds';
import type { DomainObligation } from '../../contracts/expressions';

const REF_REGION_100: WorldBounds = {
  x: { min: -50, max: 50 },
  y: { min: -50, max: 50 },
  z: { min: -50, max: 50 },
};

const LOCAL_REGION_10: WorldBounds = {
  x: { min: -5, max: 5 },
  y: { min: -5, max: 5 },
  z: { min: -5, max: 5 },
};

describe('Intersect V6 Marching Cubes Implicit Surface Extractor', () => {
  const defaultBudget = GEOMETRY_BUDGET_PRESETS.default;

  it('1. Plane z = 0: extracts grid-aligned zero plane with finite buffers and valid unit normals', () => {
    // Residual: z
    const residual = createSymbolNode('z');
    const mesh = extractImplicitSurface(residual, [], LOCAL_REGION_10, defaultBudget);

    expect(mesh.status).toBe('success');
    expect(mesh.vertexCount).toBeGreaterThan(0);
    expect(mesh.triangleCount).toBeGreaterThan(0);
    expect(mesh.boundingBox).not.toBeNull();

    // All z coordinates should be close to 0
    for (let i = 0; i < mesh.vertexCount; i++) {
      const z = mesh.positions[i * 3 + 2]!;
      expect(Math.abs(z)).toBeLessThan(1e-4);

      // Normal should point along +Z or -Z
      const nz = mesh.normals[i * 3 + 2]!;
      expect(Math.abs(Math.abs(nz) - 1)).toBeLessThan(1e-3);
    }
  });

  it('2. Sphere x^2 + y^2 + z^2 = 4: extracts closed sphere with small geometric and residual error', () => {
    // Residual: x^2 + y^2 + z^2 - 4
    const residual = createOperatorNode('Subtract', [
      createOperatorNode('Add', [
        createOperatorNode('Power', [createSymbolNode('x'), createNumberNode(2)]),
        createOperatorNode('Power', [createSymbolNode('y'), createNumberNode(2)]),
        createOperatorNode('Power', [createSymbolNode('z'), createNumberNode(2)]),
      ]),
      createNumberNode(4),
    ]);

    const mesh = extractImplicitSurface(residual, [], LOCAL_REGION_10, defaultBudget);

    expect(mesh.status).toBe('success');
    expect(mesh.vertexCount).toBeGreaterThan(50);
    expect(mesh.triangleCount).toBeGreaterThan(50);
    expect(mesh.boundingBox).not.toBeNull();

    // Every vertex should have radius close to 2 (within marching cubes cell discretization)
    for (let i = 0; i < mesh.vertexCount; i++) {
      const x = mesh.positions[i * 3]!;
      const y = mesh.positions[i * 3 + 1]!;
      const z = mesh.positions[i * 3 + 2]!;
      const r = Math.sqrt(x * x + y * y + z * z);
      expect(r).toBeGreaterThan(1.75);
      expect(r).toBeLessThan(2.25);
    }
    expect(mesh.diagnostics.approxResidualError).toBeDefined();
    expect(mesh.diagnostics.approxResidualError!).toBeLessThan(1.0);
  });

  it('3. Reference Cylinder x^2 + y^2 = 4: detected in initial 100-unit region at default quality', () => {
    // Residual: x^2 + y^2 - 4
    const residual = createOperatorNode('Subtract', [
      createOperatorNode('Add', [
        createOperatorNode('Power', [createSymbolNode('x'), createNumberNode(2)]),
        createOperatorNode('Power', [createSymbolNode('y'), createNumberNode(2)]),
      ]),
      createNumberNode(4),
    ]);

    const mesh = extractImplicitSurface(residual, [], REF_REGION_100, defaultBudget);

    expect(mesh.status).toBe('success');
    expect(mesh.vertexCount).toBeGreaterThan(100);
    expect(mesh.triangleCount).toBeGreaterThan(100);
    expect(mesh.boundingBox).not.toBeNull();

    // Bounding box should span full z dimension [-50, 50] while x, y are confined to ~[-2, 2]
    expect(mesh.boundingBox!.z.min).toBeLessThan(-45);
    expect(mesh.boundingBox!.z.max).toBeGreaterThan(45);
    expect(mesh.boundingBox!.x.min).toBeGreaterThan(-3.5);
    expect(mesh.boundingBox!.x.max).toBeLessThan(3.5);
    expect(mesh.boundingBox!.y.min).toBeGreaterThan(-3.5);
    expect(mesh.boundingBox!.y.max).toBeLessThan(3.5);
  });

  it('4. Reference Plane z = x + y: extracts oblique plane clipped to bounding region', () => {
    // Residual: z - (x + y)
    const residual = createOperatorNode('Subtract', [
      createSymbolNode('z'),
      createOperatorNode('Add', [createSymbolNode('x'), createSymbolNode('y')]),
    ]);

    const mesh = extractImplicitSurface(residual, [], LOCAL_REGION_10, defaultBudget);

    expect(mesh.status).toBe('success');
    expect(mesh.vertexCount).toBeGreaterThan(0);

    for (let i = 0; i < Math.min(20, mesh.vertexCount); i++) {
      const x = mesh.positions[i * 3]!;
      const y = mesh.positions[i * 3 + 1]!;
      const z = mesh.positions[i * 3 + 2]!;
      expect(Math.abs(z - (x + y))).toBeLessThan(1e-3);
    }
  });

  it('5. Shifted and rescaled sphere (x-3)^2 + (y+2)^2 + (z-1)^2 = 9: works without fixture hardcoding', () => {
    // Center at (3, -2, 1), radius 3
    const residual = createOperatorNode('Subtract', [
      createOperatorNode('Add', [
        createOperatorNode('Power', [
          createOperatorNode('Subtract', [createSymbolNode('x'), createNumberNode(3)]),
          createNumberNode(2),
        ]),
        createOperatorNode('Power', [
          createOperatorNode('Add', [createSymbolNode('y'), createNumberNode(2)]),
          createNumberNode(2),
        ]),
        createOperatorNode('Power', [
          createOperatorNode('Subtract', [createSymbolNode('z'), createNumberNode(1)]),
          createNumberNode(2),
        ]),
      ]),
      createNumberNode(9),
    ]);

    const REGION_20: WorldBounds = {
      x: { min: -10, max: 10 },
      y: { min: -10, max: 10 },
      z: { min: -10, max: 10 },
    };

    const mesh = extractImplicitSurface(residual, [], REGION_20, defaultBudget);

    expect(mesh.status).toBe('success');
    expect(mesh.boundingBox).not.toBeNull();
    // Center of bounding box should be near (3, -2, 1)
    const centerX = (mesh.boundingBox!.x.min + mesh.boundingBox!.x.max) / 2;
    const centerY = (mesh.boundingBox!.y.min + mesh.boundingBox!.y.max) / 2;
    const centerZ = (mesh.boundingBox!.z.min + mesh.boundingBox!.z.max) / 2;
    expect(centerX).toBeCloseTo(3, 0.5);
    expect(centerY).toBeCloseTo(-2, 0.5);
    expect(centerZ).toBeCloseTo(1, 0.5);
  });

  it('6. Non-polynomial surface z = sin(x) + cos(y): samples sinusoidal sheet', () => {
    // Residual: z - (sin(x) + cos(y))
    const residual = createOperatorNode('Subtract', [
      createSymbolNode('z'),
      createOperatorNode('Add', [
        createOperatorNode('Sin', [createSymbolNode('x')]),
        createOperatorNode('Cos', [createSymbolNode('y')]),
      ]),
    ]);

    const mesh = extractImplicitSurface(residual, [], LOCAL_REGION_10, defaultBudget);

    expect(mesh.status).toBe('success');
    expect(mesh.vertexCount).toBeGreaterThan(0);
    // z is bounded by [-2, 2]
    expect(mesh.boundingBox!.z.min).toBeGreaterThan(-2.5);
    expect(mesh.boundingBox!.z.max).toBeLessThan(2.5);
  });

  it('7. Pole 1/x = 0: no false sheet at x = 0; empty sampled mesh does not claim proof of emptiness', () => {
    const residual = createOperatorNode('Divide', [
      createNumberNode(1),
      createSymbolNode('x'),
    ]);

    const mesh = extractImplicitSurface(residual, [], LOCAL_REGION_10, defaultBudget);

    // Because 1/x has a pole at x = 0 rather than a true zero, no false sheet should be extracted!
    expect(mesh.status).toBe('no-geometry-detected');
    expect(mesh.vertexCount).toBe(0);
    expect(mesh.triangleCount).toBe(0);
    expect(mesh.diagnostics.poleDiscardedCount).toBeGreaterThan(0);
  });

  it('8. Repeated factor x^2 = 0: tangential zero correctly extracted via safe symbolic power reduction', () => {
    // Residual: x^2 = 0
    const relation = createRelationNode(
      '=',
      createOperatorNode('Power', [createSymbolNode('x'), createNumberNode(2)]),
      createNumberNode(0),
    );

    const mesh = extractImplicitSurface(relation, [], LOCAL_REGION_10, defaultBudget);

    expect(mesh.status).toBe('success');
    expect(mesh.vertexCount).toBeGreaterThan(0);

    // All x positions must be near 0
    for (let i = 0; i < Math.min(20, mesh.vertexCount); i++) {
      const x = mesh.positions[i * 3]!;
      expect(Math.abs(x)).toBeLessThan(1e-3);
    }
  });

  it('9. Rational expression with excluded factor: respects domain exclusion', () => {
    // Residual: (x^2 - 1)/(x - 1) - y = 0 with domain obligation x - 1 != 0
    // Simplified algebraic surface is x + 1 - y = 0, but line x = 1 is excluded.
    const residual = createOperatorNode('Subtract', [
      createOperatorNode('Divide', [
        createOperatorNode('Subtract', [
          createOperatorNode('Power', [createSymbolNode('x'), createNumberNode(2)]),
          createNumberNode(1),
        ]),
        createOperatorNode('Subtract', [createSymbolNode('x'), createNumberNode(1)]),
      ]),
      createSymbolNode('y'),
    ]);

    const obligation: DomainObligation = {
      id: 'ob-den',
      kind: 'nonzero-denominator',
      target: createOperatorNode('Subtract', [createSymbolNode('x'), createNumberNode(1)]),
      description: 'Denominator x - 1 != 0',
    };

    // Use a grid region where x=1 is intersected by grid lines (e.g. [0, 2] with N=50 => dx = 0.04, 1.0 is on a grid plane)
    const regionExcluded: WorldBounds = {
      x: { min: 0, max: 2 },
      y: { min: -5, max: 5 },
      z: { min: -5, max: 5 },
    };
    const budgetExcluded: GeometryBudget = {
      ...defaultBudget,
      gridResolution: 50,
    };

    const mesh = extractImplicitSurface(residual, [obligation], regionExcluded, budgetExcluded);

    expect(mesh.status).toBe('success');
    expect(mesh.diagnostics.poleDiscardedCount).toBeGreaterThan(0);
  });

  it('10. Valid surface outside requested region: returns no-geometry-detected without error', () => {
    // Sphere at (200, 200, 200) with radius 2
    const residual = createOperatorNode('Subtract', [
      createOperatorNode('Add', [
        createOperatorNode('Power', [
          createOperatorNode('Subtract', [createSymbolNode('x'), createNumberNode(200)]),
          createNumberNode(2),
        ]),
        createOperatorNode('Power', [
          createOperatorNode('Subtract', [createSymbolNode('y'), createNumberNode(200)]),
          createNumberNode(2),
        ]),
        createOperatorNode('Power', [
          createOperatorNode('Subtract', [createSymbolNode('z'), createNumberNode(200)]),
          createNumberNode(2),
        ]),
      ]),
      createNumberNode(4),
    ]);

    // Query in [-50, 50]^3
    const mesh = extractImplicitSurface(residual, [], REF_REGION_100, defaultBudget);

    expect(mesh.status).toBe('no-geometry-detected');
    expect(mesh.vertexCount).toBe(0);
    expect(mesh.triangleCount).toBe(0);
  });

  it('11. Enforces resource budget: returns partial status when vertex/cell limits are exhausted', () => {
    const tinyBudget: GeometryBudget = {
      gridResolution: 30,
      maxVerticesPerMesh: 50, // very tiny limit
      maxTrianglesPerMesh: 50,
      maxCurveSamples: 100,
      maxCurveSubdivisionDepth: 4,
      curveGeometricTolerance: 0.1,
      maxDurationMs: 10_000,
    };

    const residual = createSymbolNode('z');
    const mesh = extractImplicitSurface(residual, [], LOCAL_REGION_10, tinyBudget);

    expect(mesh.status).toBe('partial-budget-limited');
    expect(mesh.vertexCount).toBeLessThanOrEqual(60);
  });
});
