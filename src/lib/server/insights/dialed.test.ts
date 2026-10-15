import { describe, it, expect } from 'vitest';
import { dialInIds, onceDialed, settleAt, skipCount } from './dialed';
import type { BrewFact } from './facts';

let n = 0;
const brew = (o: Partial<BrewFact>): BrewFact => ({
  id: ++n, coffeeId: 1, localTime: '2026-09-15T08:00', localDate: '2026-09-15', backfilled: false, dose: null, rating: null, roaster: null,
  origin: null, processGroup: 'Washed', roastLevel: null, decaf: false, brewer: null, brewerType: 'pourover', waterG: null, ratio: null,
  grind: null, dripper: null, filter: null, water: null, waterProfile: null, restDays: null, costPerBrew: null, brewTimeSeconds: null,
  bloomSeconds: null, grinder: null, hasNote: false, brewIndex: 0, tempC: null, ...o
});

describe('settleAt', () => {
  it('first brew within 0.5 of the best half', () => {
    expect(settleAt([6, 7, 8.5, 9, 9])).toBe(3); // best half 9, 9, 8.5 → 8.83; 8.5 ≥ 8.33
    expect(settleAt([9, 6, 6, 6])).toBe(1);
  });
});

describe('skipCount tiers', () => {
  it('1-3 rated brews: none (3/4 edge)', () => {
    expect(skipCount([5, 6, 9])).toBe(0);
    expect(skipCount([5, 6, 9, 9])).toBe(2);
  });
  it('4-7: the first 2 (7/8 edge)', () => {
    expect(skipCount([5, 6, 9, 9, 9, 9, 9])).toBe(2);
    expect(skipCount([5, 6, 9, 9, 9, 9, 9, 9])).toBe(2); // 8+: settles at #3 → skip 2
  });
  it('8+: from the settle point, at least 1', () => expect(skipCount([9, 9, 9, 9, 9, 9, 9, 9])).toBe(1));
  it('8+: at most half', () => expect(skipCount([5, 5, 5, 5, 5, 5, 9, 9])).toBe(4)); // settles at #7 → clamp floor(8/2)
});

describe('dialInIds', () => {
  it("each bag's first rated brews in time order; unrated and unlinked brews never count", () => {
    const bs = [
      brew({ coffeeId: 1, rating: 5 }), brew({ coffeeId: 2, rating: 6 }), brew({ coffeeId: 1, rating: null }),
      brew({ coffeeId: 1, rating: 0 }), brew({ coffeeId: 1, rating: 6 }), brew({ coffeeId: null, rating: 2 }),
      brew({ coffeeId: 1, rating: 9 }), brew({ coffeeId: 1, rating: 9 })
    ];
    expect([...dialInIds(bs)]).toEqual([bs[0].id, bs[4].id]); // bag 1: 4 rated → skip 2; bag 2: 1 rated → none
  });
  it('onceDialed nulls only those ratings and keeps every brew', () => {
    const bs = [brew({ rating: 5 }), brew({ rating: 9 })];
    const out = onceDialed(bs, new Set([bs[0].id]));
    expect(out.map((b) => b.rating)).toEqual([null, 9]);
    expect(out[0]).toMatchObject({ id: bs[0].id, dose: bs[0].dose, localDate: bs[0].localDate });
    expect(bs[0].rating).toBe(5); // input untouched
  });
});
