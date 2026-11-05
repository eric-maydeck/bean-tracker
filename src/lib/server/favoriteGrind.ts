import type { DatabaseSync } from 'node:sqlite';
import { parseMethod } from './insights/facts';
import { bcLocalTime } from './insights/time';

// The coffee page's "Favorite grind": per grinder used on a coffee's brews, the highest-rated brew's setting (ties: the
// latest brew), and a better-rated brew on that grinder from another bag of the same roaster + name (trimmed,
// case-insensitive), when there is one. Archived brews count, as everywhere else (insights/facts.ts).
export type GrindBrew = { setting: string | null; rating: number; dripper: string | null; filter: string | null; date: string };
export type OtherBag = GrindBrew & { slug: string; roastDate: string | null };
export type FavoriteGrind = { grinder: string; brews: number; best: GrindBrew | null; other: OtherBag | null };

type Row = { mill: string; grinder: string | null; setting: string | null; rating: number | null; method: string | null; tools: string | null; at: string; slug: string; roastDate: string | null };

const BREWS = `SELECT b.mill_id AS mill, g.name AS grinder, b.grind_setting AS setting, b.rating, m.name AS method, m.preparation_tools AS tools,
    b.bc_created_at AS at, c.slug, c.roast_date AS roastDate
  FROM beanconqueror_brews b
  JOIN beanconqueror_beans bean ON bean.id = b.bean_id
  JOIN coffees c ON c.id = bean.coffee_id
  LEFT JOIN beanconqueror_grinders g ON g.id = b.mill_id
  LEFT JOIN beanconqueror_methods m ON m.id = b.preparation_id
  WHERE b.mill_id IS NOT NULL AND `;

const brewOf = (r: Row): GrindBrew => ({ setting: r.setting, rating: r.rating!, ...parseMethod(r.method, r.tools), date: bcLocalTime(r.at).slice(0, 10) });
// Highest rating; the latest brew breaks a tie.
const better = (a: Row, b: Row) => b.rating! > a.rating! || (b.rating === a.rating && b.at > a.at);
const bestOf = (rows: Row[]) => rows.reduce<Row | null>((m, r) => (r.rating! > 0 && (!m || better(m, r)) ? r : m), null);

export function favoriteGrind(db: DatabaseSync, coffeeId: number): FavoriteGrind[] {
  const mine = db.prepare(`${BREWS} c.id = ?`).all(coffeeId) as Row[];
  const others = db
    .prepare(
      `${BREWS} c.id != ? AND lower(trim(c.roaster)) = (SELECT lower(trim(roaster)) FROM coffees WHERE id = ?)
        AND lower(trim(c.coffee_name)) = (SELECT lower(trim(coffee_name)) FROM coffees WHERE id = ?) AND b.rating > 0`
    )
    .all(coffeeId, coffeeId, coffeeId) as Row[];
  const out: FavoriteGrind[] = [];
  for (const mill of new Set(mine.map((r) => r.mill))) {
    const rows = mine.filter((r) => r.mill === mill);
    const best = bestOf(rows);
    const rival = bestOf(others.filter((r) => r.mill === mill));
    const beaten = rival && (!best || rival.rating! > best.rating!);
    out.push({
      grinder: rows[0].grinder ?? 'Unknown grinder',
      brews: rows.length,
      best: best && brewOf(best),
      other: beaten ? { ...brewOf(rival), slug: rival.slug, roastDate: rival.roastDate } : null
    });
  }
  return out.sort((a, b) => a.grinder.localeCompare(b.grinder));
}
