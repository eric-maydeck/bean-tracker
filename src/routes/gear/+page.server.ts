import type { PageServerLoad } from './$types';
import { getDb } from '#lib/server/db.ts';
import { loadFacts } from '#lib/server/insights/facts.ts';
import { localToday } from '#lib/server/insights/time.ts';
import { dialInIds, onceDialed } from '#lib/server/insights/dialed.ts';
import { getGearDetails } from '#lib/server/gearDetails.ts';
import { trophyCase, gearArchive } from '#lib/server/insights/trophies.ts';

// Public, like /stats. Every piece of gear, all time, with Stats' defaults ("current" ratings, "once dialed" scoring),
// so a card matches Stats' All time view.
export const load: PageServerLoad = () => {
  const db = getDb();
  const { brews: everyBrew } = loadFacts(db);
  return { trophies: trophyCase(everyBrew, gearArchive(db), localToday(), { ratings: 'current', scored: onceDialed(everyBrew, dialInIds(everyBrew)) }, getGearDetails(db)) };
};
