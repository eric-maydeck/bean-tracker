import type { PageServerLoad } from './$types';
import { getDb } from '#lib/server/db.ts';
import { localToday, localTodayDate } from '#lib/server/localToday.ts';
import { getOpenCoffees, getBacklogCoffees, getNonArchivedCoffees } from '#lib/server/coffees.ts';
import { getUserKv } from '#lib/server/userKv.ts';
import { buildOnDeckData, buildPickCoffees } from './onDeckData';

export const load: PageServerLoad = ({ locals }) => {
  const db = getDb();
  const today = localTodayDate();
  // Stored rules and today's state are the signed-in user's; visitors get nulls.
  const kv = (key: string) => (locals.isAdmin ? getUserKv(db, 'admin', key) : null);
  return {
    ...buildOnDeckData(getOpenCoffees(db), getBacklogCoffees(db), today),
    pick: {
      coffees: buildPickCoffees(getNonArchivedCoffees(db), today),
      today: localToday(),
      rulesLast: kv('pick.rules.last'),
      profiles: kv('pick.profiles'),
      savedRules: kv('pick.rules.saved'), // the pre-profiles single copy, migrated to a profile "Saved"
      todayState: kv('pick.today')
    }
  };
};
