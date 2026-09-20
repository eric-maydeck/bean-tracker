import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb } from '$lib/server/db';
import { requireAdmin } from '$lib/server/auth';
import { commitSubscriptionBatch, type SubscriptionBatchChange } from '$lib/server/subscriptionBatchActions';

export const POST: RequestHandler = async ({ request, locals }) => {
  requireAdmin(locals);
  const { changes } = (await request.json()) as { changes: SubscriptionBatchChange[] };
  try {
    commitSubscriptionBatch(getDb(), changes);
    return json({ success: true });
  } catch (err) {
    return json({ success: false, error: err instanceof Error ? err.message : 'Save failed' }, { status: 500 });
  }
};
