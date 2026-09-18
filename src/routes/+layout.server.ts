import type { LayoutServerLoad } from './$types';
import { getDb } from '$lib/server/db';

export const load: LayoutServerLoad = () => {
  const db = getDb();
  const row = db.prepare('SELECT MAX(updated_at) as lastUpdated FROM coffees').get() as {
    lastUpdated: string | null;
  };
  return { lastUpdated: row.lastUpdated };
};
