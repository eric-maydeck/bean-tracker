import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb } from '$lib/server/db';
import { requireAdmin } from '$lib/server/auth';
import { GEAR_KINDS, isWebUrl, parseGearValues, type GearKind } from '$lib/gear';
import { saveGearDetails } from '$lib/server/gearDetails';
import { queueFillMissing } from '$lib/server/imageFills';

// Admin save of a piece of gear's stored details and photo URL. The photo's copy and
// backdrop are made in the background, never awaited.
export const POST: RequestHandler = async ({ request, locals }) => {
  requireAdmin(locals);
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const bad = (error: string) => json({ error }, { status: 400 });
  const kind = GEAR_KINDS.find((k) => k === body?.kind) as GearKind | undefined;
  if (!kind) return bad('Unknown kind');
  // Not trimmed: grinder names are matched raw against Bean Conqueror's.
  const name = typeof body?.name === 'string' ? body.name : '';
  if (!name.trim()) return bad('Name is required');
  if (name.length > 200) return bad('Name is too long (200 characters at most)');
  const parsed = parseGearValues(kind, body?.values);
  if ('error' in parsed) return bad(parsed.error);
  const url = typeof body?.image_url === 'string' ? body.image_url.trim() : body?.image_url == null ? '' : null;
  if (url !== '' && !(url !== null && isWebUrl(url))) return bad("That image isn't a web address");
  const db = getDb();
  saveGearDetails(db, { kind, name, values: parsed.values, imageUrl: url || null });
  void queueFillMissing(db);
  return json({ ok: true });
};
