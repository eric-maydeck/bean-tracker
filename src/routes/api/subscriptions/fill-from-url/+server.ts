import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb } from '$lib/server/db';
import { requireAdmin } from '$lib/server/auth';
import { getFillHistory } from '$lib/server/coffees';
import { getSubscriptions } from '$lib/server/subscriptions';
import { fetchProductData, getUsdRates, FillError } from '$lib/server/productFetch';
import { buildSubscriptionFill } from '$lib/server/subscriptionFill';

// The subscription twin of /api/coffees/fill-from-url (same errors).
export const POST: RequestHandler = async ({ request, locals }) => {
  requireAdmin(locals);
  const body = (await request.json().catch(() => null)) as { url?: unknown } | null;
  const url = typeof body?.url === 'string' ? body.url.trim() : '';
  if (!url) return json({ error: 'Paste the subscription page URL first' }, { status: 400 });
  try {
    const product = await fetchProductData(url);
    const rates = product.currency && product.currency !== 'USD' ? await getUsdRates().catch(() => null) : null;
    const db = getDb();
    const history = [
      ...getSubscriptions(db).map((s) => ({ roaster: s.roaster_service, product_url: s.subscription_url })),
      ...getFillHistory(db)
    ];
    return json(buildSubscriptionFill(product, { url, rates, history }));
  } catch (err) {
    if (err instanceof FillError) return json({ error: err.message }, { status: 422 });
    const name = err instanceof Error ? err.name : '';
    if (name === 'AbortError' || name === 'TimeoutError') {
      return json({ error: 'The page took longer than 10 seconds to respond' }, { status: 504 });
    }
    console.error('subscription fill-from-url failed', err);
    return json({ error: `Couldn't load that page (${err instanceof Error ? err.message : 'unknown error'})` }, { status: 502 });
  }
};
