import { describe, it, expect } from 'vitest';
import { countsForRating, ratedGroups, type Rated } from './ratings';

type B = Rated & { g: string };
const b = (g: string, coffeeId: number, rating: number | null, localDate = '2026-07-01'): B => ({ g, coffeeId, rating, localDate });

describe('countsForRating', () => {
  it('Current drops brews before 2026-06-01; All keeps them', () => {
    expect(countsForRating(b('x', 1, 3, '2026-05-31'), 'current')).toBe(false);
    expect(countsForRating(b('x', 1, 3, '2026-06-01'), 'current')).toBe(true);
    expect(countsForRating(b('x', 1, 3, '2026-05-31'), 'all')).toBe(true);
  });
  it('unrated brews never count', () => expect(countsForRating(b('x', 1, null), 'all')).toBe(false));
});

describe('ratedGroups', () => {
  // A: one bag, two brews (8, 10) → one point of 9. B: ten bags at 8.5. C: ten bags at 5.
  const brews = [
    b('A', 1, 8), b('A', 1, 10),
    ...Array.from({ length: 10 }, (_, i) => b('B', 11 + i, 8.5)),
    ...Array.from({ length: 10 }, (_, i) => b('C', 21 + i, 5))
  ];
  const key = (x: B) => x.g;

  it('counts a bag once, however many brews', () => {
    const a = ratedGroups(brews, key, 'all', 'raw').find((g) => g.label === 'A')!;
    expect(a).toMatchObject({ mean: 9, bags: 1, brews: 2, sample: { bags: 1, brews: 2, small: true } });
  });

  it('sample: pooled rule over the group (3 bags and 10 brews)', () => {
    const g = ratedGroups(brews, key, 'all', 'raw');
    expect(g.find((x) => x.label === 'B')!.sample).toEqual({ bags: 10, brews: 10, small: false });
    const thin = ratedGroups([b('D', 1, 8), b('D', 2, 8), b('D', 3, 8)], key, 'all', 'raw')[0];
    expect(thin.sample).toEqual({ bags: 3, brews: 3, small: true }); // 3 bags, but under 10 brews
  });

  it('adjusted shrinks small groups toward the overall bag mean (K = 5)', () => {
    // overall = (9 + 85 + 50) / 21 = 6.857
    const g = Object.fromEntries(ratedGroups(brews, key, 'all', 'adjusted').map((x) => [x.label, x]));
    expect(g.A.adjusted).toBeCloseTo((9 + 5 * (144 / 21)) / 6, 6);
    expect(g.B.adjusted).toBeCloseTo((85 + 5 * (144 / 21)) / 15, 6);
    expect(g.B.sample.small).toBe(false);
  });

  it('adjusted ranks the ten-bag group over the one lucky bag; raw does not', () => {
    expect(ratedGroups(brews, key, 'all', 'adjusted').map((g) => g.label)).toEqual(['B', 'A', 'C']);
    expect(ratedGroups(brews, key, 'all', 'raw').map((g) => g.label)).toEqual(['A', 'B', 'C']); // no minimum
  });

  it('Current leaves early ratings out', () => {
    const early = [b('A', 1, 2, '2026-05-01'), b('A', 2, 9)];
    expect(ratedGroups(early, key, 'current', 'raw')[0]).toMatchObject({ mean: 9, bags: 1 });
    expect(ratedGroups(early, key, 'all', 'raw')[0]).toMatchObject({ mean: 5.5, bags: 2 });
  });

  it('skips brews with no key, no coffee or no rating', () => {
    const odd = [b('A', 1, null), { ...b('A', 1, 7), coffeeId: null }];
    expect(ratedGroups(odd, key, 'all', 'raw')).toEqual([]);
    expect(ratedGroups([b('A', 1, 7)], () => null, 'all', 'raw')).toEqual([]);
  });
  it('k2 shrinks less than adjusted (K = 2 vs 5)', () => {
    const o = 144 / 21;
    const get = (avg: 'raw' | 'k2' | 'adjusted') => ratedGroups(brews, key, 'all', avg).find((g) => g.label === 'A')!.adjusted;
    expect(get('k2')).toBeCloseTo((9 + 2 * o) / 3, 6);
    expect(get('raw')).toBe(9);
    expect(get('k2')).toBeGreaterThan(get('adjusted'));
  });
  it('best: highest brew, ties by brews at the max, then mean; Current excludes a pre-cutoff 10', () => {
    const t = [
      b('P', 1, 9), b('P', 1, 9), b('P', 2, 5), // 9 twice
      b('Q', 3, 9), b('Q', 4, 9.5),             // 9.5 once
      b('R', 5, 9), b('R', 6, 9), b('R', 7, 2), // 9 twice, lower mean than P
      b('X', 8, 10, '2026-05-01')
    ];
    expect(ratedGroups(t, key, 'all', 'best').map((g) => [g.label, g.best, g.atBest])).toEqual([
      ['X', 10, 1], ['Q', 9.5, 1], ['P', 9, 2], ['R', 9, 2]
    ]);
    expect(ratedGroups(t, key, 'current', 'best').map((g) => g.label)).toEqual(['Q', 'P', 'R']);
  });
  it('best-k*: one lucky 10 loses to repeated 9.5s; K = 2 vs 5; overall = mean of all brews', () => {
    const t = [b('L', 1, 10), ...[2, 3, 4, 5].map((i) => b('R', i, 9.5)), ...[6, 7, 8, 9].map((i) => b('Z', i, 5))];
    const o = (10 + 4 * 9.5 + 4 * 5) / 9;
    const g = (avg: 'best' | 'best-k2' | 'best-k5') => Object.fromEntries(ratedGroups(t, key, 'all', avg).map((x) => [x.label, x]));
    expect(ratedGroups(t, key, 'all', 'best')[0].label).toBe('L'); // plain best: the lucky 10 tops
    expect(g('best-k2').L.value).toBeCloseTo((10 + 2 * o) / 3, 6);
    expect(g('best-k2').R.value).toBeCloseTo((4 * 9.5 + 2 * o) / 6, 6);
    expect(ratedGroups(t, key, 'all', 'best-k2')[0].label).toBe('R');
    expect(g('best-k5').R.value).toBeCloseTo((4 * 9.5 + 5 * o) / 9, 6);
  });
  it('best-k* ties: more hits, then raw mean', () => {
    const t = [b('P', 1, 9), b('P', 2, 9), b('Q', 3, 9), b('Q', 4, 9), b('Q', 5, 1)];
    // equal best and hits: P's mean (9) beats Q's (6.33)
    expect(ratedGroups(t, key, 'all', 'best-k5').map((x) => x.label)).toEqual(['P', 'Q']);
  });
});
