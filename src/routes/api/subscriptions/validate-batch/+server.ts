import type { RequestHandler } from './$types';
import { requireAdmin } from '#lib/server/auth.ts';
import { validateSubscriptionBatch, type SubscriptionBatchChange } from '#lib/server/subscriptionBatchActions.ts';

export const POST: RequestHandler = async ({ request, locals }) => {
  requireAdmin(locals);
  const body = await request.json();
  if (!Array.isArray(body.changes)) {
    return Response.json({ error: 'Invalid request: changes must be an array' }, { status: 400 });
  }
  const changes = body.changes as SubscriptionBatchChange[];
  const errors = validateSubscriptionBatch(changes);
  return Response.json({ errors });
};
