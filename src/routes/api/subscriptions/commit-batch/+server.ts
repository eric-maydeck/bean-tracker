import type { RequestHandler } from './$types';
import { getDb } from '#lib/server/db.ts';
import { requireAdmin } from '#lib/server/auth.ts';
import { commitSubscriptionBatch, type SubscriptionBatchChange } from '#lib/server/subscriptionBatchActions.ts';

export const POST: RequestHandler = async ({ request, locals }) => {
  requireAdmin(locals);
  const body = await request.json();
  if (!Array.isArray(body.changes)) {
    return Response.json({ error: 'Invalid request: changes must be an array' }, { status: 400 });
  }
  const changes = body.changes as SubscriptionBatchChange[];
  try {
    commitSubscriptionBatch(getDb(), changes);
    return Response.json({ success: true });
  } catch (err) {
    return Response.json({ success: false, error: err instanceof Error ? err.message : 'Save failed' }, { status: 500 });
  }
};
