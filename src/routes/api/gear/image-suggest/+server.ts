import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireAdmin } from '$lib/server/auth';
import { toOrigin } from '$lib/server/roasterWebsites';
import { suggest } from '$lib/server/imageSuggest';
import { GEAR_KINDS, type GearKind } from '$lib/gear';

const TERM: Record<GearKind, string> = { dripper: 'dripper', grinder: 'coffee grinder', filter: 'coffee filter' };

// The gear form's Suggest: the coffee one's search, worded for gear. POST, so SvelteKit's CSRF check covers it.
export const POST: RequestHandler = async ({ request, locals }) => {
  requireAdmin(locals);
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null);
  const kind = body?.kind as GearKind;
  if (!GEAR_KINDS.includes(kind)) return json({ error: 'Unknown kind of gear' }, { status: 400 });
  const name = str(body?.model) ?? str(body?.name);
  if (!name) return json({ error: 'A name is required' }, { status: 400 });
  const typedSite = str(body?.site);
  const site = typedSite ? toOrigin(typedSite) : null;
  if (typedSite && !site) return json({ error: "That site isn't a web address" }, { status: 400 });
  const result = await suggest({ roaster: str(body?.brand) ?? '', name, origin: null, roastDate: null, site, term: TERM[kind] });
  return json({ ...result, storedSite: null });
};
