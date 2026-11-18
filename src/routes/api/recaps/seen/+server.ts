import type { RequestHandler } from './$types';
import { getDb } from '#lib/server/db.ts';
import { requireAdmin } from '#lib/server/auth.ts';
import { localToday } from '#lib/server/localToday.ts';
import { recapYears } from '#lib/recapsUrl.ts';
import { brewYears, markRecapSeen } from '#lib/server/recaps/store.ts';

export const POST: RequestHandler = async ({ request, locals }) => {
  requireAdmin(locals);
  const body = await request.json().catch(() => ({}));
  const db = getDb();
  if (!recapYears(brewYears(db), localToday()).includes(body.year)) {
    return Response.json({ error: 'Invalid request: year is not an open recap' }, { status: 400 });
  }
  markRecapSeen(db, body.year);
  return new Response(null, { status: 204 });
};
