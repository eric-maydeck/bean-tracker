import type { Actions, PageServerLoad } from './$types';
import { getDb } from '$lib/server/db';
import {
  getNonArchivedCoffees,
  openCoffee,
  unopenCoffee,
  freezeCoffee,
  thawCoffee,
  archiveCoffee,
  deleteCoffee
} from '$lib/server/coffees';
import {
  getSubscriptions,
  createSubscription,
  deleteSubscription,
  toggleSubscriptionPurchased,
  withTotalGrams
} from '$lib/server/subscriptions';
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
  const coffees = getNonArchivedCoffees(db)
    .map((c) => withComputedFields(c, today))
    .sort(sortBySpreadsheetOrder);
  const subscriptions = getSubscriptions(db).map(withTotalGrams);
  return { coffees, subscriptions };
};

export const actions: Actions = {
  open: async ({ request }) => {
    const formData = await request.formData();
    openCoffee(getDb(), Number(formData.get('id')));
    return { success: true };
  },
  unopen: async ({ request }) => {
    const formData = await request.formData();
    unopenCoffee(getDb(), Number(formData.get('id')));
    return { success: true };
  },
  freeze: async ({ request }) => {
    const formData = await request.formData();
    freezeCoffee(getDb(), Number(formData.get('id')));
    return { success: true };
  },
  thaw: async ({ request }) => {
    const formData = await request.formData();
    thawCoffee(getDb(), Number(formData.get('id')));
    return { success: true };
  },
  archive: async ({ request }) => {
    const formData = await request.formData();
    archiveCoffee(getDb(), Number(formData.get('id')));
    return { success: true };
  },
  delete: async ({ request }) => {
    const formData = await request.formData();
    deleteCoffee(getDb(), Number(formData.get('id')));
    return { success: true };
  },
  subCreate: async ({ request }) => {
    const formData = await request.formData();
    const roasterService = String(formData.get('roaster_service') ?? '').trim();
    if (!roasterService) {
      return { error: 'Roaster/service is required' };
    }
    createSubscription(getDb(), {
      roaster_service: roasterService,
      subscription_name: (formData.get('subscription_name') as string) || null,
      price: formData.get('price') ? Number(formData.get('price')) : null,
      bag_count: formData.get('bag_count') ? Number(formData.get('bag_count')) : null,
      amount_per_bag_g: formData.get('amount_per_bag_g') ? Number(formData.get('amount_per_bag_g')) : null
    });
    return { success: true };
  },
  subDelete: async ({ request }) => {
    const formData = await request.formData();
    deleteSubscription(getDb(), Number(formData.get('id')));
    return { success: true };
  },
  subTogglePurchased: async ({ request }) => {
    const formData = await request.formData();
    toggleSubscriptionPurchased(getDb(), Number(formData.get('id')));
    return { success: true };
  }
};
