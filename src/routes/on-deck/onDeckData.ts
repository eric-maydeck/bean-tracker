import { withComputedFields, type CoffeeWithComputed } from '$lib/server/urgency';
import type { CoffeeRow } from '$lib/types';

export function byUrgencyDesc(a: CoffeeWithComputed, b: CoffeeWithComputed): number {
  const au = typeof a.urgency_rating === 'number' ? a.urgency_rating : -Infinity;
  const bu = typeof b.urgency_rating === 'number' ? b.urgency_rating : -Infinity;
  return bu - au;
}

export type CaffeineFilter = 'all' | 'caffeinated' | 'decaf';

function byCaffeineFilter(rows: CoffeeWithComputed[], filter: CaffeineFilter): CoffeeWithComputed[] {
  if (filter === 'all') return rows;
  return rows.filter((c) => (filter === 'decaf' ? c.decaf === 1 : c.decaf !== 1));
}

// Pure, DB-agnostic so it can be unit tested without SvelteKit's request context.
// (Kept out of +page.server.ts because SvelteKit only allows a fixed set of named
// exports — load, actions, etc. — from route files.)
//
// The Caffeinated/Decaf/All split happens BEFORE the "top 5" slice, not after —
// slicing the mixed list first and filtering client-side would silently make
// "Next up" look empty for a small category (e.g. this project's 3 decaf
// coffees), since a handful of items are unlikely to land in an overall top 5.
// Each of the three variants below is independently correct on its own terms.
export function buildOnDeckData(openRows: CoffeeRow[], backlogRows: CoffeeRow[], today: Date) {
  const openComputed = openRows.map((c) => withComputedFields(c, today)).sort(byUrgencyDesc);
  const backlogComputed = backlogRows.map((c) => withComputedFields(c, today)).sort(byUrgencyDesc);

  function forFilter(filter: CaffeineFilter) {
    return {
      open: byCaffeineFilter(openComputed, filter),
      nextUp: byCaffeineFilter(backlogComputed, filter).slice(0, 5)
    };
  }

  return {
    all: forFilter('all'),
    caffeinated: forFilter('caffeinated'),
    decaf: forFilter('decaf')
  };
}
