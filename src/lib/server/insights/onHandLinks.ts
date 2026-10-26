import { toParams } from '$lib/coffeeViewState';
import { upsertFilter, type Filter } from '$lib/coffeeFilters';
import { WAIT_BUCKETS } from './facts';
import { addDays } from './time';
import type { StatusTab } from '$lib/coffeeViewState';

// /coffees links for On hand's groups: the page's Coffees filter plus the group's own filters, from the existing filters.
// Dates are today's, so a saved link goes stale (it names the day it was made).
const href = (status: StatusTab[], filters: Filter[]) => `/coffees?${toParams({ status, filters })}`;
const FAR_PAST = '1970-01-01';
const FAR_FUTURE = '9999-12-31';
const frozen = (value: boolean): Filter => ({ column: 'frozen', mode: 'bool', value });
const urgency = (op: '<' | '>=', a: string): Filter => ({ column: 'urgency', mode: 'range', op, a, b: '' });
const window = (b: string): Filter => ({ column: 'rest_window', mode: 'overlaps', a: FAR_PAST, b });

export type AgeKey = 'before' | 'inside' | 'past' | 'noWindow';
// An Age profile segment: waiting (backlog) bags whose roast date falls in the bucket's days (the Coffees page counts
// calendar days, so freezer days are not netted off), and for "Before rest window" the exact rest state (urgency below 0
// with a rest window = short of its minimum rest). Inside, past and no window can't be told apart with existing filters
// (no "past the window" or "no window" filter), so those lists show the whole bucket.
export function ageHref(bucket: number, key: AgeKey, today: string, page: Filter[]): string {
  const lo = bucket ? WAIT_BUCKETS[bucket - 1].max + 1 : 0, hi = WAIT_BUCKETS[bucket].max;
  const roast: Filter = hi === Infinity
    ? { column: 'roast_date', mode: 'range', op: '<=', a: addDays(today, -lo), b: '' }
    : { column: 'roast_date', mode: 'range', op: 'between', a: addDays(today, -hi), b: addDays(today, -lo) };
  return href(['backlog'], [...page, roast, ...(key === 'before' ? [window(FAR_FUTURE), urgency('<', '0')] : [])]);
}

// What's waiting: backlog bags of one group (null: the group can't be listed with a filter).
export function waitHref(filter: Filter | null, page: Filter[]): string | null {
  return filter ? href(['backlog'], upsertFilter(page, filter)) : null;
}

export type FreshKey = 'ready' | 'drinkSoon' | 'resting' | 'frozen';
// Freshness groups. Ready = drink-after today or earlier (a window that overlaps up to today) with urgency under 40;
// Drink soon the same with urgency 40+; Still resting = urgency below 0 (a bag short of its minimum rest) with a window;
// In the freezer = Frozen. The Coffees page rounds urgency to a whole number, so a bag at 39.5-39.99 reads as 40 there.
export function freshHref(key: FreshKey, today: string, page: Filter[]): string {
  const own: Record<FreshKey, Filter[]> = {
    ready: [frozen(false), window(today), urgency('<', '40')],
    drinkSoon: [frozen(false), window(today), urgency('>=', '40')],
    resting: [frozen(false), window(FAR_FUTURE), urgency('<', '0')],
    frozen: [frozen(true)]
  };
  return href(['backlog', 'open'], [...page, ...own[key]]);
}
