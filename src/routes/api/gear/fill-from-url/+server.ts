import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireAdmin } from '$lib/server/auth';
import { fetchProductData, getUsdRates, FillError } from '$lib/server/productFetch';
import { buildGearFill } from '$lib/server/gearFill';
import { GEAR_KINDS, type GearKind } from '$lib/gear';

export const POST: RequestHandler = async ({ request, locals }) => {
  requireAdmin(locals);
  const body = (await request.json().catch(() => null)) as { url?: unknown; kind?: unknown } | null;
  const url = typeof body?.url === 'string' ? body.url.trim() : '';
  if (!url) return json({ error: 'Enter the official website first' }, { status: 400 });
  const kind = body?.kind as GearKind;
  if (!GEAR_KINDS.includes(kind)) return json({ error: 'Unknown kind of gear' }, { status: 400 });
  try {
    const product = await fetchProductData(url);
    const rates = product.currency && product.currency !== 'USD' ? await getUsdRates().catch(() => null) : null;
    return json(buildGearFill(product, { url, kind, rates }));
  } catch (err) {
    if (err instanceof FillError) return json({ error: err.message }, { status: 422 });
    const name = err instanceof Error ? err.name : '';
    if (name === 'AbortError' || name === 'TimeoutError') {
      return json({ error: 'The page took longer than 10 seconds to respond' }, { status: 504 });
    }
    console.error('gear fill-from-url failed', err);
    return json({ error: `Couldn't load that page (${err instanceof Error ? err.message : 'unknown error'})` }, { status: 502 });
  }
};
