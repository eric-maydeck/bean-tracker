import { withComputedFields, type CoffeeWithComputed } from '#lib/server/urgency.ts';
import type { CoffeeRow } from '#lib/types.ts';
import { coffeeImage } from '#lib/coffeeImage.ts';
import type { PickCoffee } from '#lib/pick/types.ts';

export function byUrgencyDesc(a: CoffeeWithComputed, b: CoffeeWithComputed): number {
  const au = typeof a.urgency_rating === 'number' ? a.urgency_rating : -Infinity;
  const bu = typeof b.urgency_rating === 'number' ? b.urgency_rating : -Infinity;
  return bu - au;
}

// Pick's pool input: every non-archived coffee. Frozen (started, not ended) overrides open/backlog.
export function buildPickCoffees(rows: CoffeeRow[], today: Date): PickCoffee[] {
  return rows.map((row) => {
    const c = withComputedFields(row, today);
    return {
      id: c.id,
      slug: c.slug,
      name: c.coffee_name,
      roaster: c.roaster,
      image: coffeeImage(c, c.coffee_name)?.src ?? null,
      fill: coffeeImage(c, c.coffee_name)?.fill ?? null,
      category: c.frozen_start_date && !c.frozen_end_date ? 'frozen' : c.status === 'open' ? 'open' : 'backlog',
      decaf: c.decaf === 1,
      urgency: typeof c.urgency_rating === 'number' ? c.urgency_rating : null,
      origin: c.origin ?? null,
      roastLevel: c.roast_level ?? null,
      processing: c.processing ?? null
    };
  });
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
// The Caffeinated/Decaf/All split happens BEFORE the "top 10" slice, not after —
// slicing the mixed list first and filtering client-side would silently make
// "Next up" look empty for a small category (e.g. this project's 3 decaf
// coffees), since a handful of items are unlikely to land in an overall top 10.
// Each of the three variants below is independently correct on its own terms.
export function buildOnDeckData(openRows: CoffeeRow[], backlogRows: CoffeeRow[], today: Date) {
  const openComputed = openRows.map((c) => withComputedFields(c, today)).sort(byUrgencyDesc);
  const backlogComputed = backlogRows.map((c) => withComputedFields(c, today)).sort(byUrgencyDesc);

  function forFilter(filter: CaffeineFilter) {
    return {
      open: byCaffeineFilter(openComputed, filter),
      nextUp: byCaffeineFilter(backlogComputed, filter).slice(0, 10)
    };
  }

  return {
    all: forFilter('all'),
    caffeinated: forFilter('caffeinated'),
    decaf: forFilter('decaf')
  };
}
