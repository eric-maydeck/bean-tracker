import type { PageServerLoad } from './$types';
import { getDb } from '#lib/server/db.ts';
import { localTodayDate } from '#lib/server/localToday.ts';
import { getOpenCoffees, getBacklogCoffees } from '#lib/server/coffees.ts';
import { buildOnDeckData } from './onDeckData';

export const load: PageServerLoad = () => {
  const db = getDb();
  const today = localTodayDate();
  return buildOnDeckData(getOpenCoffees(db), getBacklogCoffees(db), today);
};
