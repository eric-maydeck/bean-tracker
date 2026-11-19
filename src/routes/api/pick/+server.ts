import type { RequestHandler } from './$types';
import { getDb } from '#lib/server/db.ts';
import { requireAdmin } from '#lib/server/auth.ts';
import { getUserKv, setUserKv } from '#lib/server/userKv.ts';

const PICK_KEYS = ['pick.rules.saved', 'pick.rules.last', 'pick.today'];
const MAX_BYTES = 64 * 1024;

// Admin-only storage for Pick's saved rules, last-used rules and today's state.
export const GET: RequestHandler = async ({ url, locals }) => {
  requireAdmin(locals);
  const key = url.searchParams.get('key') ?? '';
  if (!PICK_KEYS.includes(key)) return Response.json({ error: 'Unknown key' }, { status: 400 });
  return Response.json({ value: getUserKv(getDb(), 'admin', key) });
};

export const PUT: RequestHandler = async ({ request, locals }) => {
  requireAdmin(locals);
  // The global 64KB cap skips admins, so cap here (by characters read, not content-length).
  const text = await request.text();
  if (text.length > MAX_BYTES) return Response.json({ error: 'Too large' }, { status: 413 });
  let body: { key?: unknown; value?: unknown } | null = null;
  try {
    body = JSON.parse(text);
  } catch {
    /* falls through to the 400 */
  }
  if (typeof body?.key !== 'string' || !PICK_KEYS.includes(body.key) || body.value === undefined) {
    return Response.json({ error: 'Bad key or value' }, { status: 400 });
  }
  setUserKv(getDb(), 'admin', body.key, body.value);
  return new Response(null, { status: 204 });
};
