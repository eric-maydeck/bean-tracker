import { error, json } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import { allowShortLinkCreate, createShortLink, canonicalSharePath } from '$lib/server/shortLinks';
import { resolveClientIp } from '$lib/server/loginRateLimit';
import type { RequestHandler } from './$types';

// Public on purpose (anyone can share a view); not under /api, whose routes
// must all be auth-gated. Input is limited to this site's pages. The
// canonical (parsed) path/search is what gets stored, not the raw input --
// see canonicalSharePath.
export const POST: RequestHandler = async ({ request, locals, getClientAddress }) => {
  if (!locals.isAdmin && !allowShortLinkCreate(resolveClientIp(request, getClientAddress), Date.now()))
    error(429, 'Too many short links; try again later');
  const body = await request.json().catch(() => null);
  const canonical = canonicalSharePath(body?.url);
  if (canonical === null) error(400, 'Only links to this site’s pages can be shortened');
  return json({ code: createShortLink(getDb(), canonical, new Date()) });
};
