import { describe, it, expect } from 'vitest';
import { mean, sd, pearson, partialR, demeaned, strengthOf, brewZ, tCrit, tTail, spearman, rBand } from './stats';

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
  it('brewZ: a mean 8, b mean 7, n 2+2, sd 0.5 -> 1 / (0.5 * 1) = 2', () =>
    expect(brewZ([7.5, 8.5], [6.5, 7.5], 0.5)).toBeCloseTo(2));
});

describe('small samples: Student t', () => {
  it('t for every n: no step at 30, and the normal curve in the limit', () => {
    expect(strengthOf(2.03, true, 1, 29)).toBe(strengthOf(2.03, true, 1, 30)); // both hint (t(28), t(29) need ~2.05)
    expect(2 * tTail(2, 5000)).toBeCloseTo(0.0455, 3); // normal two-sided p at z 2
    expect(strengthOf(2.1, true, 1, 5000)).toBe('solid');
  });
  it('tCrit is the one-sided 5% t value (90% interval)', () => {
    expect(tCrit(2)).toBeCloseTo(2.92, 2);
    expect(tCrit(8)).toBeCloseTo(1.86, 2);
    expect(tCrit(5000)).toBeCloseTo(1.645, 2);
  });
  it('tTail matches t tables', () => {
    expect(2 * tTail(2.132, 4)).toBeCloseTo(0.1, 3); // t(4) two-sided .10
    expect(2 * tTail(2.776, 4)).toBeCloseTo(0.05, 3);
    expect(2 * tTail(12.706, 1)).toBeCloseTo(0.05, 3);
    expect(2 * tTail(2.571, 5)).toBeCloseTo(0.05, 3);
    expect(2 * tTail(2.045, 29)).toBeCloseTo(0.05, 3);
    expect(2 * tTail(0, 7)).toBeCloseTo(1, 9);
  });
  it('5 repeat pairs at +1.19, t 2.11: not Likely (t(4) p .10, Possible); the same z over 30+ units still is', () => {
    expect(strengthOf(2.11, true, 1, 5)).toBe('hint');
    expect(strengthOf(1.8, true, 1, 5)).toBe('early'); // t(4) p .15: over the 1.5 bar's .134
    expect(strengthOf(2.11, true, 1, 30)).toBe('solid');
    expect(strengthOf(2.11, true)).toBe('solid');
  });
  it('Bonferroni still applies on top; under 2 units there is no test', () => {
    expect(strengthOf(4, true, 7, 10)).toBe('solid'); // t(9) one-sided .0016 × 7 = .011 ≤ .023
    expect(strengthOf(3, true, 7, 10)).toBe('hint'); // .0075 × 7 = .052, under .067
    expect(strengthOf(9, true, 1, 1)).toBe('hidden');
  });
});

describe('myth helpers', () => {
  it('spearman: ranks, so one far-out point counts as one step; ties share ranks', () => {
    expect(spearman([1, 2, 3, 4], [10, 20, 30, 1000])).toBeCloseTo(1);
    expect(spearman([1, 2, 3, 100], [4, 3, 2, 1])).toBeCloseTo(-1);
    expect(spearman([1, 1, 2, 2], [1, 1, 2, 2])).toBeCloseTo(1);
  });
  it('rBand: 2 SE of r, narrower near ±1', () => {
    expect(rBand(103)).toBeCloseTo(0.2);
    expect(rBand(103, 0.5)).toBeCloseTo(0.15);
  });
});
