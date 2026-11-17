import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb } from '$lib/server/db';
import { requireAdmin } from '$lib/server/auth';
import { getDistinctFieldValues, getFillHistory } from '$lib/server/coffees';
import { getRoastLevels } from '$lib/server/roastLevels';
import { fetchProductData, getUsdRates, FillError } from '$lib/server/productFetch';
import { buildFill, standardizeBeanBase, type FillContext } from '$lib/server/productFill';
import type { ProductData } from '$lib/server/productParse';
import { lookupBeanBase } from '$lib/server/beanBase';

const NO_PAGE: ProductData = {
  title: null, vendor: null, siteName: null, brand: null, tags: [], description: '',
  attributes: {}, image: null, currency: null, variants: []
};

export const POST: RequestHandler = async ({ request, locals }) => {
  requireAdmin(locals);
  const body = (await request.json().catch(() => null)) as { url?: unknown } | null;
  const url = typeof body?.url === 'string' ? body.url.trim() : '';
  if (!url) return json({ error: 'Paste a product page URL first' }, { status: 400 });
  try {
    const db = getDb();
    const ctx: Omit<FillContext, 'rates'> = {
      url,
      history: getFillHistory(db),
      roastLevels: getRoastLevels(db).map((r) => r.roast_level),
      origins: getDistinctFieldValues(db, 'origin'),
      processing: getDistinctFieldValues(db, 'processing')
    };
    let fill;
    let product = NO_PAGE;
    let pageError: unknown = null;
    try {
      product = await fetchProductData(url);
      const rates = product.currency && product.currency !== 'USD' ? await getUsdRates().catch(() => null) : null;
      fill = buildFill(product, { ...ctx, rates });
    } catch (err) {
      // The page is down: the roaster still comes from history by URL host, so Bean Base can answer alone.
      pageError = err;
      fill = buildFill(NO_PAGE, { ...ctx, rates: null });
    }
    const roaster = fill.fields.roaster;
    const hit = roaster
      ? await lookupBeanBase(roaster, { coffee_name: fill.fields.coffee_name ?? '', product_url: url }, ctx)
      : null;
    if (pageError && !(hit && 'id' in hit)) throw pageError;
    // Bean Base drops accents; the page text (already fetched) may have them.
    const pageText = [product.title, product.description, ...Object.values(product.attributes)].join('\n');
    return json(standardizeBeanBase(fill, hit && 'id' in hit ? hit : null, { db, pageText }));
  } catch (err) {
    if (err instanceof FillError) return json({ error: err.message }, { status: 422 });
    const name = err instanceof Error ? err.name : '';
    if (name === 'AbortError' || name === 'TimeoutError') {
      return json({ error: 'The page took longer than 10 seconds to respond' }, { status: 504 });
    }
    console.error('fill-from-url failed', err);
    return json({ error: `Couldn't load that page (${err instanceof Error ? err.message : 'unknown error'})` }, { status: 502 });
  }
};
