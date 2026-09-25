import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb } from '$lib/server/db';
import { requireAdmin } from '$lib/server/auth';
import { getDistinctFieldValues, getFillHistory } from '$lib/server/coffees';
import { getRoastLevels } from '$lib/server/roastLevels';
import { fetchProductData, getUsdRates, FillError } from '$lib/server/productFetch';
import { buildFill } from '$lib/server/productFill';

export const POST: RequestHandler = async ({ request, locals }) => {
  requireAdmin(locals);
  const body = (await request.json().catch(() => null)) as { url?: unknown } | null;
  const url = typeof body?.url === 'string' ? body.url.trim() : '';
  if (!url) return json({ error: 'Paste a product page URL first' }, { status: 400 });
  try {
    const product = await fetchProductData(url);
    const rates = product.currency && product.currency !== 'USD' ? await getUsdRates().catch(() => null) : null;
    const db = getDb();
    return json(
      buildFill(product, {
        url,
        rates,
        history: getFillHistory(db),
        roastLevels: getRoastLevels(db).map((r) => r.roast_level),
        origins: getDistinctFieldValues(db, 'origin'),
        processing: getDistinctFieldValues(db, 'processing')
      })
    );
  } catch (err) {
    if (err instanceof FillError) return json({ error: err.message }, { status: 422 });
    // Anything else (timeouts, DNS failures, zlib errors, ...) is not a
    // FillError with a user-facing message — never let it escape unhandled.
    console.error('fill-from-url failed', err);
    return json({ error: `Couldn't load that page (${err instanceof Error ? err.message : 'unknown error'})` }, { status: 502 });
  }
};
