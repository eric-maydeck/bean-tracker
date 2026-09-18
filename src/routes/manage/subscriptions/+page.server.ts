import type { Actions, PageServerLoad } from './$types';
import { getDb } from '$lib/server/db';
import {
  getSubscriptions,
  deleteSubscription,
  toggleSubscriptionPurchased,
  withTotalGrams
} from '$lib/server/subscriptions';

export const load: PageServerLoad = () => {
  const subscriptions = getSubscriptions(getDb()).map(withTotalGrams);
  return { subscriptions };
};

export const actions: Actions = {
  delete: async ({ request }) => {
    const formData = await request.formData();
    deleteSubscription(getDb(), Number(formData.get('id')));
    return { success: true };
  },
  togglePurchased: async ({ request }) => {
    const formData = await request.formData();
    toggleSubscriptionPurchased(getDb(), Number(formData.get('id')));
    return { success: true };
  }
};
