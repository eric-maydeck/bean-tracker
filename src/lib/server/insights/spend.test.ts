import { describe, it, expect } from 'vitest';
import { spendTiles, spendTab, ppgOf, pricedPpg, type Plan, type SpendCtx } from './spend';
import type { BagFact } from './facts';

const bag = (o: Partial<BagFact>): BagFact => ({
  id: 0, status: 'open', purchaseDate: '2026-09-10', cost: null, amountG: null, roaster: 'R', name: 'C', slug: null, processing: null,
  origin: null, processGroup: 'Washed', roastLevel: null, decaf: false, firstBrew: null, lastBrew: null, bagRating: null,
  subscriptionId: null, ...o
});
const SEPT = { start: '2026-09-01', end: '2026-09-30' };
const bags = [
  bag({ id: 1, cost: 20, amountG: 250, roaster: 'A' }),
  bag({ id: 2, cost: 14.5, amountG: 125, roaster: 'B', subscriptionId: 1 }),
  bag({ id: 3, cost: 30, amountG: 200, roaster: 'C' }),
  bag({ id: 4, cost: 0, amountG: 100, roaster: 'A' }), // free
  bag({ id: 5, cost: null, amountG: 250, roaster: 'A' }),
  bag({ id: 6, cost: 18, amountG: null, roaster: 'A' }),
  bag({ id: 7, cost: 99, amountG: 100, roaster: 'C', purchaseDate: '2026-08-15' }), // C seen before September
  bag({ id: 8, cost: 5, amountG: 50, purchaseDate: null }) // no roast date: never in a period
];
const plans: Plan[] = [
  { id: 1, name: 'Box', roaster: 'B', price: 58, paused: false },
  { id: 2, name: 'Old', roaster: 'D', price: 22, paused: true }
];

describe('ppgOf / pricedPpg', () => {
  it('needs cost > 0 and amount > 0', () => {
    expect(ppgOf(bags[0])).toBe(0.08);
    for (const i of [3, 4, 5]) expect(ppgOf(bags[i])).toBeNull();
    expect(pricedPpg([bags[3]])).toBeNull();
    expect(pricedPpg([])).toBeNull();
  });
});

describe('spendTiles', () => {
  const t = spendTiles(bags, plans, SEPT);
  it('sums the month', () => {
    expect(t.spent).toBe(82.5);
    expect(t.bags).toBe(6);
    expect(t.free).toBe(1);
  });
  it('averages leave out missing and free bags', () => {
    expect(t.avgPpg).toBeCloseTo(64.5 / 575);
    expect(t.avgBagCost).toBeCloseTo((20 + 14.5 + 30 + 18) / 4);
    expect(t.avgBagSize).toBeCloseTo((250 + 125 + 200 + 100 + 250) / 5);
  });
  it('subscription share is grams over grams bought', () => expect(t.subShare).toBeCloseTo(125 / 925));
  it('new roasters: first bag ever in the period', () => expect(t.newRoasters).toBe(2)); // A, B; C was bought in August
  it('plans per month: active plans only', () => expect(t.plansPerMonth).toBe(58));
  it('per person halves spent, bags and plans per month only', () => {
    const h = spendTiles(bags, plans, SEPT, 2);
    expect([h.spent, h.bags, h.plansPerMonth]).toEqual([41.25, 3, 29]);
    expect([h.avgPpg, h.avgBagCost, h.subShare, h.newRoasters]).toEqual([t.avgPpg, t.avgBagCost, t.subShare, t.newRoasters]);
  });
  it('empty', () => {
    expect(spendTiles([], [], SEPT)).toEqual({
      spent: 0, bags: 0, avgPpg: null, avgBagCost: null, avgBagSize: null, newRoasters: 0, subShare: null, plansPerMonth: null, free: 0
    });
  });
});

describe('spendTab', () => {
  const ctx: SpendCtx = {
    period: SEPT, prev: { start: '2026-08-01', end: '2026-08-31' }, sameLength: true, pace: false, size: 1,
    dataStart: '2026-01-01', today: '2026-10-26', by: undefined, ratings: 'all', plans
  };
  it('deltas vs the compare window; none for plans per month', () => {
    const t = spendTab([], [], bags, ctx);
    expect(t.deltas).not.toBeNull();
    expect('plansPerMonth' in t.deltas!).toBe(false);
    expect(t.deltas!.spent).toEqual({ abs: 82.5 - 99, pct: ((82.5 - 99) / 99) * 100, base: 99 });
    expect(t.free).toBe(1);
  });
  it('no compare: no deltas', () => expect(spendTab([], [], bags, { ...ctx, prev: null }).deltas).toBeNull());
});
