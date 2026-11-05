import { describe, it, expect } from 'vitest';
import { ageProfile, whatsWaiting, freshness, freshBag, onHandTab, type FreshBag } from './onHand';
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
  it('treats a junk freeze date as no freeze', () => {
    const j = freshness([bag({ frozen_start_date: 'junk' })], today);
    expect(j.frozen.count).toBe(0);
    expect(j.ready.count + j.drinkSoon.count).toBe(1);
  });
  it('sorts a bag without a roast date last', () => {
    expect(freshness([bag({ name: 'none', roast_date: null, rest_days_low: null }), bag({ name: 'dated' })], today).unknown).toBe(1);
    const f = freshness([bag({ name: 'a', roast_date: null, frozen_start_date: '2026-09-01' }), bag({ name: 'b', roast_date: '2026-09-01', frozen_start_date: '2026-09-10' })], today);
    expect(f.frozen.bags.map((b) => b.name)).toEqual(['b', 'a']);
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
    const two = onHandTab([], bags, { ...ctx, size: 2 });
    expect(two.tiles).toEqual({ ...one, gramsWaiting: one.gramsWaiting / 2, tiedUp: one.tiedUp / 2, frozenGrams: one.frozenGrams / 2 });
  });
  it('a size of 2 halves the daily grams, so the shelf (not divided) lasts twice as long', () => {
    const brews = [dose(9, '2026-09-20', 300)];
    const bags = [fact({ id: 1, amountG: 500 })];
    const one = onHandTab(brews, bags, ctx).runway;
    const two = onHandTab(brews, bags, { ...ctx, size: 2 }).runway;
    expect(one.days).not.toBeNull();
    expect([one.days, two.days]).toEqual([14, 27]); // 500g at 37.5 g/day, then at 18.75 g/day (the Consumption rule)
    expect(two.perDay).toBe(one.perDay! / 2);
  });
  it('oldest and newest unopened by rest age', () => {
    const t = onHandTab([], [
      fact({ id: 1, name: 'A', slug: 'a', purchaseDate: '2026-09-05' }), // 20
      fact({ id: 2, name: 'B', purchaseDate: '2026-09-20' }), // 5
      fact({ id: 3, name: 'C', purchaseDate: '2026-09-15' }), // 10
      fact({ id: 4, name: 'Open', status: 'open', purchaseDate: '2026-01-01' }) // not unopened
    ], ctx).tiles;
    expect(t.oldest).toEqual({ days: 20, name: 'A', roaster: 'R', slug: 'a' });
    expect(t.newest).toEqual({ days: 5, name: 'B', roaster: 'R', slug: null });
  });
  it('no unopened bag: oldest and newest are null', () => {
    const t = onHandTab([], [fact({ id: 1, status: 'open' })], ctx).tiles;
    expect([t.oldest, t.newest]).toEqual([null, null]);
  });
  it('states split open, waiting and frozen bags', () => {
    const bags = [
      fact({ id: 1, status: 'open', amountG: 100 }), fact({ id: 2, status: 'open', amountG: 100, frozenStart: '2026-09-20' }),
      fact({ id: 3, amountG: 250 }), fact({ id: 4, amountG: 250, frozenStart: '2026-09-20' }), fact({ id: 5, status: 'archive' })
    ];
    expect(onHandTab([], bags, ctx).states).toEqual({
      open: { bags: 1, grams: 100 }, waiting: { bags: 1, grams: 250 }, frozen: { bags: 2, grams: 350 }
    });
    expect(onHandTab([], bags, { ...ctx, size: 2 }).states.frozen).toEqual({ bags: 2, grams: 175 });
  });
  it('has zeros and nulls without bags', () => {
    expect(onHandTab([], [], ctx).tiles).toEqual({ bagsWaiting: 0, gramsWaiting: 0, tiedUp: 0, avgAge: null, frozenBags: 0, frozenGrams: 0, avgBagCost: null, oldest: null, newest: null });
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
  it('a window edge is inside; one day either side is not; a negative age is skipped', () => {
    const d = (n: number) => new Date(Date.UTC(2026, 8, 25 - n)).toISOString().slice(0, 10);
    const a = ageProfile([
      fact({ id: 1, purchaseDate: d(7), restLow: 7, restHigh: 21 }), fact({ id: 2, purchaseDate: d(21), restLow: 7, restHigh: 21 }),
      fact({ id: 3, purchaseDate: d(6), restLow: 7, restHigh: 21 }), fact({ id: 4, purchaseDate: d(22), restLow: 7, restHigh: 21 }),
      fact({ id: 5, purchaseDate: '2026-09-28', restLow: 7, restHigh: 21 })
    ], new Map(), today, 1);
    const sum = (x: number[]) => x.reduce((p, q) => p + q, 0);
    expect([sum(a.bags.before), sum(a.bags.inside), sum(a.bags.past)]).toEqual([1, 2, 1]);
    expect(sum(a.bags.noWindow)).toBe(0);
  });
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

describe('whatsWaiting', () => {
  const twelve = Array.from({ length: 12 }, (_, i) => fact({ id: i + 1, roaster: `R${String(i).padStart(2, '0')}`, amountG: 100 + i * 10, subscriptionId: i < 3 ? 7 : null }));
  const w = whatsWaiting([...twelve, fact({ id: 99, status: 'open' })], new Map(), 1);
  const grams = twelve.reduce((s, b) => s + b.amountG!, 0);
  it('12 roasters: top 10 plus Other with the remainder', () => {
    expect(w.by.roaster).toHaveLength(11);
    expect(w.by.roaster[0].label).toBe('R11');
    expect(w.by.roaster[10]).toEqual({ label: 'Other', grams: 100 + 110, bags: 2, href: null }); // no "is not" filter
  });
  it('every grouping sums to the grams waiting, as do subscription + one-off', () => {
    for (const k of ['roaster', 'origin', 'process', 'roast'] as const) expect(w.by[k].reduce((s, r) => s + r.grams, 0)).toBe(grams);
    expect(w.sub + w.oneOff).toBe(grams);
    expect(w.sub).toBe(100 + 110 + 120);
  });
  it('missing origin and roast are Unknown, N/A origin too; grams halve per person, bag counts do not', () => {
    const bags = [fact({ id: 1, origin: 'N/A', roastLevel: null }), fact({ id: 2, origin: 'Kenya', roastLevel: 'Light' })];
    const a = whatsWaiting(bags, new Map(), 2);
    expect(a.by.origin.map((r) => r.label).sort()).toEqual(['Kenya', 'Unknown']);
    expect(a.by.roast.find((r) => r.label === 'Unknown')).toMatchObject({ label: 'Unknown', grams: 125, bags: 1 });
  });
});

describe('whatsWaiting caffeine', () => {
  it('whatsWaiting groups by caffeine', () => {
    const w = whatsWaiting([fact({ id: 1, amountG: 100 }), fact({ id: 2, amountG: 300, decaf: true }), fact({ id: 3, amountG: 50 })], new Map(), 1);
    expect(w.by.caffeine.map((r) => [r.label, r.grams, r.bags])).toEqual([['Decaf', 300, 1], ['Caffeinated', 150, 2]]);
  });
});

describe('review fixes', () => {
  it('a junk roast date is treated as no roast date (no crash, no NaN age)', () => {
    const t = onHandTab([], [fact({ id: 1, purchaseDate: 'junk', restLow: 7, restHigh: 21 }), fact({ id: 2, purchaseDate: '2026-09-15', restLow: 7, restHigh: 21 })], ctx);
    expect(t.tiles.avgAge).toBe(10);
    expect(t.freshness.unknown).toBe(1);
  });
  it('the Unknown origin link covers every raw value country() maps to no country', () => {
    const origins = [null, '', 'n/a', ' N/A ', 'N/A', '  ', 'Kenya'];
    const bags = origins.map((o, i) => fact({ id: i + 1, origin: o }));
    const w = whatsWaiting(bags, new Map(), 1);
    const unknown = w.by.origin.find((r) => r.label === 'Unknown')!;
    expect(unknown.bags).toBe(6);
    const values = (new URL(unknown.href!, 'http://x').searchParams.getAll('origin'));
    // every raw value in the bar is in the link ('' reads as none, so it shares "(none)" with null)
    for (const o of origins.slice(0, 6)) expect(values).toContain(o === null || o === '' ? '(none)' : o);
  });
});
