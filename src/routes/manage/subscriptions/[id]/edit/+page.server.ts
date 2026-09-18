import { error, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { getDb } from '$lib/server/db';
import { getSubscriptionById, updateSubscription } from '$lib/server/subscriptions';

export const load: PageServerLoad = ({ params }) => {
  const subscription = getSubscriptionById(getDb(), Number(params.id));
  if (!subscription) {
    error(404, 'Subscription not found');
  }
  return { subscription };
};

export const actions: Actions = {
  default: async ({ request, params }) => {
    const formData = await request.formData();
    const roasterService = String(formData.get('roaster_service') ?? '').trim();
    if (!roasterService) {
      return { error: 'Roaster/service is required' };
    }
    updateSubscription(getDb(), Number(params.id), {
      roaster_service: roasterService,
      subscription_name: (formData.get('subscription_name') as string) || null,
      price: formData.get('price') ? Number(formData.get('price')) : null,
      bag_count: formData.get('bag_count') ? Number(formData.get('bag_count')) : null,
      amount_per_bag_g: formData.get('amount_per_bag_g') ? Number(formData.get('amount_per_bag_g')) : null
    });
    redirect(303, '/manage');
  }
};
