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
    expect(t).not.toHaveProperty('avgBagSize');
  });
  it('subscription share is grams over grams bought', () => expect(t.subShare).toBeCloseTo(125 / 925));
  it('new roasters: first bag ever in the period', () => expect(t.newRoasters).toBe(2)); // A, B; C was bought in August
  it('plans per month: active plans only', () => expect(t.plansPerMonth).toBe(58));
  it('per person halves spent and plans per month; bags stay whole', () => {
    const h = spendTiles(bags, plans, SEPT, 2);
    expect([h.spent, h.bags, h.plansPerMonth]).toEqual([41.25, 6, 29]);
    expect([h.avgPpg, h.avgBagCost, h.subShare, h.newRoasters]).toEqual([t.avgPpg, t.avgBagCost, t.subShare, t.newRoasters]);
  });
  it('empty', () => {
    expect(spendTiles([], [], SEPT)).toEqual({
      spent: 0, bags: 0, avgPpg: null, avgBagCost: null, newRoasters: 0, subShare: null, plansPerMonth: null, free: 0
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
  it('the compare window is split one-off vs plan too, and its pieces add up to the total', () => {
    const c = t.series.compareSplit!;
    expect(c.oneOff).toEqual([0, 9, 12]);
    expect(c.sub).toEqual([0, 0, 0]);
    expect(t.series.comparePpgSplit!.oneOff).toEqual([null, 0.09, 0.12]);
    expect(t.series.comparePpgSplit!.sub).toEqual([null, null, null]);
    expect(t.series.compareAverageSplit).toBeNull();
  });
  it('a longer compare gives the mean $ per bucket', () => {
    const l = spendTab([], [], fx, { ...ctx, sameLength: false }).series;
    expect(l.compare).toBeNull();
    expect(l.compareAverage).toBeCloseTo(21 / 3);
    expect(l.compareAverageSplit!.oneOff + l.compareAverageSplit!.sub).toBeCloseTo(21 / 3);
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
  it('best skips a 3-brew coffee and orders by rating ÷ $ per 100g', () => {
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
  it('per person halves spent only; bags stay whole', () => {
    const a = rows({ ...ctx, size: 2 }).find((r) => r.roaster === 'A')!;
    expect([a.bags, a.spent, a.ppg]).toEqual([2, 25, expect.closeTo(0.1)]);
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

describe('spendTab discovery', () => {
  const P = { start: '2026-09-01', end: '2026-09-30' };
  const ctx: SpendCtx = {
    period: P, prev: null, sameLength: false, pace: false, size: 1,
    dataStart: '2026-01-01', today: '2026-10-26', by: undefined, ratings: 'all', plans: []
  };
  const fx = [
    bag({ id: 1, roaster: 'A', cost: 10, purchaseDate: '2026-03-10' }),
    bag({ id: 2, roaster: 'B', cost: 10, purchaseDate: '2026-06-10' }),
    ...'ABCDEFG'.split('').map((r, i) => bag({ id: 10 + i, roaster: r, cost: 7 * (7 - i) + 1, purchaseDate: i % 2 ? '2026-09-05' : '2026-09-20' }))
  ];
  const d = spendTab([], [], fx, ctx).discovery;
  it('cumulative never drops and ends at the distinct roaster count', () => {
    expect(d.cumulative.every((v, i) => i === 0 || v >= d.cumulative[i - 1])).toBe(true);
    expect(d.cumulative.at(-1)).toBe(7);
    expect(d.cumulative[0]).toBe(1);
  });
  it('band covers the Period; null for all time', () => {
    expect(d.band).not.toBeNull();
    expect(spendTab([], [], fx, { ...ctx, period: { start: null, end: ctx.today } }).discovery.band).toBeNull();
  });
  it('share names the roasters in 2+ buckets, biggest spend first; the rest are Other; sums to 100 per bucket', () => {
    const sx = [
      bag({ id: 1, roaster: 'A', cost: 50, purchaseDate: '2026-09-01' }), bag({ id: 2, roaster: 'A', cost: 50, purchaseDate: '2026-09-15' }),
      bag({ id: 3, roaster: 'B', cost: 30, purchaseDate: '2026-09-02' }), bag({ id: 4, roaster: 'B', cost: 30, purchaseDate: '2026-09-16' }),
      bag({ id: 5, roaster: 'C', cost: 40, purchaseDate: '2026-09-03' }), // 20% but one bucket
      bag({ id: 6, roaster: 'D', cost: 1, purchaseDate: '2026-09-04' }), bag({ id: 7, roaster: 'D', cost: 1, purchaseDate: '2026-09-17' }) // two buckets, small but named
    ];
    const s = spendTab([], [], sx, { ...ctx, by: 'week' }).discovery.share!;
    expect(s.lines.map((l) => l.label)).toEqual(['A', 'B', 'D', 'Other']);
    for (let i = 0; i < s.x.length; i++) {
      const sum = s.lines.reduce((a, l) => a + (l.values[i] ?? 0), 0);
      expect(sum === 100 || sum === 0).toBe(true);
    }
    expect(s.dollars[0].filter(Boolean)).toEqual([50, 50]);
    const i = s.x.findIndex((_, k) => s.other[k].length > 0);
    expect(s.other[i].map(([r]) => r)).toEqual(['C']);
    expect(s.other[i][0]).toEqual(['C', Math.round((100 * 40) / 121), 40]);
  });
  it('share is null when no roaster has bags in 2+ buckets (no all-Other bars)', () => {
    const sx = [bag({ id: 1, roaster: 'A', cost: 50, purchaseDate: '2026-09-01' }), bag({ id: 2, roaster: 'B', cost: 30, purchaseDate: '2026-09-16' })];
    expect(spendTab([], [], sx, { ...ctx, by: 'week' }).discovery.share).toBeNull();
  });
  it('share names at most 14 roasters; the rest are Other', () => {
    const sx = Array.from({ length: 16 }, (_, k) => [
      bag({ id: 2 * k + 1, roaster: `R${k}`, cost: 10 + k, purchaseDate: '2026-09-01' }), bag({ id: 2 * k + 2, roaster: `R${k}`, cost: 10 + k, purchaseDate: '2026-09-15' })
    ]).flat();
    const s = spendTab([], [], sx, { ...ctx, by: 'week' }).discovery.share!;
    expect(s.lines).toHaveLength(15);
    expect(s.lines[0].label).toBe('R15');
    expect(s.lines.at(-1)!.label).toBe('Other');
  });
  it('per person halves the dollars, not the percents', () => {
    const sx = [bag({ id: 1, roaster: 'A', cost: 50, purchaseDate: '2026-09-01' }), bag({ id: 2, roaster: 'A', cost: 50, purchaseDate: '2026-09-15' })];
    const s = spendTab([], [], sx, { ...ctx, by: 'week', size: 2 }).discovery.share!;
    expect(s.dollars[0].filter(Boolean)).toEqual([25, 25]);
    expect(s.lines[0].values.filter(Boolean)).toEqual([100, 100]);
  });
  it('repeat rate: roasters of the Period you have bought 2+ bags from by its end', () => {
    expect(d.roasters).toBe(7);
    expect(d.repeatRate).toBeCloseTo(2 / 7); // A and B have 2 bags each
    // Two bags in the Period itself count; a second bag after the Period's end does not.
    const two = [bag({ id: 1, roaster: 'X', cost: 1, purchaseDate: '2026-09-02' }), bag({ id: 2, roaster: 'X', cost: 1, purchaseDate: '2026-09-09' }), bag({ id: 3, roaster: 'Y', cost: 1, purchaseDate: '2026-09-05' }), bag({ id: 4, roaster: 'Y', cost: 1, purchaseDate: '2026-10-05' })];
    expect(spendTab([], [], two, ctx).discovery.repeatRate).toBe(0.5);
    expect(spendTab([], [], two, { ...ctx, period: { start: null, end: ctx.today } }).discovery.repeatRate).toBe(1);
  });
  it('no spend: no share', () => expect(spendTab([], [], [bag({ cost: 0 })], ctx).discovery.share).toBeNull());
});

describe('spendTab plans', () => {
  const P = { start: '2026-09-01', end: '2026-09-30' };
  const ps: Plan[] = [
    { id: 1, name: 'Box', roaster: 'B', price: 60, paused: false },
    { id: 2, name: 'Old', roaster: 'D', price: 22, paused: true },
    { id: 3, name: 'Club', roaster: 'E', price: null, paused: false }
  ];
  const fx = [
    bag({ id: 1, cost: 20, amountG: 250, subscriptionId: 1 }), bag({ id: 2, cost: 30, amountG: 250, subscriptionId: 1 }),
    bag({ id: 3, cost: 10, amountG: 100 }), bag({ id: 4, cost: 40, amountG: 400, purchaseDate: '2026-08-01', subscriptionId: 1 })
  ];
  const rate = (id: number, rating: number): BrewFact => ({ id: id * 10, coffeeId: id, roaster: 'R', localDate: '2026-09-10', rating, dose: 18 }) as BrewFact;
  const brews = [rate(1, 8), rate(1, 8), rate(2, 6), rate(3, 7)];
  const ctx = (o: Partial<SpendCtx> = {}): SpendCtx => ({
    period: P, prev: null, sameLength: false, pace: false, size: 1, dataStart: '2026-01-01', today: '2026-10-26', by: undefined, ratings: 'all', plans: ps, ...o
  });
  const run = (o?: Partial<SpendCtx>) => spendTab(brews, brews, fx, ctx(o)).plans;

  it('a paused plan with no bags has only $/month; no price gives null', () => {
    const [, old, club] = run().rows;
    expect(old).toMatchObject({ paused: true, perMonth: 22, bags: 0, ppg: null, rating: null });
    expect(club).toMatchObject({ perMonth: null, bags: 0 });
  });
  it('a row links to its /coffees list: every status, roast dates in the Period', () => {
    expect(run().rows[0].href).toBe('/coffees?status=all&subscription=1&roast_date=between%3A2026-09-01..2026-09-30');
    expect(run({ period: { start: null, end: '2026-10-26' } }).rows[0].href).toBe('/coffees?status=all&subscription=1&roast_date=%3C%3D2026-10-26');
  });
  it('a plan counts its linked bags in the Period; one-off excludes them', () => {
    const p = run();
    expect(p.rows[0]).toMatchObject({ bags: 2, perMonth: 60 });
    expect(p.rows[0].ppg).toBeCloseTo(50 / 500);
    expect(p.rows[0].rating).toBeCloseTo((8 * 2 / 4 + 6 * 1 / 3) / (2 / 4 + 1 / 3), 5);
    expect(p.oneOffPpg).toBeCloseTo(0.1);
    expect(p.oneOffRating).toBeCloseTo(7);
  });
  it('a Period bag\'s brews count on any date, even after the Period', () => {
    const late = [{ ...rate(1, 9), localDate: '2026-10-20' }, { ...rate(1, 9), id: 99, localDate: '2026-10-21' }];
    const p = spendTab(late, late, fx, ctx()).plans;
    expect(p.rows[0].rating).toBeCloseTo(9);
  });
  it('per person halves $/month, not bags; total $/month skips the paused plan', () => {
    const p = run({ size: 2 });
    expect([p.rows[0].perMonth, p.rows[0].bags, p.total.perMonth]).toEqual([30, 2, 30]);
    expect(run().total).toMatchObject({ perMonth: 60, bags: 2 });
  });
});

describe('spendTab series before the first brew', () => {
  it('a bag roasted before the first brew still lands in a bucket, so the chart adds up to the tile', () => {
    const fx = [bag({ id: 1, cost: 20, amountG: 100, purchaseDate: '2026-01-20' }), bag({ id: 2, cost: 10, amountG: 100, purchaseDate: '2026-03-05' })];
    const c: SpendCtx = {
      period: { start: '2025-10-01', end: '2026-03-31' }, prev: null, sameLength: false, pace: false, size: 1,
      dataStart: '2026-02-03', today: '2026-10-26', by: 'month', ratings: 'all', plans: []
    };
    const t = spendTab([], [], fx, c);
    expect(t.series.labels[0]).toMatch(/^Jan/);
    expect([...t.series.oneOff, ...t.series.sub].reduce((a, b) => a + b, 0)).toBe(t.tiles.spent);
  });
});
