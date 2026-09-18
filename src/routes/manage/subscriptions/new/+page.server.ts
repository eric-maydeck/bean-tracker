import { redirect } from '@sveltejs/kit';
import type { Actions } from './$types';
import { getDb } from '$lib/server/db';
import { createSubscription } from '$lib/server/subscriptions';

export const actions: Actions = {
  default: async ({ request }) => {
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
    redirect(303, '/manage/subscriptions');
  }
};
