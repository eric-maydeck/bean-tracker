import { describe, it, expect } from 'vitest';
import { buckets, backlogSeries, consumptionTab, type ConsumptionCtx } from './consumption';
import type { BrewFact, BagFact } from './facts';

const brew = (localDate: string, dose: number, coffeeId = 1): BrewFact => ({
  id: 0, coffeeId, localTime: `${localDate}T08:00`, localDate, backfilled: false, dose, rating: null, roaster: null, origin: null,
  processGroup: 'Washed', roastLevel: null, decaf: false, dripper: null, filter: null, grinder: null, water: null, waterProfile: null,
  restDays: null, costPerBrew: null, brewTimeSeconds: null, bloomSeconds: null
});
const bag = (o: Partial<BagFact>): BagFact => ({
  id: 0, status: 'open', purchaseDate: null, cost: null, amountG: null, roaster: 'R', name: 'C', slug: null, processing: null,
  origin: null, processGroup: 'Washed', roastLevel: null, decaf: false, firstBrew: null, lastBrew: null, ...o
});
const SEPT = { start: '2026-09-01', end: '2026-09-30' };
const ctx = (o: Partial<ConsumptionCtx> = {}): ConsumptionCtx => ({
  period: SEPT, prev: null, sameLength: true, unit: 'grams', by: undefined, size: 1, dataStart: '2026-01-01', today: '2026-10-11',
  pace: false, ...o
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
    expect(same.deltas!.brewed).toMatchObject({ abs: 20 });
    const longer = consumptionTab(older, bags, ctx({ prev: { start: '2026-06-01', end: '2026-08-31' }, sameLength: false }));
    expect(longer.compareBrewed).toBeNull();
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
