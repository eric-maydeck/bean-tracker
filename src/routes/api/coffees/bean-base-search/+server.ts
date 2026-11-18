import type { RequestHandler } from './$types';
import { getDb } from '#lib/server/db.ts';
import { requireAdmin } from '#lib/server/auth.ts';
import { getDistinctFieldValues } from '#lib/server/coffees.ts';
import { getRoastLevels } from '#lib/server/roastLevels.ts';
import { searchBeanBase } from '#lib/server/beanBase.ts';
import { standardizeBeanBase, type FillSuccess } from '#lib/server/productFill.ts';

// The coffee form's "Search Loffee Labs". POST like fill-from-url, so SvelteKit's CSRF check covers it.
const MAX = 200;
const EMPTY_FILL: FillSuccess = { fields: {}, variants: [], selected: null, notes: [], restNote: null, beanBase: null };

export const POST: RequestHandler = async ({ request, locals }) => {
  requireAdmin(locals);
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
  const roaster = str(body?.roaster);
  const coffeeName = str(body?.coffee_name);
  if (!roaster) return Response.json({ error: 'Roaster is required' }, { status: 400 });
  if (roaster.length > MAX || coffeeName.length > MAX) return Response.json({ error: 'Roaster or coffee name is too long' }, { status: 400 });
  const roastDate = str(body?.roast_date);
  if (body?.roast_date != null && body.roast_date !== '' && (!/^\d{4}-\d{2}-\d{2}$/.test(roastDate) || Number.isNaN(Date.parse(roastDate)))) {
    return Response.json({ error: 'Roast date must be YYYY-MM-DD' }, { status: 400 });
  }
  const productUrl = str(body?.product_url).slice(0, 2000);
  const db = getDb();
  const found = await searchBeanBase(roaster, coffeeName, {
    roastLevels: getRoastLevels(db).map((r) => r.roast_level),
    origins: getDistinctFieldValues(db, 'origin'),
    processing: getDistinctFieldValues(db, 'processing')
  }, { roastDate: roastDate || null, productUrl: productUrl || null });
  if (found.status !== 'ok') return Response.json(found);
  // A card shows (and a pick fills) the values in the data standards' form, the same as Fill from URL.
  const beans = found.beans.map((c) => ({ ...c, fields: standardizeBeanBase(EMPTY_FILL, { id: c.id, fields: c.fields }, { db }).fields }));
  return Response.json({ ...found, beans });
};
