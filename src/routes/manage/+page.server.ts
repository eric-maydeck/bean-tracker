import type { Actions, PageServerLoad } from './$types';
import { getDb } from '$lib/server/db';
import { getActiveCoffees, markAsDrank } from '$lib/server/coffees';
import { withComputedFields, type CoffeeWithComputed } from '$lib/server/urgency';

function sortBySpreadsheetOrder(a: CoffeeWithComputed, b: CoffeeWithComputed): number {
  const au = typeof a.urgency_rating === 'number' ? a.urgency_rating : -Infinity;
  const bu = typeof b.urgency_rating === 'number' ? b.urgency_rating : -Infinity;
  if (au !== bu) return bu - au;

  const ada = a.drink_after ?? '9999-99-99';
  const bda = b.drink_after ?? '9999-99-99';
  if (ada !== bda) return ada < bda ? -1 : 1;

  const adb = a.drink_before ?? '9999-99-99';
  const bdb = b.drink_before ?? '9999-99-99';
  if (adb !== bdb) return adb < bdb ? -1 : 1;

  if (a.roaster !== b.roaster) return a.roaster < b.roaster ? -1 : 1;
  return a.coffee_name < b.coffee_name ? -1 : 1;
}

export const load: PageServerLoad = () => {
  const db = getDb();
  const today = new Date();
  const coffees = getActiveCoffees(db)
    .map((c) => withComputedFields(c, today))
    .sort(sortBySpreadsheetOrder);

  return {
    coffees,
    suggestedNext: coffees[0] ?? null
  };
};

export const actions: Actions = {
  markDrank: async ({ request }) => {
    const formData = await request.formData();
    const id = Number(formData.get('id'));
    markAsDrank(getDb(), id);
    return { success: true };
  }
};
