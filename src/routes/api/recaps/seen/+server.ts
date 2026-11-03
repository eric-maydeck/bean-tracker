import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb } from '$lib/server/db';
import { requireAdmin } from '$lib/server/auth';
import { localToday } from '$lib/server/localToday';
import { recapYears } from '$lib/recapsUrl';
import { brewYears, markRecapSeen } from '$lib/server/recaps/store';

export const POST: RequestHandler = async ({ request, locals }) => {
  requireAdmin(locals);
  const body = await request.json().catch(() => ({}));
  const db = getDb();
  if (!recapYears(brewYears(db), localToday()).includes(body.year)) {
    return json({ error: 'Invalid request: year is not an open recap' }, { status: 400 });
  }
  markRecapSeen(db, body.year);
  return new Response(null, { status: 204 });
};
