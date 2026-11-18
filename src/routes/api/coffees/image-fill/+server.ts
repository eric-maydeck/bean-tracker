import type { RequestHandler } from './$types';
import { getDb } from '#lib/server/db.ts';
import { requireAdmin } from '#lib/server/auth.ts';
import { FillError } from '#lib/server/productFetch.ts';
import { fetchImageFill } from '#lib/server/imageFills.ts';

// The coffee form's image previews: the backdrop fill for a URL (cached, or
// fetched and computed now). POST like fill-from-url, so SvelteKit's CSRF
// check covers it: the server fetches a URL of the caller's choosing.
export const POST: RequestHandler = async ({ request, locals }) => {
  requireAdmin(locals);
  const body = (await request.json().catch(() => null)) as { url?: unknown } | null;
  const url = typeof body?.url === 'string' ? body.url.trim() : '';
  if (!url) return Response.json({ error: 'No image URL' }, { status: 400 });
  if (!/^https?:\/\//i.test(url)) return Response.json({ error: 'Only http:// and https:// images' }, { status: 400 });
  try {
    return Response.json({ fill: await fetchImageFill(getDb(), url) });
  } catch (err) {
    if (err instanceof FillError) return Response.json({ error: err.message }, { status: 422 });
    const name = err instanceof Error ? err.name : '';
    if (name === 'AbortError' || name === 'TimeoutError') {
      return Response.json({ error: 'The image took longer than 10 seconds to load' }, { status: 504 });
    }
    console.error('image-fill failed', err);
    return Response.json({ error: "Couldn't load that image" }, { status: 502 });
  }
};
