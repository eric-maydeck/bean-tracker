import { describe, it, expect } from 'vitest';
import { timeToOpen, waitWindow } from './freshness';
import type { BagFact, BrewFact } from './facts';

const P = { start: '2026-09-01', end: '2026-09-30' };
const bag = (o: Partial<BagFact>): BagFact => ({
  id: 1, status: 'open', purchaseDate: '2026-08-01', cost: null, amountG: null, roaster: 'R', name: 'C', slug: null, processing: null,
  origin: null, processGroup: 'Washed', roastLevel: null, decaf: false, firstBrew: null, lastBrew: null, bagRating: null,
  subscriptionId: null, ...o
});
const brew = (o: Partial<BrewFact>): BrewFact => ({ id: 1, coffeeId: 1, roaster: 'R', localDate: '2026-09-10', rating: 8, dose: 18, brewIndex: 1, restDays: null, ...o }) as BrewFact;

describe('timeToOpen: the open day is the first brew', () => {
  it('counts bags first brewed in the Period, whatever their opened date', () => {
    const t = timeToOpen([
      bag({ id: 1, firstBrew: '2026-09-10', openedDate: '2026-09-20' }), // Aug 1 → Sep 10: 40
      bag({ id: 2, firstBrew: '2026-09-02' }), // no opened date: still counts (32)
      bag({ id: 3, firstBrew: '2026-10-05' }), // outside the Period
      bag({ id: 4 }) // never brewed
    ], P);
    expect(t.toOpen).toMatchObject({ median: 36, n: 2 });
  });
  it('a frozen bag nets the freezer; no roast date or a negative rest is left out', () => {
    const t = timeToOpen([
      bag({ id: 1, firstBrew: '2026-09-11', frozenStart: '2026-08-11', frozenEnd: '2026-08-21' }), // 41 − 10
      bag({ id: 2, firstBrew: '2026-09-11', purchaseDate: null }),
      bag({ id: 3, firstBrew: '2026-09-10', purchaseDate: '2026-09-20' })
    ], P);
    expect(t.toOpen).toMatchObject({ median: 31, n: 1 });
  });
  it('days open: first brew to last brew inclusive, finished bags with the last brew in the Period', () => {
    const t = timeToOpen([
      bag({ id: 1, status: 'archive', firstBrew: '2026-09-02', lastBrew: '2026-09-10' }),
      bag({ id: 2, status: 'open', firstBrew: '2026-09-02', lastBrew: '2026-09-10' }),
      bag({ id: 3, status: 'archive', firstBrew: '2026-08-02', lastBrew: '2026-10-10' })
    ], P);
    expect(t.daysOpen).toMatchObject({ median: 9, n: 1 });
  });
  it('by roaster / process: n desc, top 5', () => {
    const bs = 'ABCDEFG'.split('').flatMap((r, i) => Array.from({ length: i === 0 ? 2 : 1 }, (_, k) => bag({ id: i * 10 + k + 1, roaster: r, firstBrew: '2026-09-10' })));
    const t = timeToOpen(bs, P);
    expect(t.byRoaster).toHaveLength(5);
    expect(t.byRoaster[0]).toMatchObject({ key: 'A', n: 2 });
    expect(t.byProcess).toEqual([expect.objectContaining({ key: 'Washed', n: 8 })]);
  });
  it('empty: nulls', () => {
    const t = timeToOpen([], P);
    expect([t.toOpen.median, t.daysOpen.median, t.byRoaster]).toEqual([null, null, []]);
  });
});

describe('waitWindow', () => {
  const ctx = { period: P, ratings: 'all' as const };
  it('rates the Period by the bucket of each bag\'s first brew; window shares sum to 1', () => {
    const bs = [bag({ id: 1, restLow: 7, restHigh: 21 }), bag({ id: 2, restLow: 7, restHigh: 21 }), bag({ id: 3 })];
    const br = [
      brew({ id: 1, coffeeId: 1, restDays: 5, rating: 6 }), brew({ id: 2, coffeeId: 1, brewIndex: 2, restDays: 30, rating: 8 }),
      brew({ id: 3, coffeeId: 2, restDays: 10, rating: 9 }), brew({ id: 4, coffeeId: 3, restDays: 40, rating: 7 })
    ];
    const f = waitWindow(br, br, bs, ctx);
    expect(f.byWait.map((w) => w.bags)).toEqual([2, 0, 1, 0, 0]);
    expect(f.byWait[1].rating).toBeNull();
    expect(f.window.map((w) => w.brews)).toEqual([1, 1, 1]);
    expect(f.window.reduce((s, w) => s + w.share, 0)).toBeCloseTo(1);
    expect(f.noWindow).toBe(1);
  });
  it('empty and unrated: nulls, no NaN', () => {
    const f = waitWindow([], [], [], ctx);
    expect(f.window.map((w) => w.share)).toEqual([0, 0, 0]);
    const cal = waitWindow([brew({ restDays: 10, localDate: '2026-05-10' })], [brew({ restDays: 10, localDate: '2026-05-10' })], [bag({ id: 1, restLow: 7, restHigh: 21 })],
      { period: { start: '2026-05-01', end: '2026-05-31' }, ratings: 'current' });
    expect(cal.byWait.every((w) => w.rating === null)).toBe(true);
    expect(cal.window.every((w) => w.rating === null)).toBe(true);
  });
});
