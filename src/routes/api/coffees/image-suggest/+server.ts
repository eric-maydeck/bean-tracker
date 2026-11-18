import type { RequestHandler } from './$types';
import { getDb } from '#lib/server/db.ts';
import { requireAdmin } from '#lib/server/auth.ts';
import { getRoasterWebsite, toOrigin } from '#lib/server/roasterWebsites.ts';
import { suggest } from '#lib/server/imageSuggest/index.ts';

// The coffee form's Suggest. POST like fill-from-url, so SvelteKit's CSRF
// check covers it: the server fetches pages it found for this coffee.
export const POST: RequestHandler = async ({ request, locals }) => {
  requireAdmin(locals);
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null);
  const roaster = str(body?.roaster);
  const name = str(body?.name);
  if (!roaster || !name) return Response.json({ error: 'Roaster and coffee name are required' }, { status: 400 });
  const typedSite = str(body?.site);
  const override = typedSite ? toOrigin(typedSite) : null;
  if (typedSite && !override) return Response.json({ error: "That site isn't a web address" }, { status: 400 });
  const storedSite = getRoasterWebsite(getDb(), roaster);
  const result = await suggest({ roaster, name, origin: str(body?.origin), roastDate: str(body?.roastDate), site: override ?? storedSite, productUrl: str(body?.product_url)?.slice(0, 2000) });
  return Response.json({ ...result, storedSite });
};
