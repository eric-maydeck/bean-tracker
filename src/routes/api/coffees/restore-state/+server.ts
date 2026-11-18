import type { RequestHandler } from './$types';
import { getDb } from '#lib/server/db.ts';
import { requireAdmin } from '#lib/server/auth.ts';
import { restoreCoffeeStates, type CoffeeState } from '#lib/server/coffees.ts';

// Undo of a status action: { before, after } from commit-batch. Restores only while the coffees are still as `after`.
export const POST: RequestHandler = async ({ request, locals }) => {
  requireAdmin(locals);
  const body = await request.json();
  if (!Array.isArray(body.before) || !Array.isArray(body.after)) return Response.json({ success: false, error: 'Invalid request' }, { status: 400 });
  try {
    restoreCoffeeStates(getDb(), body.before as CoffeeState[], body.after as CoffeeState[]);
    return Response.json({ success: true });
  } catch (err) {
    return Response.json({ success: false, error: err instanceof Error ? err.message : 'Could not undo that.' }, { status: 409 });
  }
};
