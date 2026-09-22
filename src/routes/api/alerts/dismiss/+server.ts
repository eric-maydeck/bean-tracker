import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb } from '$lib/server/db';
import { requireAdmin } from '$lib/server/auth';
import { dismissAlert } from '$lib/server/alerts';

export const POST: RequestHandler = async ({ request, locals }) => {
  requireAdmin(locals);
  const body = await request.json();
  if (typeof body.id !== 'number') {
    return json({ error: 'Invalid request: id must be a number' }, { status: 400 });
  }
  dismissAlert(getDb(), body.id);
  return json({ success: true });
};
