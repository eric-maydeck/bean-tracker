import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb } from '$lib/server/db';
import { requireAdmin } from '$lib/server/auth';
import { commitCoffeeBatch, type CoffeeBatchChange } from '$lib/server/coffeeBatchActions';

export const POST: RequestHandler = async ({ request, locals }) => {
  requireAdmin(locals);
  const body = await request.json();
  if (!Array.isArray(body.changes)) {
    return json({ error: 'Invalid request: changes must be an array' }, { status: 400 });
  }
  const changes = body.changes as CoffeeBatchChange[];
  try {
    const slugs = commitCoffeeBatch(getDb(), changes);
    return json({ success: true, slugs });
  } catch (err) {
    return json({ success: false, error: err instanceof Error ? err.message : 'Save failed' }, { status: 500 });
  }
};
