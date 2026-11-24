import type { PageServerLoad } from './$types';
import { getDb } from '#lib/server/db.ts';
import { loadFacts } from '#lib/server/insights/facts.ts';
import { localToday } from '#lib/server/insights/time.ts';
import { dialInIds, onceDialed } from '#lib/server/insights/dialed.ts';
import { getGearDetails } from '#lib/server/gearDetails.ts';
import { labOptions } from '#lib/server/insights/lab.ts';
import { trophyCase, gearArchive, statsLinks } from '#lib/server/insights/trophies.ts';

// Public, like /stats. Every piece of gear, all time, with Stats' defaults ("current" ratings, "once dialed" scoring),
// so a card matches Stats' All time view.
export const load: PageServerLoad = () => {
  const db = getDb();
  const { brews: everyBrew, bags } = loadFacts(db);
  const trophies = trophyCase(everyBrew, gearArchive(db), localToday(), { ratings: 'current', scored: onceDialed(everyBrew, dialInIds(everyBrew)) }, getGearDetails(db));
  // Brews with two or more filters ticked: one is probably an accessory, so the page links to the first such brew's first filter.
  const two = everyBrew.filter((b) => (b.filters?.length ?? 0) >= 2);
  const first = trophies.find((t) => t.kind === 'filter' && t.name === two[0]?.filters?.[0]);
  const doubleFilter = two.length && first ? { brews: two.length, firstKey: first.key } : null;
  return { trophies, doubleFilter, statsLinks: statsLinks(trophies, labOptions(everyBrew, bags)) };
};
