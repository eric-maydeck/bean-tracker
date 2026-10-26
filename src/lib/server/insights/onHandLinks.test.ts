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
