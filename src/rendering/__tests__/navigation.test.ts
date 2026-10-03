import { describe, expect, it } from 'vitest';
import { navigationDistances } from '../navigation';

describe('Viewport zoom boundaries', () => {
  it('limits zoom-out to a useful overview instead of the previous 3500-unit distance', () => {
    const limits = navigationDistances(1.6, 45);
    expect(limits.max).toBeLessThan(65);
    expect(limits.max / limits.framing).toBeCloseTo(1.4);
    expect(limits.min).toBeLessThan(1);
  });
  it('allows portrait framing and larger intersections without unbounded zoom', () => {
    const landscape = navigationDistances(1.6, 45);
    const portrait = navigationDistances(0.6, 45);
    expect(portrait.framing).toBeCloseTo(landscape.framing / 0.6);
    const large = navigationDistances(1.6, 45, 200);
    expect(large.max).toBeGreaterThan(landscape.max);
    expect(large.min).toBeLessThan(large.framing);
  });
});
