import type { PageServerLoad } from './$types';
import { getDb } from '$lib/server/db';
import { getOpenCoffees, getBacklogCoffees } from '$lib/server/coffees';
import { withComputedFields, type CoffeeWithComputed } from '$lib/server/urgency';

function byUrgencyDesc(a: CoffeeWithComputed, b: CoffeeWithComputed): number {
  const au = typeof a.urgency_rating === 'number' ? a.urgency_rating : -Infinity;
  const bu = typeof b.urgency_rating === 'number' ? b.urgency_rating : -Infinity;
  return bu - au;
}

export const load: PageServerLoad = () => {
  const db = getDb();
  const today = new Date();
  const open = getOpenCoffees(db)
    .map((c) => withComputedFields(c, today))
    .sort(byUrgencyDesc);
  const nextUp = getBacklogCoffees(db)
    .map((c) => withComputedFields(c, today))
    .sort(byUrgencyDesc)
    .slice(0, 5);
  return { open, nextUp };
};
