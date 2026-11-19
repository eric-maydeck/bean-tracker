import type { PageServerLoad } from './$types';
import { getDb } from '#lib/server/db.ts';
import { localToday, localTodayDate } from '#lib/server/localToday.ts';
import { getOpenCoffees, getBacklogCoffees, getNonArchivedCoffees } from '#lib/server/coffees.ts';
import { getRoastLevels } from '#lib/server/roastLevels.ts';
import { getUserKv } from '#lib/server/userKv.ts';
import { getSharedProfile } from '#lib/server/pickShared.ts';
import { decodeRulesLink, parseDefaultRules, parseProfile, parseRulesCode } from './onDeckUrl';
import { buildOnDeckData, buildPickCoffees } from './onDeckData';

export const load: PageServerLoad = ({ locals, url }) => {
  const db = getDb();
  const today = localTodayDate();
  // Stored rules and today's state are the signed-in user's; visitors get nulls.
  const kv = (key: string) => (locals.isAdmin ? getUserKv(db, 'admin', key) : null);
  // A shared link names one of the owner's profiles ('admin' until there are per-user paths; anyone may read that one) or asks for the default rules.
  const asked = parseProfile(url.searchParams);
  const found = asked ? getSharedProfile(db, 'admin', asked) : null;
  const code = asked ? undefined : parseRulesCode(url.searchParams);
  const decoded = code ? decodeRulesLink(code) : null; // untrusted: checked and validated like stored rules
  const shared = asked
    ? (found ?? { name: asked, missing: true as const })
    : code
      ? decoded ? { ...decoded, code: code as string } : { unreadable: true as const }
      : parseDefaultRules(url.searchParams) ? { defaults: true as const } : null;
  return {
    ...buildOnDeckData(getOpenCoffees(db), getBacklogCoffees(db), today),
    pick: {
      coffees: buildPickCoffees(getNonArchivedCoffees(db), today, new Map(getRoastLevels(db).map((r) => [r.roast_level, r.degrees_of_roast]))),
      today: localToday(),
      rulesLast: kv('pick.rules.last'),
      profiles: kv('pick.profiles'),
      savedRules: kv('pick.rules.saved'), // the pre-profiles single copy, migrated to a profile "Saved"
      todayState: kv('pick.today'),
      selectedProfile: kv('pick.profile.selected'),
      shared
    }
  };
};
