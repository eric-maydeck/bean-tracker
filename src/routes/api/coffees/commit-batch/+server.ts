import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb } from '$lib/server/db';
import { requireAdmin } from '$lib/server/auth';
import { commitCoffeeBatch, type CoffeeBatchChange } from '$lib/server/coffeeBatchActions';

export const POST: RequestHandler = async ({ request, locals }) => {
  requireAdmin(locals);
  const { changes } = (await request.json()) as { changes: CoffeeBatchChange[] };
  try {
    commitCoffeeBatch(getDb(), changes);
    return json({ success: true });
  } catch (err) {
    return json({ success: false, error: err instanceof Error ? err.message : 'Save failed' }, { status: 500 });
  }
};
