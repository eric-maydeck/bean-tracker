import { describe, it, expect } from 'vitest';
import { likeGaps } from './likeGroup';
import type { BrewFact } from './facts';

let n = 0;
const brew = (o: Partial<BrewFact>): BrewFact => ({
  id: ++n, coffeeId: 1, localTime: '2026-09-15T08:00', localDate: '2026-09-15', backfilled: false, dose: null, rating: null, roaster: null,
  origin: null, processGroup: 'Washed', roastLevel: null, decaf: false, brewer: null, brewerType: 'pourover', waterG: null, ratio: null,
  grind: null, dripper: null, filter: null, water: null, waterProfile: null, restDays: null, costPerBrew: null, brewTimeSeconds: null,
  bloomSeconds: null, grinder: null, hasNote: false, brewIndex: 0, tempC: null, ...o
});
// k brews of bag `id` at rating r, with the bag's coffee fields.
const bag = (id: number, r: number, f: Partial<BrewFact>, k = 4) => Array.from({ length: k }, () => brew({ coffeeId: id, rating: r, ...f }));
const LWKS = { roastLevel: 'Light', processGroup: 'Washed' as const, origin: 'Kenya', roaster: 'Sey' };

describe('likeGaps', () => {
  it('the narrowest step whose other bags pass the pooled rule', () => {
    const rows = [...bag(1, 9, LWKS), ...bag(2, 8, LWKS), ...bag(3, 8, LWKS), ...bag(4, 8, LWKS)];
    expect(likeGaps(rows).get(1)).toMatchObject({ label: 'Washed Light coffees from Kenya by Sey', score: 9, groupMean: 8, gap: 1, rank: 1, of: 4 });
  });
  it('self-exclusion falls back to a wider step', () => {
    // Only 2 other Kenya/Sey bags: 3 with itself, but 2 without → roast + process + roaster.
    const rows = [...bag(1, 9, LWKS), ...bag(2, 8, LWKS), ...bag(3, 8, LWKS), ...bag(4, 7, { ...LWKS, origin: 'Peru' })];
    expect(likeGaps(rows).get(1)!.label).toBe('Washed Light coffees by Sey');
  });
  it('falls back to roast level alone; none passes → no entry', () => {
    const rows = [...bag(1, 9, LWKS), ...bag(2, 8, { roastLevel: 'Light', processGroup: 'Natural' }),
      ...bag(3, 8, { roastLevel: 'Light', processGroup: 'Natural' }), ...bag(4, 8, { roastLevel: 'Light', processGroup: 'Natural' })];
    expect(likeGaps(rows).get(1)!.label).toBe('Light coffees');
    expect(likeGaps(rows.slice(0, 12)).get(1)).toBeUndefined(); // 2 other bags only
  });
  it('no roast level, no group', () => {
    const rows = [...bag(1, 9, { ...LWKS, roastLevel: null }), ...[2, 3, 4].flatMap((id) => bag(id, 8, LWKS))];
    expect(likeGaps(rows).has(1)).toBe(false);
  });
  it('unknown process is skipped in the ladder', () => {
    const f = { roastLevel: 'Light', processGroup: 'Other / Unknown' as const };
    const rows = [...bag(1, 9, f), ...[2, 3, 4].flatMap((id) => bag(id, 8, { roastLevel: 'Light', processGroup: 'Natural' }))];
    expect(likeGaps(rows).get(1)!.label).toBe('Light coffees');
  });
  it('ties share a rank; the sample is the bag\u2019s own', () => {
    const rows = [...bag(1, 8, LWKS, 3), ...bag(2, 8, LWKS), ...bag(3, 9, LWKS), ...bag(4, 7, LWKS)];
    const l = likeGaps(rows);
    expect([l.get(1)!.rank, l.get(2)!.rank, l.get(3)!.rank]).toEqual([2, 2, 1]);
    expect(l.get(1)!.sample).toEqual({ bags: 1, brews: 3, small: true, one: true });
  });
});
