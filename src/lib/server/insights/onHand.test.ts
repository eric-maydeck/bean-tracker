import { describe, it, expect } from 'vitest';
import { freshness, freshBag, type FreshBag } from './onHand';
import type { BagFact } from './facts';

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
