import { withComputedFields, type CoffeeWithComputed } from '$lib/server/urgency';
import type { CoffeeRow } from '$lib/types';

export function byUrgencyDesc(a: CoffeeWithComputed, b: CoffeeWithComputed): number {
  const au = typeof a.urgency_rating === 'number' ? a.urgency_rating : -Infinity;
  const bu = typeof b.urgency_rating === 'number' ? b.urgency_rating : -Infinity;
  return bu - au;
}

// Pure, DB-agnostic so it can be unit tested without SvelteKit's request context.
// (Kept out of +page.server.ts because SvelteKit only allows a fixed set of named
// exports — load, actions, etc. — from route files.)
export function buildOnDeckData(openRows: CoffeeRow[], backlogRows: CoffeeRow[], today: Date) {
  const open = openRows.map((c) => withComputedFields(c, today)).sort(byUrgencyDesc);
  const nextUp = backlogRows
    .map((c) => withComputedFields(c, today))
    .sort(byUrgencyDesc)
    .slice(0, 5);
  return { open, nextUp };
}
