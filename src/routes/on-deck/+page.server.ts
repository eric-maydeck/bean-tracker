import type { PageServerLoad } from './$types';
import { getDb } from '$lib/server/db';
import { localTodayDate } from '$lib/server/localToday';
import { getOpenCoffees, getBacklogCoffees } from '$lib/server/coffees';
import { buildOnDeckData } from './onDeckData';

export const load: PageServerLoad = () => {
  const db = getDb();
  const today = localTodayDate();
  return buildOnDeckData(getOpenCoffees(db), getBacklogCoffees(db), today);
};
