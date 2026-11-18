import type { RequestHandler } from './$types';
import { getDb } from '#lib/server/db.ts';
import { requireAdmin } from '#lib/server/auth.ts';
import { commitCoffeeBatchWithStates, type CoffeeBatchChange } from '#lib/server/coffeeBatchActions.ts';
import { queueFillMissing } from '#lib/server/imageFills.ts';

export const POST: RequestHandler = async ({ request, locals }) => {
  requireAdmin(locals);
  const body = await request.json();
  if (!Array.isArray(body.changes)) {
    return Response.json({ error: 'Invalid request: changes must be an array' }, { status: 400 });
  }
  const changes = body.changes as CoffeeBatchChange[];
  try {
    const db = getDb();
    const { slugs, before, after } = commitCoffeeBatchWithStates(db, changes);
    void queueFillMissing(db); // new images or roaster defaults → backdrop fills, in the background
    return Response.json({ success: true, slugs, before, after });
  } catch (err) {
    return Response.json({ success: false, error: err instanceof Error ? err.message : 'Save failed' }, { status: 500 });
  }
};
