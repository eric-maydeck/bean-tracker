import type { Actions, PageServerLoad } from './$types';
import { getDb } from '$lib/server/db';
import { localTodayDate } from '$lib/server/localToday';
import { getSubscriptions, createSubscription, withTotalGrams, withNextRenewalDate } from '$lib/server/subscriptions';
import { requireAdmin } from '$lib/server/auth';
import { parseSubscriptionUrl } from '$lib/subscriptionView';

function readSubscriptionFields(formData: FormData) {
  return {
    subscription_name: (formData.get('subscription_name') as string) || null,
    price: formData.get('price') ? Number(formData.get('price')) : null,
    bag_count: formData.get('bag_count') ? Number(formData.get('bag_count')) : null,
    amount_per_bag_g: formData.get('amount_per_bag_g') ? Number(formData.get('amount_per_bag_g')) : null,
    renewal_day: formData.get('renewal_day') ? Number(formData.get('renewal_day')) : null
  };
}

export const load: PageServerLoad = () => {
  const today = localTodayDate();
  const subscriptions = getSubscriptions(getDb())
    .map(withTotalGrams)
    .map((s) => withNextRenewalDate(s, today));
  return { subscriptions };
};

export const actions: Actions = {
  create: async ({ request, locals }) => {
    requireAdmin(locals);
    const formData = await request.formData();
    const roasterService = String(formData.get('roaster_service') ?? '').trim();
    if (!roasterService) {
      return { error: 'Roaster/service is required' };
    }
    const url = parseSubscriptionUrl(formData.get('subscription_url') as string | null);
    if ('error' in url) return { error: url.error };
    createSubscription(getDb(), {
      roaster_service: roasterService,
      ...readSubscriptionFields(formData),
      subscription_url: url.url
    });
    return { success: true };
  }
};
