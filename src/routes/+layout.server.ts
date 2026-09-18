import type { LayoutServerLoad } from './$types';
import { getDb, getLastDeployed } from '$lib/server/db';

export const load: LayoutServerLoad = ({ locals }) => {
  const db = getDb();
  const row = db
    .prepare(
      `SELECT MAX(updated_at) as dataUpdated FROM (
        SELECT updated_at FROM coffees
        UNION ALL
        SELECT updated_at FROM subscriptions
      )`
    )
    .get() as { dataUpdated: string | null };
  const lastDeployed = getLastDeployed(db);
  const lastUpdated = [row.dataUpdated, lastDeployed].filter((v): v is string => v != null).sort().at(-1) ?? null;
  return { lastUpdated, lastDeployed, isAdmin: locals.isAdmin };
};
