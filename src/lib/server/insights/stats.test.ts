import { describe, it, expect } from 'vitest';
import { mean, sd, pearson, partialR, demeaned, strengthOf, groupZ, brewZ } from './stats';

describe('stats', () => {
  it('mean and population sd', () => {
    expect(mean([2, 4, 6])).toBe(4);
    expect(mean([])).toBeNaN();
    expect(sd([2, 4, 4, 4, 5, 5, 7, 9])).toBe(2);
  });
  it('pearson', () => {
    expect(pearson([1, 2, 3], [2, 4, 6])).toBeCloseTo(1);
    expect(pearson([1, 1, 1], [1, 2, 3])).toBeNull();
    expect(pearson([1, 2], [1, 2])).toBeNull();
  });
  it('partialR removes a planted confounder', () => {
    // deterministic pseudo-noise (LCG)
    let s = 7;
    const noise = () => ((s = (s * 1103515245 + 12345) % 2147483648) / 2147483648 - 0.5) * 0.4;
    const z = Array.from({ length: 200 }, (_, i) => i / 10);
    const x = z.map((v) => v + noise() * 10), y = z.map((v) => v + noise() * 10);
    expect(pearson(x, y)!).toBeGreaterThan(0.9);
    expect(Math.abs(partialR(x, y, z)!)).toBeLessThan(0.1);
  });
  it('demeaned subtracts each bag mean; drops unrated and bagless', () => {
    const rows = [
      { coffeeId: 1, rating: 8 }, { coffeeId: 1, rating: 9 }, { coffeeId: 2, rating: 5 },
      { coffeeId: 2, rating: 7 }, { coffeeId: 2, rating: null }, { coffeeId: null, rating: 9 }
    ];
    expect(demeaned(rows).map((r) => r.dm)).toEqual([-0.5, 0.5, -1, 1]);
  });
  it('strengthOf', () => {
    expect(strengthOf(2.1, true)).toBe('solid');
    expect(strengthOf(-2, true)).toBe('solid');
    expect(strengthOf(1.7, true)).toBe('hint');
    expect(strengthOf(1.0, true)).toBe('early');
    expect(strengthOf(5, false)).toBe('hidden');
  });
  it('strengthOf over a multiple-comparison set: a Bonferroni bar', () => {
    expect(strengthOf(2.1, true, 7)).toBe('early'); // p .036 × 7 = .25
    expect(strengthOf(2.5, true, 7)).toBe('hint'); // p .012 × 7 = .087
    expect(strengthOf(-3, true, 7)).toBe('solid'); // p .0027 × 7 = .019
    expect(strengthOf(2, true, 1)).toBe('solid');
    expect(strengthOf(1.5, true, 1)).toBe('hint');
  });
  it('groupZ: all bags [6..10] mean 8 sd sqrt2; group [9,10] mean 9.5 -> 1.5 / (sqrt2/sqrt2) = 1.5', () =>
    expect(groupZ([9, 10], [6, 7, 8, 9, 10])).toBeCloseTo(1.5));
  it('brewZ: a mean 8, b mean 7, n 2+2, sd 0.5 -> 1 / (0.5 * 1) = 2', () =>
    expect(brewZ([7.5, 8.5], [6.5, 7.5], 0.5)).toBeCloseTo(2));
});
