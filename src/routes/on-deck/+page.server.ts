import type { PageServerLoad } from './$types';
import { getDb } from '$lib/server/db';
import { getOpenCoffees, getBacklogCoffees } from '$lib/server/coffees';
import { buildOnDeckData } from './onDeckData';

export const load: PageServerLoad = () => {
  const db = getDb();
  const today = new Date();
  return buildOnDeckData(getOpenCoffees(db), getBacklogCoffees(db), today);
};
