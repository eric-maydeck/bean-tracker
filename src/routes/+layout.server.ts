import type { LayoutServerLoad } from './$types';
import { getDb, getLastDeployed } from '$lib/server/db';
import { getActiveAlerts } from '$lib/server/alerts';
import { nameColor } from '$lib/nameColor';
import { contactEmailFor } from '$lib/aboutAi';
import { localToday } from '$lib/server/localToday';
import { recapReadyYear } from '$lib/server/recaps/store';
import { coverTone } from '$lib/server/recaps/select';
import { version } from '../../package.json';

export const load: LayoutServerLoad = ({ locals, url }) => {
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
  const alerts = locals.isAdmin ? getActiveAlerts(db) : [];
  // Coffee names in a keyword color, for CoffeeName's `text` mode (names inside headlines, labels and tips).
  // ponytail: scans every name per request (a few hundred rows); filter in SQL if that ever shows up in timings.
  const names = db.prepare('SELECT coffee_name AS n FROM coffees UNION SELECT name FROM beanconqueror_beans').all() as { n: string }[];
  const coloredNames = names.map((r) => r.n).filter((n) => nameColor(n));
  const recapReady = recapReadyYear(db, localToday(), locals.isAdmin);
  return { lastUpdated, lastDeployed, isAdmin: locals.isAdmin, version, alerts, coloredNames, contactEmail: contactEmailFor(url.host),
    recapReady, recapTone: recapReady ? coverTone(recapReady) : null };
};
