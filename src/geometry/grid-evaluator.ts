import type { ExpressionNode } from '../contracts/expressions';
import type { WorldBounds } from '../contracts/bounds';
import { compileNumericExpression, expressionDependencies } from './numeric-expression';

/** Bounded per-mesh caches for AST subexpressions depending on one or two axes.
 * Three-dimensional expressions still evaluate the original operation order.
 * No quality reduction, approximation, executable strings, or persistent cache.
 */
export function compileGridEvaluator(node: ExpressionNode, bounds: WorldBounds, resolution: number) {
  const size = resolution + 1;
  const axes = ['x', 'y', 'z'] as const;
  const coordinates = axes.map((axis) => {
    const step = (bounds[axis].max - bounds[axis].min) / resolution;
    return Float64Array.from({ length: size }, (_, index) => bounds[axis].min + index * step);
  });
  const env = { x: bounds.x.min, y: bounds.y.min, z: bounds.z.min };
  let ix = 0, iy = 0, iz = 0;
  let cacheBytes = 0;
  const maximumCacheBytes = 4 * 1024 * 1024;
  const evaluator = compileNumericExpression(node, (expression, evaluate) => {
    if (expression.type === 'number' || expression.type === 'symbol') return evaluate;
    const dependencies = expressionDependencies([expression]);
    const used = axes.map((axis) => dependencies.has(axis));
    const dimensions = used.filter(Boolean).length;
    if (dimensions === 0 || dimensions === 3
      || [...dependencies].some((name) => !['x', 'y', 'z', 'pi', 'π', 'e', 'exponentiale'].includes(name))) return evaluate;
    const nx = used[0] ? size : 1, ny = used[1] ? size : 1, nz = used[2] ? size : 1;
    const bytes = nx * ny * nz * Float64Array.BYTES_PER_ELEMENT;
    if (cacheBytes + bytes > maximumCacheBytes) return evaluate;
    cacheBytes += bytes;
    const values = new Float64Array(nx * ny * nz);
    for (ix = 0; ix < nx; ix++) {
      env.x = coordinates[0]![ix]!;
      for (iy = 0; iy < ny; iy++) {
        env.y = coordinates[1]![iy]!;
        for (iz = 0; iz < nz; iz++) {
          env.z = coordinates[2]![iz]!;
          values[(ix * ny + iy) * nz + iz] = evaluate(env);
        }
      }
    }
    return () => values[((used[0] ? ix : 0) * ny + (used[1] ? iy : 0)) * nz + (used[2] ? iz : 0)]!;
  });
  if (!evaluator) return null;
  return (xIndex: number, yIndex: number, zIndex: number) => {
    ix = xIndex; iy = yIndex; iz = zIndex;
    env.x = coordinates[0]![ix]!; env.y = coordinates[1]![iy]!; env.z = coordinates[2]![iz]!;
    return evaluator(env);
  };
}
