import { describe, it, expect } from 'vitest';
import { spendTiles, spendTab, ppgOf, pricedPpg, type Plan, type SpendCtx } from './spend';
import type { BagFact, BrewFact } from './facts';

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

describe('spendTab series', () => {
  const W = { start: '2026-09-07', end: '2026-09-27' }; // three Monday weeks
  const fx = [
    bag({ id: 1, cost: 20, amountG: 250, purchaseDate: '2026-09-08' }),
    bag({ id: 2, cost: 15, amountG: 150, purchaseDate: '2026-09-09', subscriptionId: 1 }),
    bag({ id: 3, cost: 0, amountG: 100, purchaseDate: '2026-09-15' }), // only a $0 bag
    bag({ id: 4, cost: 30, amountG: 300, purchaseDate: '2026-09-22', subscriptionId: 1 }),
    bag({ id: 5, cost: 12, amountG: 100, purchaseDate: '2026-08-31' }), // compare window (prev week)
    bag({ id: 6, cost: 9, amountG: 100, purchaseDate: '2026-08-25' })
  ];
  const ctx: SpendCtx = {
    period: W, prev: { start: '2026-08-17', end: '2026-09-06' }, sameLength: true, pace: false, size: 1,
    dataStart: '2026-01-01', today: '2026-10-26', by: 'week', ratings: 'all', plans
  };
  const t = spendTab([], [], fx, ctx);
  it('splits $ per week; sums equal the tile', () => {
    expect(t.series.sub).toEqual([15, 0, 30]);
    expect(t.series.oneOff).toEqual([20, 0, 0]);
    expect([...t.series.sub, ...t.series.oneOff].reduce((a, b) => a + b, 0)).toBe(t.tiles.spent);
    expect(t.series.by).toBe('week');
  });
  it('a bucket with only a $0 bag has no $/g', () => {
    expect(t.series.ppg.all[1]).toBeNull();
    expect(t.series.ppg.all[0]).toBeCloseTo(35 / 400);
    expect(t.series.ppg.sub).toEqual([0.1, null, 0.1]);
    expect(t.series.ppg.oneOff).toEqual([0.08, null, null]);
  });
  it('same-length compare is bucket for bucket', () => {
    expect(t.series.compare).toEqual([0, 9, 12]);
    expect(t.series.comparePpg).toEqual([null, 0.09, 0.12]);
    expect(t.series.compareAverage).toBeNull();
  });
  it('a longer compare gives the mean $ per bucket', () => {
    const l = spendTab([], [], fx, { ...ctx, sameLength: false }).series;
    expect(l.compare).toBeNull();
    expect(l.compareAverage).toBeCloseTo(21 / 3);
  });
});

describe('spendTab valueMap', () => {
  const P = { start: '2026-09-01', end: '2026-09-30' };
  const ctx: SpendCtx = {
    period: P, prev: null, sameLength: false, pace: false, size: 1,
    dataStart: '2026-01-01', today: '2026-10-26', by: undefined, ratings: 'all', plans: []
  };
  const brewsOf = (id: number, n: number, rating: number): BrewFact[] =>
    Array.from({ length: n }, (_, i) => ({ id: id * 100 + i, coffeeId: id, roaster: 'R', localDate: '2026-09-10', rating, dose: 18 }) as BrewFact);
  // 25 coffees: coffee i costs (i+1)¢/g, the last one is the outlier.
  const many = Array.from({ length: 25 }, (_, i) => bag({ id: i + 1, name: `C${i + 1}`, cost: (i + 1) * (i === 24 ? 100 : 1), amountG: 100 }));
  const brews25 = many.flatMap((b) => brewsOf(b.id, 4, 8));
  it('cuts the outlier above the 95th percentile (24th of 25)', () => {
    const m = spendTab(brews25, brews25, many, ctx).valueMap;
    expect(m.points).toHaveLength(25);
    expect(m.cap).toBeCloseTo(0.24);
    expect(m.cut.map((p) => p.name)).toEqual(['C25']);
  });
  it('pools two bags of one coffee; a $0-only coffee has no point; one point: medians null', () => {
    const bs = [
      bag({ id: 1, name: 'A', cost: 10, amountG: 100 }), bag({ id: 2, name: 'a', cost: 30, amountG: 100, subscriptionId: 1 }),
      bag({ id: 3, name: 'Free', cost: 0, amountG: 100 })
    ];
    const br = [...brewsOf(1, 2, 8), ...brewsOf(2, 2, 8), ...brewsOf(3, 4, 9)];
    const m = spendTab(br, br, bs, ctx).valueMap;
    expect(m.points).toHaveLength(1);
    expect(m.points[0].ppg).toBeCloseTo(0.2);
    expect(m.points[0].sub).toBe(true);
    expect(m.points[0].sample.brews).toBe(4);
    expect([m.medianPpg, m.medianRating]).toEqual([null, null]);
  });
  it('best skips a 3-brew coffee and orders by rating ÷ $ per 100 g', () => {
    const bs = [bag({ id: 1, name: 'Cheap', cost: 10, amountG: 100 }), bag({ id: 2, name: 'Dear', cost: 20, amountG: 100 }), bag({ id: 3, name: 'Few', cost: 5, amountG: 100 })];
    const br = [...brewsOf(1, 4, 8), ...brewsOf(2, 4, 9), ...brewsOf(3, 3, 10)];
    const m = spendTab(br, br, bs, ctx).valueMap;
    expect(m.points).toHaveLength(3);
    expect(m.best.map((p) => p.name)).toEqual(['Cheap', 'Dear']);
  });
  it('best ties on score go to the name', () => {
    const bs = [bag({ id: 1, name: 'Zed', cost: 10, amountG: 100 }), bag({ id: 2, name: 'Abe', cost: 10, amountG: 100 })];
    const br = [...brewsOf(1, 4, 8), ...brewsOf(2, 4, 8)];
    expect(spendTab(br, br, bs, ctx).valueMap.best.map((p) => p.name)).toEqual(['Abe', 'Zed']);
  });
});

describe('spendTab reportCard', () => {
  const P = { start: '2026-09-01', end: '2026-09-30' };
  const ctx: SpendCtx = {
    period: P, prev: null, sameLength: false, pace: false, size: 1,
    dataStart: '2026-01-01', today: '2026-10-26', by: undefined, ratings: 'all', plans: []
  };
  const bs = [
    bag({ id: 1, roaster: 'A', cost: 20, amountG: 200, purchaseDate: '2026-09-05' }),
    bag({ id: 2, roaster: 'A', cost: 30, amountG: 300, purchaseDate: '2026-09-20' }),
    bag({ id: 3, roaster: 'A', cost: 99, amountG: 100, purchaseDate: '2026-10-05' }), // after the Period
    bag({ id: 4, roaster: 'Free', cost: 0, amountG: 100, purchaseDate: '2026-09-10' }),
    bag({ id: 5, roaster: 'Old', cost: 10, amountG: 100, purchaseDate: '2026-08-10' }) // not bought in the Period
  ];
  const rows = (c = ctx) => spendTab([], [], bs, c).reportCard;
  it('one row per roaster bought from in the Period; a $0-only roaster has no $/g', () => {
    expect(rows().map((r) => r.roaster).sort()).toEqual(['A', 'Free']);
    expect(rows().find((r) => r.roaster === 'Free')).toMatchObject({ bags: 1, spent: 0, ppg: null, rating: null, like: null });
  });
  it('last ignores a bag after the Period end; $/g is grams-weighted', () => {
    const a = rows().find((r) => r.roaster === 'A')!;
    expect(a.last).toBe('2026-09-20');
    expect(a.ppg).toBeCloseTo(0.1);
    expect(a.href).toContain('/coffees?');
  });
  it('per person halves bags and spent only', () => {
    const a = rows({ ...ctx, size: 2 }).find((r) => r.roaster === 'A')!;
    expect([a.bags, a.spent, a.ppg]).toEqual([1, 25, expect.closeTo(0.1)]);
  });
  it('rating is the bag-weighted raw mean and like the gap to other roasters, each with a sample', () => {
    const mk = (id: number, roaster: string) => bag({ id, roaster, name: `C${id}`, cost: 10, amountG: 100, roastLevel: 'Light', purchaseDate: '2026-09-05' });
    const brews = (id: number, roaster: string, n: number, rating: number) =>
      Array.from({ length: n }, (_, i) => ({ id: id * 100 + i, coffeeId: id, roaster, roastLevel: 'Light', processGroup: 'Washed', origin: null, localDate: '2026-09-10', rating, dose: 18 }) as BrewFact);
    const bs2 = [mk(1, 'A'), mk(2, 'A'), mk(10, 'X'), mk(11, 'X'), mk(12, 'X')];
    const br = [...brews(1, 'A', 4, 8), ...brews(2, 'A', 2, 6), ...brews(10, 'X', 4, 7), ...brews(11, 'X', 4, 7), ...brews(12, 'X', 4, 7)];
    const a = spendTab(br, br, bs2, ctx).reportCard.find((r) => r.roaster === 'A')!;
    // bag weights n/(n+2): 4/6 for the 8s, 2/4 for the 6s
    expect(a.rating).toBeCloseTo((8 * (4 / 6) + 6 * 0.5) / (4 / 6 + 0.5));
    expect(a.ratingSample).toMatchObject({ bags: 2, brews: 6 });
    expect(a.like).not.toBeNull();
    expect(a.like!).toBeCloseTo(a.rating! - 7, 0);
    expect(a.likeSample).toBeDefined();
  });
});
