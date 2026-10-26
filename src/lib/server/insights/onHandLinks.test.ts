import { describe, it, expect } from 'vitest';
import type { CoffeeRow } from '$lib/types';
import { applyFilters } from '$lib/coffeeFilters';
import { fromParams } from '$lib/coffeeViewState';
import { withComputedFields, parseDate } from '../urgency';
import { freshness } from './onHand';
import { freshHref, type FreshKey } from './onHandLinks';

const today = '2026-09-25';
const row = (o: Partial<CoffeeRow>): CoffeeRow => ({
  id: 1, roaster: 'R', coffee_name: 'C', origin: 'Kenya', roast_level: 'Light', processing: 'Washed', amount_g: 200, cost: 18,
  roast_date: '2026-06-01', frozen_start_date: null, frozen_end_date: null, rest_days_low: 10, rest_days_high: 20, image_url: null,
  product_url: null, slug: 's', opened_date: null, drank: 0, status: 'backlog', moved_date: null, decaf: 0, subscription_id: null,
  created_at: '', updated_at: '', ...o
});
const rows = [
  row({ id: 1, status: 'open', roast_date: '2026-09-01' }), // drink soon
  row({ id: 2, status: 'open', roast_date: '2026-08-01', rest_days_low: 5, rest_days_high: 60 }), // drink soon
  row({ id: 3, roast_date: '2026-09-08', rest_days_low: 10, rest_days_high: 30 }), // ready
  row({ id: 4, roast_date: '2026-09-18' }), // resting
  row({ id: 5, roast_date: '2026-09-19', rest_days_low: 14 }), // resting
  row({ id: 6, roast_date: '2026-08-01', frozen_start_date: '2026-09-05' }), // frozen
  row({ id: 7, roast_date: null }), // unknown
  row({ id: 8, roast_date: '2026-06-01', rest_days_low: 7, rest_days_high: 14 }) // long past its window: drink soon (urgency 100)
];

describe('freshHref', () => {
  const f = freshness(rows.map((r) => ({ ...r, name: String(r.id), roaster: r.roaster, slug: null, grams: 1 })), today);
  const ids = (g: { bags: { name: string }[] }) => g.bags.map((b) => b.name).sort();
  it.each([['ready', f.ready], ['drinkSoon', f.drinkSoon], ['resting', f.resting], ['frozen', f.frozen]] as const)('%s matches the Coffees filter exactly', (key, group) => {
    const href = freshHref(key as FreshKey, today, []);
    const state = fromParams(new URL(href, 'http://x').searchParams);
    const status = state.status ?? ['backlog'];
    const shown = applyFilters(rows.filter((r) => status.includes(r.status as 'backlog' | 'open')).map((r) => withComputedFields(r, parseDate(today))), state.filters);
    expect(shown.map((r) => String(r.id)).sort()).toEqual(ids(group));
    expect(group.bags.length).toBeGreaterThan(0);
  });
  it('keeps the page Coffees filter', () => {
    expect(freshHref('frozen', today, [{ column: 'decaf', mode: 'bool', value: true }])).toContain('decaf=true');
  });
});

import { ageProfile, whatsWaiting } from './onHand';
import type { BagFact } from './facts';

describe('waiting links', () => {
  const d = (n: number) => new Date(Date.UTC(2026, 8, 25 - n)).toISOString().slice(0, 10);
  const specs = [
    { id: 1, age: 3, low: 7, high: 21 },
    { id: 2, age: 10, low: 7, high: 21 },
    { id: 3, age: 10, low: null, high: null },
    { id: 4, age: 25, low: 7, high: 21 },
    { id: 5, age: 100, low: 7, high: 21 }
  ];
  const coffees = specs.map((s) => row({ id: s.id, roast_date: d(s.age), rest_days_low: s.low, rest_days_high: s.high, roaster: s.id === 1 ? 'Alpha' : 'Beta', origin: s.id === 1 ? 'Kenya' : null }));
  const bags = specs.map((s) => ({ id: s.id, status: 'backlog', purchaseDate: d(s.age), restLow: s.low, restHigh: s.high, amountG: 100, cost: null, roaster: s.id === 1 ? 'Alpha' : 'Beta', name: 'n', slug: null,
    processing: 'Washed', origin: s.id === 1 ? 'Kenya' : null, processGroup: 'Washed', roastLevel: null, decaf: false, firstBrew: null, lastBrew: null, bagRating: null, subscriptionId: null }) as BagFact);
  const shown = (href: string) => {
    const st = fromParams(new URL(href, 'http://x').searchParams);
    return applyFilters(coffees.map((r) => withComputedFields(r, parseDate(today))), st.filters).map((r) => r.id).sort();
  };
  it('a roaster or origin row lists its backlog bags; Other and an Unknown group follow the rule', () => {
    const w = whatsWaiting(bags, new Map(), 1);
    const beta = w.by.roaster.find((r) => r.label === 'Beta')!;
    expect(shown(beta.href!)).toEqual([2, 3, 4, 5]);
    expect(shown(w.by.origin.find((r) => r.label === 'Unknown')!.href!)).toEqual([2, 3, 4, 5]);
  });
});

describe('age links', () => {
  const d = (n: number) => new Date(Date.UTC(2026, 8, 25 - n)).toISOString().slice(0, 10);
  type Spec = { id: number; age: number; low: number | null; high: number | null; fs?: number; fe?: number; status?: 'backlog' | 'open' };
  const specs: Spec[] = [
    { id: 1, age: 3, low: 7, high: 21 }, // before
    { id: 2, age: 10, low: 7, high: 21 }, // inside
    { id: 3, age: 10, low: null, high: null }, // no window
    { id: 4, age: 25, low: 7, high: 21 }, // past
    { id: 5, age: 100, low: 7, high: 21 }, // 90+
    { id: 6, age: 40, low: 7, high: 21, fs: 20, fe: 10 }, // frozen 10 days then thawed: net age 30 (15-30), past; 40 calendar days would be 31-60
    { id: 7, age: 40, low: 7, high: 60, fs: 30 }, // open freeze at 10 days old: net age 10 (0-14), inside
    { id: 8, age: 14, low: 7, high: 21 }, // bucket edge
    { id: 9, age: 15, low: 7, high: 21 }, // bucket edge
    { id: 10, age: 10, low: 7, high: 21, status: 'open' } // not waiting: in no link
  ];
  const coffees = specs.map((s) => row({ id: s.id, status: s.status ?? 'backlog', roast_date: d(s.age), rest_days_low: s.low, rest_days_high: s.high, frozen_start_date: s.fs ? d(s.fs) : null, frozen_end_date: s.fe ? d(s.fe) : null }));
  const bags = specs.map((s) => ({ id: s.id, status: s.status ?? 'backlog', purchaseDate: d(s.age), restLow: s.low, restHigh: s.high, frozenStart: s.fs ? d(s.fs) : null, frozenEnd: s.fe ? d(s.fe) : null, amountG: 100, cost: null, roaster: 'R', name: 'n', slug: null,
    processing: 'Washed', origin: null, processGroup: 'Washed', roastLevel: null, decaf: false, firstBrew: null, lastBrew: null, bagRating: null, subscriptionId: null }) as BagFact);
  const shown = (href: string) => {
    const st = fromParams(new URL(href, 'http://x').searchParams);
    const status = st.status ?? ['backlog'];
    return applyFilters(coffees.filter((r) => status.includes(r.status as 'backlog')).map((r) => withComputedFields(r, parseDate(today))), st.filters).map((r) => r.id).sort((a, b) => a - b);
  };
  const a = ageProfile(bags.filter((b) => b.status === 'backlog'), new Map(), today, 1); // onHandTab passes the backlog bags
  const KEYS = ['before', 'inside', 'past', 'noWindow'] as const;
  it('every segment link lists exactly as many bags as the segment counts', () => {
    for (const k of KEYS) for (let i = 0; i < a.labels.length; i++) expect(shown(a.links[k][i]).length, `${k} ${a.labels[i]}`).toBe(a.bags[k][i]);
    expect(KEYS.reduce((n, k) => n + a.bags[k].reduce((x, y) => x + y, 0), 0)).toBe(9);
  });
  it('the thawed bag counts on net age (15-30), the open-freeze bag at the age it froze (0-14)', () => {
    expect(shown(a.links.past[1])).toContain(6);
    expect(shown(a.links.past[2])).not.toContain(6);
    expect(shown(a.links.inside[0])).toContain(7);
  });
  it('lists nothing for the open (not waiting) bag', () => {
    for (const k of KEYS) for (let i = 0; i < 5; i++) expect(shown(a.links[k][i])).not.toContain(10);
  });
});
