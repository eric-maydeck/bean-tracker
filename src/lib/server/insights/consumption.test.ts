import { describe, it, expect } from 'vitest';
import { gramsOnHand } from './overview';
import { RATINGS_SETTLED_FROM } from './ratings';
import { rolling, TREND_WINDOW, buckets, bucketLabels, bucketTitles, backlogSeries, consumptionTab, type ConsumptionCtx } from './consumption';
import type { BrewFact, BagFact } from './facts';

const brew = (localDate: string, dose: number, coffeeId = 1): BrewFact => ({
  id: 0, coffeeId, localTime: `${localDate}T08:00`, localDate, backfilled: false, dose, rating: null, roaster: null, origin: null,
  processGroup: 'Washed', roastLevel: null, decaf: false, brewer: null, brewerType: 'pourover', waterG: null, ratio: null, grind: null, dripper: null, filter: null, grinder: null, water: null, waterProfile: null,
  restDays: null, costPerBrew: null, brewTimeSeconds: null, bloomSeconds: null, hasNote: false, brewIndex: 0, tempC: null
});
const bag = (o: Partial<BagFact>): BagFact => ({
  id: 0, status: 'open', purchaseDate: null, cost: null, amountG: null, roaster: 'R', name: 'C', slug: null, processing: null,
  origin: null, processGroup: 'Washed', roastLevel: null, decaf: false, firstBrew: null, lastBrew: null, bagRating: null, subscriptionId: null, ...o
});
const SEPT = { start: '2026-09-01', end: '2026-09-30' };
const ctx = (o: Partial<ConsumptionCtx> = {}): ConsumptionCtx => ({
  period: SEPT, prev: null, sameLength: true, unit: 'grams', by: undefined, size: 1, dataStart: '2026-01-01', today: '2026-10-11',
  pace: false, agg: 'total', ...o
});

describe('buckets', () => {
  it('weeks start Monday; clipped edges are partial', () => {
    const b = buckets({ start: '2026-09-02', end: '2026-09-20' }, 'week'); // Wed → Sun
    expect(b.map((x) => [x.start, x.end, x.partial])).toEqual([
      ['2026-09-02', '2026-09-06', true], ['2026-09-07', '2026-09-13', false], ['2026-09-14', '2026-09-20', false]
    ]);
  });
  it('calendar months', () =>
    expect(buckets({ start: '2026-08-15', end: '2026-10-11' }, 'month').map((x) => [x.start, x.end, x.partial])).toEqual([
      ['2026-08-15', '2026-08-31', true], ['2026-09-01', '2026-09-30', false], ['2026-10-01', '2026-10-11', true]
    ]));
  it('days', () => expect(buckets({ start: '2026-09-01', end: '2026-09-03' }, 'day')).toHaveLength(3));
  it('nothing tracked: no buckets', () => expect(buckets(null, 'day')).toEqual([]));
});

describe('bucketLabels', () => {
  it('day and week: short date of the (clipped) start; partial gets *', () => {
    expect(bucketLabels(buckets({ start: '2026-09-02', end: '2026-09-20' }, 'week'))).toEqual(['Sep 2*', 'Sep 7', 'Sep 14']);
    expect(bucketLabels(buckets({ start: '2026-09-06', end: '2026-09-07' }, 'day'))).toEqual(['Sep 6', 'Sep 7']);
  });
  it('month: short month, plus the year only when the span crosses one', () => {
    expect(bucketLabels(buckets({ start: '2026-08-15', end: '2026-10-11' }, 'month'), 'month')).toEqual(['Aug*', 'Sep', 'Oct*']);
    expect(bucketLabels(buckets({ start: '2025-12-01', end: '2026-01-31' }, 'month'), 'month')).toEqual(['Dec 2025', 'Jan 2026']);
  });
});

describe('bucketTitles', () => {
  it('the dates a bucket really covers, with the year', () => {
    expect(bucketTitles(buckets({ start: '2025-09-06', end: '2025-09-07' }, 'day'), 'day')).toEqual(['Sep 6, 2025', 'Sep 7, 2025']);
    expect(bucketTitles(buckets({ start: '2025-09-02', end: '2025-09-20' }, 'week'), 'week')).toEqual([
      'Sep 2–7, 2025 (partial)', 'Sep 8–14, 2025', 'Sep 15–20, 2025 (partial)'
    ]);
    expect(bucketTitles(buckets({ start: '2025-09-24', end: '2025-10-06' }, 'week'), 'week')[1]).toBe('Sep 29 – Oct 5, 2025');
    expect(bucketTitles(buckets({ start: '2025-12-29', end: '2026-01-11' }, 'week'), 'week')[0]).toBe('Dec 29, 2025 – Jan 4, 2026');
    expect(bucketTitles(buckets({ start: '2025-08-15', end: '2025-10-11' }, 'month'), 'month')).toEqual([
      'Aug 15–31, 2025 (partial)', 'Sep 2025', 'Oct 1–11, 2025 (partial)'
    ]);
  });
});

describe('backlogSeries', () => {
  const bags = [
    bag({ id: 1, status: 'archive', purchaseDate: '2026-09-01', amountG: 100, lastBrew: '2026-09-03' }),
    bag({ id: 2, status: 'open', purchaseDate: '2026-09-02', amountG: 250 }),
    bag({ id: 3, status: 'archive', purchaseDate: '2026-08-01', amountG: 200, lastBrew: null }) // never brewed: left out
  ];
  const brews = [brew('2026-09-02', 40, 1), brew('2026-09-03', 50, 1), brew('2026-09-03', 15, 2)];
  it('grams: remaining at each end, finished bags drop out', () =>
    expect(backlogSeries(brews, bags, ['2026-09-01', '2026-09-02', '2026-09-03'], 'grams')).toEqual([100, 60 + 250, 235]));
  it('bags', () => expect(backlogSeries(brews, bags, ['2026-09-01', '2026-09-02', '2026-09-03'], 'bags')).toEqual([1, 2, 1]));
  it('floors a bag logged past its weight at 0', () =>
    expect(backlogSeries([brew('2026-09-02', 300, 2)], [bags[1]], ['2026-09-02'], 'grams')).toEqual([0]));
});

describe('consumptionTab', () => {
  const bags = [
    bag({ id: 1, status: 'archive', purchaseDate: '2026-09-05', amountG: 250, lastBrew: '2026-09-20' }),
    bag({ id: 2, status: 'open', purchaseDate: '2026-08-20', amountG: 300 })
  ];
  const brews = [brew('2026-09-10', 15, 1), brew('2026-09-20', 15, 1), brew('2026-09-25', 20, 2), brew('2026-10-01', 18, 2)];

  it('grams tiles: bought by purchase date, brewed by brew date', () => {
    const t = consumptionTab(brews, bags, ctx());
    expect(t.by).toBe('day'); // 30 tracked days
    expect(t.tiles).toMatchObject({ brewed: 50, bought: 250, net: 200, onHand: 300 - 38 });
    expect(t.tiles.avg).toBeCloseTo(50 / 30);
    expect(t.brewed).toHaveLength(30);
    expect(t.brewed[9]).toBe(15);
    expect(t.bought[4]).toBe(250);
  });

  it('bags unit: finished by last brew, bought, on hand', () =>
    expect(consumptionTab(brews, bags, ctx({ unit: 'bags', by: 'week' })).tiles).toMatchObject({ brewed: 1, bought: 1, net: 0, onHand: 1 }));

  it('average: per-day within each bucket and per-day tiles; by day equals the total', () => {
    const a = consumptionTab(brews, bags, ctx({ by: 'week', agg: 'average' }));
    expect(a.brewed[1]).toBeCloseTo(15 / 7); // Sep 7-13
    expect(a.brewed[3]).toBeCloseTo(20 / 7); // Sep 21-27
    expect(a.bought[0]).toBeCloseTo(250 / 6); // Sep 1-6: a clipped bucket divides by its own days
    expect(a.tiles).toMatchObject({ brewed: 50 / 30, bought: 250 / 30 });
    expect(a.tiles.net).toBeCloseTo(200 / 30);
    expect(consumptionTab(brews, bags, ctx({ agg: 'average' })).brewed).toEqual(consumptionTab(brews, bags, ctx()).brewed);
  });
  it('average: the compare series and deltas are per-day too', () => {
    const older = [...brews, brew('2026-08-10', 30, 1)];
    const a = consumptionTab(older, bags, ctx({ agg: 'average', by: 'week', prev: { start: '2026-08-01', end: '2026-08-31' } }));
    expect(a.compareBrewed!.reduce((s, v) => s! + v!, 0)).toBeCloseTo(30 / 7);
    expect(a.deltas!.brewed).toMatchObject({ abs: expect.closeTo(50 / 30 - 30 / 31, 5) });
  });

  it('avg is Avg per {by} in every mode (no week special case)', () => {
    expect(consumptionTab(brews, bags, ctx({ by: 'day', agg: 'average' })).tiles.avg).toBeCloseTo(50 / 30);
    expect(consumptionTab(brews, bags, ctx({ by: 'day' })).tiles.avg).toBeCloseTo(50 / 30);
  });

  describe('busiest day', () => {
    const busy = (bs: BrewFact[], o: Partial<ConsumptionCtx> = {}) => consumptionTab(bs, bags, ctx(o)).busiest;
    it('most grams in the period, with that day\'s brews and grams', () =>
      expect(busy([brew('2026-09-10', 15), brew('2026-09-12', 20), brew('2026-09-12', 25), brew('2026-09-14', 30)]))
        .toEqual({ date: '2026-09-12', brews: 2, grams: 45 }));
    it('tie goes to the most recent day', () =>
      expect(busy([brew('2026-09-10', 30), brew('2026-09-14', 30)])?.date).toBe('2026-09-14'));
    it('ignores brews outside the period', () =>
      expect(busy([brew('2026-09-10', 15), brew('2026-10-02', 99)])?.date).toBe('2026-09-10'));
    it('no brews: null', () => expect(busy([])).toBeNull());
    it('buckets by local date, not UTC', () =>
      expect(busy([{ ...brew('2026-09-10', 20), localTime: '2026-09-10T23:30' }, brew('2026-09-11', 10)])?.date).toBe('2026-09-10'));
    it('compare: the previous period\'s busiest', () =>
      expect(consumptionTab([brew('2026-08-03', 40), brew('2026-09-10', 15)], bags, ctx({ prev: { start: '2026-08-01', end: '2026-08-31' } })).prevBusiest)
        .toEqual({ date: '2026-08-03', brews: 1, grams: 40 }));
  });

  it('avg follows by', () => expect(consumptionTab(brews, bags, ctx({ by: 'week' })).tiles.avg).toBeCloseTo((50 / 30) * 7));

  it('per person: brewed, bought, net, avg ÷ size; not on hand or backlog', () => {
    const one = consumptionTab(brews, bags, ctx());
    const two = consumptionTab(brews, bags, ctx({ size: 2 }));
    expect(two.tiles).toMatchObject({ brewed: 25, bought: 125, net: 100, onHand: one.tiles.onHand });
    expect(two.backlog).toEqual(one.backlog);
    expect(two.brewed[9]).toBe(7.5);
  });

  it('same-length compare: aligned bucket for bucket; longer: average line', () => {
    const prev = { start: '2026-08-02', end: '2026-08-31' };
    const older = [brew('2026-08-02', 30, 2), ...brews];
    const same = consumptionTab(older, bags, ctx({ prev }));
    expect(same.compareBrewed![0]).toBe(30);
    expect(same.compareAverage).toBeNull();
    // The compare bar's tooltip names the day it really covers, not the period's bucket.
    expect(same.compareTitles![0]).toBe('Aug 2, 2026');
    expect(same.compareTitles).toHaveLength(same.brewed.length);
    expect(same.deltas!.brewed).toMatchObject({ abs: 20 });
    const longer = consumptionTab(older, bags, ctx({ prev: { start: '2026-06-01', end: '2026-08-31' }, sameLength: false }));
    expect(longer.compareBrewed).toBeNull();
    expect(longer.compareTitles).toBeNull();
    expect(longer.compareAverage).toBeCloseTo(30 / 92); // 92 daily buckets
  });

  it('empty: zeros and no buckets crash', () => {
    const t = consumptionTab([], [], ctx({ dataStart: null }));
    expect(t.tiles).toEqual({ brewed: 0, bought: 0, net: 0, avg: null, onHand: 0, daysToClear: null });
    expect(t.buckets).toEqual([]);
  });

  it('tiles sum the period, not the tracked span: bag bought before the first brew still counts', () => {
    const t = consumptionTab([brew('2026-09-10', 15, 1)], [bags[0]], ctx({ dataStart: '2026-09-10' }));
    expect(t.tiles.bought).toBe(250);
    expect(t.bought.reduce((a, b) => a + b, 0)).toBe(0);
  });
});

describe('backlog last point matches on hand', () => {
  const bags = [
    bag({ id: 1, status: 'open', purchaseDate: null, amountG: 200 }),
    bag({ id: 2, status: 'backlog', purchaseDate: '2026-09-01', amountG: 100 }),
    bag({ id: 3, status: 'archive', purchaseDate: '2026-08-01', amountG: 50, lastBrew: '2026-09-03' })
  ];
  const brews = [brew('2026-09-02', 40, 1), brew('2026-09-03', 50, 3)];
  it('grams', () =>
    expect(backlogSeries(brews, bags, ['2026-10-11'], 'grams')).toEqual([gramsOnHand(bags, brews)]));
  it('bags', () => expect(backlogSeries(brews, bags, ['2026-10-11'], 'bags')).toEqual([2]));
});

describe('whole is used for on hand and net', () => {
  const bags = [bag({ id: 1, status: 'open', amountG: 250, purchaseDate: '2026-09-02' })];
  const all = [brew('2026-09-10', 15), brew('2026-09-11', 15), brew('2026-09-12', 15)];
  const subset = all.slice(0, 1);
  it('on hand, net, time to clear and backlog come from whole; brewed from the subset', () => {
    const w = consumptionTab(subset, bags, ctx({ whole: all }));
    const full = consumptionTab(all, bags, ctx());
    expect(w.tiles).toMatchObject({ onHand: full.tiles.onHand, net: full.tiles.net, daysToClear: full.tiles.daysToClear, brewed: 15 });
    expect(w.backlog).toEqual(full.backlog);
    expect(w.tiles.brewed).toBeLessThan(full.tiles.brewed);
  });
  it('whole = brews changes nothing', () => {
    expect(consumptionTab(all, bags, ctx({ whole: all }))).toEqual(consumptionTab(all, bags, ctx()));
  });
});

describe('Show: Per brew day', () => {
  // Two brews on Sep 7 (Mon), one on Sep 8: week of Sep 7 has 7 days, 2 brew days, 90 g.
  const bs = [brew('2026-09-07', 30), brew('2026-09-07', 30), brew('2026-09-08', 30)];
  const c = (o: Partial<ConsumptionCtx> = {}) => ctx({ by: 'week', period: { start: '2026-09-07', end: '2026-09-13' }, ...o });
  it('divides each bucket by its brew days; Average by its days; Total not at all', () => {
    expect(consumptionTab(bs, [], c({ agg: 'brewday' })).brewed).toEqual([45]);
    expect(consumptionTab(bs, [], c({ agg: 'average' })).brewed[0]).toBeCloseTo(90 / 7);
    expect(consumptionTab(bs, [], c({ agg: 'total' })).brewed).toEqual([90]);
  });
  it('the tiles follow: per brew day over the period\'s brew days', () => {
    expect(consumptionTab(bs, [], c({ agg: 'brewday' })).tiles.brewed).toBe(45);
  });
  it('a bucket with no brews stays 0, not NaN', () => {
    expect(consumptionTab(bs, [], c({ agg: 'brewday', period: { start: '2026-09-07', end: '2026-09-20' } })).brewed).toEqual([45, 0]);
  });
});

describe('Brewed over time measures', () => {
  const w = (d: string, waterG: number | null, rating: number | null): BrewFact => ({ ...brew(d, 20), waterG, rating });
  const bs = [w('2026-09-07', 300, 8), w('2026-09-07', 320, 9), w('2026-09-14', null, null), w('2026-09-14', 250, 7)];
  const c = (o: Partial<ConsumptionCtx> = {}) => ctx({ by: 'week', agg: 'total', period: { start: '2026-09-07', end: '2026-09-20' }, ...o });
  it('brews: the count per bucket', () => expect(consumptionTab(bs, [], c({ trend: 'brews' })).brewed).toEqual([2, 2]));
  it('water: litres from water_amount_g, a brew without it adds nothing', () => {
    const t = consumptionTab(bs, [], c({ trend: 'water' })).brewed;
    expect(t[0]).toBeCloseTo(0.62);
    expect(t[1]).toBeCloseTo(0.25);
  });
  it('brews and water honor the household split', () => expect(consumptionTab(bs, [], c({ trend: 'brews', size: 2 })).brewed).toEqual([1, 1]));
  it('water per brew day: litres ÷ brew days', () => expect(consumptionTab(bs, [], c({ trend: 'water', agg: 'brewday' })).brewed[0]).toBeCloseTo(0.62));
  it('rating: the mean of counted ratings, null with none, and Show does not apply', () => {
    const r = (o: Partial<ConsumptionCtx>) => consumptionTab(bs, [], c({ trend: 'rating', ratings: 'all', ...o })).brewed;
    expect(r({})).toEqual([8.5, 7]);
    expect(r({ agg: 'average' })).toEqual([8.5, 7]);
    expect(consumptionTab([w('2026-09-14', 100, null)], [], c({ trend: 'rating', ratings: 'all' })).brewed).toEqual([null, null]);
  });
  it('rating uses the scored brews, not the filtered ones', () => {
    const scored = bs.map((b) => ({ ...b, rating: b.rating === 9 ? null : b.rating }));
    expect(consumptionTab(bs, [], c({ trend: 'rating', ratings: 'all', scored })).brewed).toEqual([8, 7]);
  });
  it('Calibrated ratings start at the first bucket reaching the calibration date', () => {
    const run = (ratings: 'current' | 'all') => consumptionTab(bs, [], c({
      trend: 'rating', ratings, period: { start: '2026-05-18', end: '2026-06-07' }, today: '2026-06-07',
      dataStart: '2026-05-18'
    }));
    expect(RATINGS_SETTLED_FROM).toBe('2026-06-01');
    expect(run('current').ratingFrom).toBe(2); // weeks of May 18, May 25 end before Jun 1
    expect(run('all').ratingFrom).toBe(0);
    expect(consumptionTab(bs, [], c({ trend: 'brews' })).ratingFrom).toBe(0);
  });
  it('the compare window follows the measure', () => {
    const older = [...bs, w('2026-08-31', 100, 6)];
    const t = consumptionTab(older, [], c({ trend: 'brews', prev: { start: '2026-08-24', end: '2026-09-06' } }));
    expect(t.compareBrewed).toEqual([0, 1]);
  });
});

describe('rolling', () => {
  it('trailing mean, a shorter window at the start', () => expect(rolling([3, 6, 9, 12], 3)).toEqual([3, 4.5, 6, 9]));
  it('a null counts for nothing; windows follow the grouping', () => {
    expect(rolling([2, null, 4], 3)).toEqual([2, 2, 3]);
    expect(TREND_WINDOW).toEqual({ day: 7, week: 4, month: 3 });
  });
  it('the tab carries it (none for a rating)', () => {
    const bs = [brew('2026-09-07', 30), brew('2026-09-08', 60)];
    const c = ctx({ by: 'day', agg: 'total', period: { start: '2026-09-07', end: '2026-09-08' } });
    expect(consumptionTab(bs, [], c).trendLine).toEqual([30, 45]);
    expect(consumptionTab(bs, [], { ...c, trend: 'rating' }).trendLine).toBeNull();
  });
});
