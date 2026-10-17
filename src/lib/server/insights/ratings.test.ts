import { describe, it, expect } from 'vitest';
import { countsForRating, ratedGroups, roastMix, type Rated } from './ratings';

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

  // Weights n/(n+2): A's 2-brew bag 1/2, every 1-brew bag 1/3. overall = weighted mean of the bag means.
  const o = (0.5 * 9 + (10 / 3) * 8.5 + (10 / 3) * 5) / (0.5 + 20 / 3);
  it('adjusted shrinks small groups toward the overall bag mean (K = 5 bags, in weight)', () => {
    const g = Object.fromEntries(ratedGroups(brews, key, 'all', 'adjusted').map((x) => [x.label, x]));
    expect(g.A.adjusted).toBeCloseTo((0.5 * 9 + 5 * o) / 5.5, 6);
    expect(g.B.adjusted).toBeCloseTo(((10 / 3) * 8.5 + 5 * o) / (10 / 3 + 5), 6);
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
    const get = (avg: 'raw' | 'k2' | 'adjusted') => ratedGroups(brews, key, 'all', avg).find((g) => g.label === 'A')!.adjusted;
    expect(get('k2')).toBeCloseTo((0.5 * 9 + 2 * o) / 2.5, 6);
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

describe('roastMix', () => {
  // Each bag: four brews at one rating (a full bag), so its bag mean is that rating; `bags` bags per level spread evenly ±spread.
  let id = 0;
  const level = (roastLevel: string, at: number, spread = 0.5, bags = 5) =>
    Array.from({ length: bags }, (_, i) => spread * (-1 + (2 * i) / (bags - 1))).flatMap((o) => {
      const coffeeId = ++id;
      return [0, 1, 2, 3].map(() => ({ coffeeId, rating: at + o, localDate: '2026-07-01', roastLevel }));
    });
  const pair = (gap: number, spread = 0.5, bags = 5) => [...level('Medium', 7, spread, bags), ...level('Light', 7 + gap, spread, bags)];

  it('names every qualifying level, best first, when z ≥ 2 and the gap ≥ 0.5', () => {
    expect(roastMix(pair(0.7), 'all')).toEqual([{ roast: 'Light', mean: expect.closeTo(7.7) }, { roast: 'Medium', mean: expect.closeTo(7) }]);
  });
  it('z threshold: 2.05 shows, 1.94 (gap 0.55) does not', () => {
    expect(roastMix(pair(0.6), 'all')).not.toBeNull();
    expect(roastMix(pair(0.55), 'all')).toBeNull();
  });
  it('gap threshold: 0.5 shows (z 2.4), 0.49 does not (z 2.39)', () => {
    expect(roastMix(pair(0.5, 0.3), 'all')).not.toBeNull();
    expect(roastMix(pair(0.49, 0.3), 'all')).toBeNull();
  });
  it('a big sample with a tiny gap stays hidden (40 bags each, gap 0.4, z ≈ 5)', () =>
    expect(roastMix(pair(0.4, 0.5, 40), 'all')).toBeNull());
  it('three levels: highest vs lowest, one test; every qualifying level listed', () => {
    expect(roastMix([...level('Light', 7.8), ...level('Medium', 7.5), ...level('Dark', 7)], 'all')?.map((r) => r.roast))
      .toEqual(['Light', 'Medium', 'Dark']);
  });
  it('a small level is left out (and of the SD)', () => {
    expect(roastMix([...pair(0.7), ...level('Dark', 3, 0.5, 2)], 'all')?.map((r) => r.roast)).toEqual(['Light', 'Medium']);
  });
  it('every bag counts, weighted n/(n+2): a 1-brew Light bag at 6 (1/3) weighs half a 4-brew bag (2/3)', () => {
    const tiny = { coffeeId: 999, rating: 6, localDate: '2026-07-01', roastLevel: 'Light' };
    const light = ((10 / 3) * 9 + (1 / 3) * 6) / (10 / 3 + 1 / 3);
    expect(roastMix([...pair(2), tiny], 'all')?.[0]).toEqual({ roast: 'Light', mean: expect.closeTo(light) });
  });
  it('one level (a Roast filter set) → null', () => expect(roastMix(level('Light', 8), 'all')).toBeNull());
  it('Calibrated ratings leave out early brews; unlinked brews are skipped', () => {
    const early = pair(0.7).map((b) => ({ ...b, localDate: '2026-05-01' }));
    expect(roastMix(early, 'current')).toBeNull();
    expect(roastMix(early.map((b) => ({ ...b, coffeeId: null })), 'all')).toBeNull();
  });
});
