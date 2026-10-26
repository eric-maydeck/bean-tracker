import { describe, it, expect } from 'vitest';
import { ageProfile, freshness, freshBag, onHandTab, type FreshBag } from './onHand';
import type { BagFact, BrewFact } from './facts';

const today = '2026-09-25';
const bag = (o: Partial<FreshBag> = {}): FreshBag => ({
  roast_date: '2026-06-01', frozen_start_date: null, frozen_end_date: null, rest_days_low: 10, rest_days_high: 20, drank: 0,
  name: 'Sample', roaster: 'R', slug: 's', grams: 200, ...o
});

describe('freshness', () => {
  const bags = [
    bag({ name: 'soon1', roast_date: '2026-09-01', rest_days_low: 10, rest_days_high: 20 }), // urgency ~59
    bag({ name: 'soon2', roast_date: '2026-08-01', rest_days_low: 5, rest_days_high: 60 }), // urgency ~74
    bag({ name: 'ready', roast_date: '2026-09-08', rest_days_low: 10, rest_days_high: 30 }), // urgency ~11
    bag({ name: 'rest1', roast_date: '2026-09-18', rest_days_low: 10, rest_days_high: 20 }), // ready in 3... see below
    bag({ name: 'rest2', roast_date: '2026-09-19', rest_days_low: 14, rest_days_high: 20 }),
    bag({ name: 'frozen', roast_date: '2026-08-01', frozen_start_date: '2026-09-05', grams: 250 }),
    bag({ name: 'none', roast_date: null })
  ];
  const f = freshness(bags, today);

  it('splits ready from drink soon, and counts unknown bags nowhere else', () => {
    expect(f.ready.count).toBe(1);
    expect(f.drinkSoon.count).toBe(2);
    expect(f.resting.count).toBe(2);
    expect(f.unknown).toBe(1);
    expect(f.nextReadyInDays).toBe(3);
  });
  it('keeps groups disjoint: they sum to the bags minus the unknown ones', () => {
    expect(f.ready.count + f.drinkSoon.count + f.resting.count + f.frozen.count).toBe(bags.length - f.unknown);
  });
  it('counts an open freeze as frozen only, with its remaining grams', () => {
    expect(f.frozen).toEqual({ count: 1, grams: 250, bags: [{ name: 'frozen', roaster: 'R', slug: 's' }] });
  });
  it('sorts group bags by roast date', () => {
    expect(f.drinkSoon.bags.map((b) => b.name)).toEqual(['soon2', 'soon1']);
  });
  it('has no next-ready day when nothing rests', () => {
    expect(freshness([], today).nextReadyInDays).toBeNull();
  });
});

describe('freshBag', () => {
  it('uses remaining grams', () => {
    const b = { id: 1, amountG: 250, purchaseDate: '2026-09-01', name: 'N', roaster: 'R', slug: null } as BagFact;
    expect(freshBag(b, new Map([[1, 100]])).grams).toBe(150);
  });
});

const fact = (o: Partial<BagFact>): BagFact => ({
  id: 0, status: 'backlog', purchaseDate: '2026-09-15', cost: null, amountG: 250, roaster: 'R', name: 'C', slug: null, processing: null,
  origin: null, processGroup: 'Washed', roastLevel: null, decaf: false, firstBrew: null, lastBrew: null, bagRating: null,
  subscriptionId: null, ...o
});
const dose = (coffeeId: number, localDate: string, d: number) => ({ coffeeId, localDate, dose: d } as BrewFact);
const ctx = { period: { start: '2026-09-18', end: today }, size: 1, dataStart: '2026-08-01', today };

describe('onHandTab', () => {
  it('ties up the unused share of an open bag and the whole price of a backlog bag', () => {
    const t = onHandTab([dose(1, '2026-09-10', 125)], [fact({ id: 1, status: 'open', cost: 20 }), fact({ id: 2, cost: 12 })], ctx).tiles;
    expect(t.tiedUp).toBe(22);
    expect(t.bagsWaiting).toBe(1);
    expect(t.gramsWaiting).toBe(250);
    expect(t.avgBagCost).toBe(16);
  });
  it('stops an open-freeze bag\'s age at its freeze, and skips a bag without a roast date for age only', () => {
    const t = onHandTab([], [
      fact({ id: 1, purchaseDate: '2026-09-05', frozenStart: '2026-09-15', amountG: 100 }), // age 10
      fact({ id: 2, purchaseDate: '2026-09-15' }), // age 10
      fact({ id: 3, purchaseDate: null })
    ], ctx).tiles;
    expect(t).toMatchObject({ avgAge: 10, bagsWaiting: 3, frozenBags: 1, frozenGrams: 100 });
  });
  it('a size of 2 halves grams and dollars only', () => {
    const bags = [fact({ id: 1, cost: 20, purchaseDate: '2026-09-15' }), fact({ id: 2, cost: 10, frozenStart: '2026-09-20' })];
    const one = onHandTab([], bags, ctx).tiles;
    const two = onHandTab([], bags, { ...ctx, size: 2 }).tiles;
    expect(two).toEqual({ ...one, gramsWaiting: one.gramsWaiting / 2, tiedUp: one.tiedUp / 2, frozenGrams: one.frozenGrams / 2 });
  });
  it('has zeros and nulls without bags', () => {
    expect(onHandTab([], [], ctx).tiles).toEqual({ bagsWaiting: 0, gramsWaiting: 0, tiedUp: 0, avgAge: null, frozenBags: 0, frozenGrams: 0, avgBagCost: null });
  });
  it('an all-time pace runs out at a different day than a one-week pace', () => {
    const brews = [dose(9, '2026-08-05', 300), dose(9, '2026-09-24', 30)];
    const r = onHandTab(brews, [fact({ id: 1, amountG: 500 })], { ...ctx, period: { start: '2026-09-18', end: today } });
    expect(r.runway.days).not.toBeNull();
    expect(r.runwayAll.days).not.toBeNull();
    expect(r.runway.days).not.toBe(r.runwayAll.days);
  });
});

describe('ageProfile', () => {
  const at = (days: number) => new Date(Date.UTC(2026, 8, 25 - days)).toISOString().slice(0, 10); // roast date `days` before today
  const age = (bags: BagFact[], size = 1) => ageProfile(bags, new Map(), today, size);
  it('puts ages in the bucket edges: 14 / 15, 30 / 31, 60 / 61, 90 / 91 days', () => {
    const edges = [14, 15, 30, 31, 60, 61, 90, 91];
    const a = age(edges.map((d, i) => fact({ id: i + 1, purchaseDate: at(d) })));
    expect(a.labels).toEqual(['0–14', '15–30', '31–60', '61–90', '90+']);
    expect(a.bags.noWindow).toEqual([1, 2, 2, 2, 1]);
  });
  it('splits by the rest window at that age', () => {
    const a = age([
      fact({ id: 1, purchaseDate: at(10), restLow: 7, restHigh: 21 }), // inside
      fact({ id: 2, purchaseDate: at(25), restLow: 7, restHigh: 21 }), // past
      fact({ id: 3, purchaseDate: at(3), restLow: 7, restHigh: 21 }), // before
      fact({ id: 4, purchaseDate: at(10) }) // no window
    ]);
    expect(a.bags.inside[0]).toBe(1);
    expect(a.bags.past[1]).toBe(1);
    expect(a.bags.before[0]).toBe(1);
    expect(a.bags.noWindow[0]).toBe(1);
  });
  it('grams are remaining grams, halved per person; bags are not', () => {
    const bags = [fact({ id: 1, purchaseDate: at(10), amountG: 250 })];
    const one = ageProfile(bags, new Map([[1, 50]]), today, 1);
    const two = ageProfile(bags, new Map([[1, 50]]), today, 2);
    expect(one.grams.noWindow[0]).toBe(200);
    expect(two.grams.noWindow[0]).toBe(100);
    expect(two.bags.noWindow[0]).toBe(1);
  });
  it('a frozen bag stops aging at its freeze; a bag without a roast date is left out', () => {
    const a = age([fact({ id: 1, purchaseDate: at(40), frozenStart: at(30) }), fact({ id: 2, purchaseDate: null })]);
    expect(a.bags.noWindow[0]).toBe(1); // aged 10 days
    expect(a.bags.noWindow.reduce((x, y) => x + y)).toBe(1);
  });
});
