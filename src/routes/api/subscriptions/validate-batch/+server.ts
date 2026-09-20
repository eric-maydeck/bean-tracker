import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireAdmin } from '$lib/server/auth';
import { validateSubscriptionBatch, type SubscriptionBatchChange } from '$lib/server/subscriptionBatchActions';

export const POST: RequestHandler = async ({ request, locals }) => {
  requireAdmin(locals);
  const { changes } = (await request.json()) as { changes: SubscriptionBatchChange[] };
  const errors = validateSubscriptionBatch(changes);
  return json({ errors });
};
