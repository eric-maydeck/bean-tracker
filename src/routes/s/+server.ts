import { error, json } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import { createShortLink, isShareablePath } from '$lib/server/shortLinks';
import type { RequestHandler } from './$types';

// Public on purpose (anyone can share a view); not under /api, whose routes
// must all be auth-gated. Input is limited to this site's pages.
export const POST: RequestHandler = async ({ request }) => {
  const body = await request.json().catch(() => null);
  const url = body?.url;
  if (!isShareablePath(url)) error(400, 'Only links to this site’s pages can be shortened');
  return json({ code: createShortLink(getDb(), url, new Date()) });
};
