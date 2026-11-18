import type { RequestHandler } from './$types';
import { getDb } from '#lib/server/db.ts';
import { requireAdmin } from '#lib/server/auth.ts';
import { dismissAlert } from '#lib/server/alerts.ts';

export const POST: RequestHandler = async ({ request, locals }) => {
  requireAdmin(locals);
  const body = await request.json();
  if (typeof body.id !== 'number') {
    return Response.json({ error: 'Invalid request: id must be a number' }, { status: 400 });
  }
  dismissAlert(getDb(), body.id);
  return Response.json({ success: true });
};
