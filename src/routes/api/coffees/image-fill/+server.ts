import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb } from '$lib/server/db';
import { requireAdmin } from '$lib/server/auth';
import { FillError } from '$lib/server/productFetch';
import { fetchImageFill } from '$lib/server/imageFills';

// The coffee form's image previews: the backdrop fill for a URL (cached, or
// fetched and computed now). POST like fill-from-url, so SvelteKit's CSRF
// check covers it: the server fetches a URL of the caller's choosing.
export const POST: RequestHandler = async ({ request, locals }) => {
  requireAdmin(locals);
  const body = (await request.json().catch(() => null)) as { url?: unknown } | null;
  const url = typeof body?.url === 'string' ? body.url.trim() : '';
  if (!url) return json({ error: 'No image URL' }, { status: 400 });
  if (!/^https?:\/\//i.test(url)) return json({ error: 'Only http:// and https:// images' }, { status: 400 });
  try {
    return json({ fill: await fetchImageFill(getDb(), url) });
  } catch (err) {
    if (err instanceof FillError) return json({ error: err.message }, { status: 422 });
    const name = err instanceof Error ? err.name : '';
    if (name === 'AbortError' || name === 'TimeoutError') {
      return json({ error: 'The image took longer than 10 seconds to load' }, { status: 504 });
    }
    console.error('image-fill failed', err);
    return json({ error: "Couldn't load that image" }, { status: 502 });
  }
};
