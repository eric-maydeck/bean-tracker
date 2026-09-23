import type { DatabaseSync } from 'node:sqlite';

export interface RatedGroup {
  label: string;
  averageRating: number;
  brewCount: number;
}

export interface BeanConquerorStats {
  totalBrews: number;
  totalBeans: number;
  averageRating: number | null;
  ratingsOverTime: { date: string; rating: number }[];
  favoritesByRoaster: RatedGroup[];
  favoritesByOrigin: RatedGroup[];
  favoritesByProcessing: RatedGroup[];
  favoritesByRoastLevel: RatedGroup[];
  byMethod: RatedGroup[];
  byGrinder: RatedGroup[];
  averageExtractionYieldPercent: number | null;
  averageTdsPercent: number | null;
  averageCostPerGram: number | null;
  costPerGramByRoaster: { label: string; averageCostPerGram: number }[];
}

// Minimum number of rated brews a group needs before it can appear in a
// Favorites/Brewing breakdown. Without it a single lucky 10/10 brew tops
// every chart, which the spec explicitly calls out. 3 is a deliberately
// modest default for a home-scale dataset; it's a pure display filter, so
// it can be retuned later with no schema or data impact.
const MIN_BREWS_PER_RATED_GROUP = 3;

// Every dimension below is a small "group brews by X, average their rating"
// query — same GROUP BY/AVG/COUNT shape, only the join and grouped column
// differ, so they all run through this one helper rather than duplicating
// the row-shaping logic five times.
function ratedGroups(db: DatabaseSync, sql: string): RatedGroup[] {
  return db.prepare(sql).all() as RatedGroup[];
}

function scalarOrNull(db: DatabaseSync, sql: string): number | null {
  const row = db.prepare(sql).get() as { value: number | null };
  return row.value ?? null;
}

export function buildBeanConquerorStats(db: DatabaseSync): BeanConquerorStats {
  const totalBrews = (db.prepare(`SELECT COUNT(*) AS value FROM beanconqueror_brews`).get() as { value: number })
    .value;
  const totalBeans = (db.prepare(`SELECT COUNT(*) AS value FROM beanconqueror_beans`).get() as { value: number })
    .value;
  const averageRating = scalarOrNull(db, `SELECT AVG(rating) AS value FROM beanconqueror_brews`);

  // One point per brew makes this chart unreadable at any real data volume
  // (a home-scale BeanConqueror history easily runs to hundreds of brews a
  // year) — averaged into Monday-starting weeks instead, so the line shows
  // an actual trend rather than a dense per-brew scatter. `date(..., 'weekday
  // 0', '-6 days')` is the standard SQLite recipe for "the Monday on/before
  // this date": it rolls forward to the next Sunday, then back 6 days.
  const ratingsOverTime = db
    .prepare(
      `SELECT date(bc_created_at, 'weekday 0', '-6 days') AS date, AVG(rating) AS rating
       FROM beanconqueror_brews
       WHERE rating IS NOT NULL
       GROUP BY date
       ORDER BY date ASC`
    )
    .all() as { date: string; rating: number }[];

  const favoritesByRoaster = ratedGroups(
    db,
    `SELECT bean.roaster AS label, AVG(brew.rating) AS averageRating, COUNT(*) AS brewCount
     FROM beanconqueror_brews brew
     JOIN beanconqueror_beans bean ON brew.bean_id = bean.id
     WHERE bean.roaster IS NOT NULL AND brew.rating IS NOT NULL
     GROUP BY bean.roaster
     HAVING COUNT(*) >= ${MIN_BREWS_PER_RATED_GROUP}
     ORDER BY averageRating DESC`
  );

  // Origin/processing come from each bean's primary component (component
  // 1) — a blend can have several origin rows per bean, and the primary
  // component is the one meaningful "this bean's origin" for a favorites
  // breakdown.
  const favoritesByOrigin = ratedGroups(
    db,
    `SELECT origin.country AS label, AVG(brew.rating) AS averageRating, COUNT(*) AS brewCount
     FROM beanconqueror_brews brew
     JOIN beanconqueror_beans bean ON brew.bean_id = bean.id
     JOIN beanconqueror_bean_origins origin ON origin.bean_id = bean.id AND origin.component_number = 1
     WHERE origin.country IS NOT NULL AND brew.rating IS NOT NULL
     GROUP BY origin.country
     HAVING COUNT(*) >= ${MIN_BREWS_PER_RATED_GROUP}
     ORDER BY averageRating DESC`
  );

  const favoritesByProcessing = ratedGroups(
    db,
    `SELECT origin.processing AS label, AVG(brew.rating) AS averageRating, COUNT(*) AS brewCount
     FROM beanconqueror_brews brew
     JOIN beanconqueror_beans bean ON brew.bean_id = bean.id
     JOIN beanconqueror_bean_origins origin ON origin.bean_id = bean.id AND origin.component_number = 1
     WHERE origin.processing IS NOT NULL AND brew.rating IS NOT NULL
     GROUP BY origin.processing
     HAVING COUNT(*) >= ${MIN_BREWS_PER_RATED_GROUP}
     ORDER BY averageRating DESC`
  );

  // Bean Conqueror stores roast as a numeric degree-of-roast rather than a
  // label; this app's own roast_levels table already maps that same degree
  // scale to the human-readable labels used throughout the rest of the app
  // (see roastLevels.ts), so joining on it here reuses that mapping instead
  // of inventing a second one.
  const favoritesByRoastLevel = ratedGroups(
    db,
    `SELECT rl.roast_level AS label, AVG(brew.rating) AS averageRating, COUNT(*) AS brewCount
     FROM beanconqueror_brews brew
     JOIN beanconqueror_beans bean ON brew.bean_id = bean.id
     JOIN roast_levels rl ON rl.degrees_of_roast = bean.degree_of_roast
     WHERE bean.degree_of_roast IS NOT NULL AND brew.rating IS NOT NULL
     GROUP BY rl.roast_level
     HAVING COUNT(*) >= ${MIN_BREWS_PER_RATED_GROUP}
     ORDER BY averageRating DESC`
  );

  const byMethod = ratedGroups(
    db,
    `SELECT method.name AS label, AVG(brew.rating) AS averageRating, COUNT(*) AS brewCount
     FROM beanconqueror_brews brew
     JOIN beanconqueror_methods method ON brew.preparation_id = method.id
     WHERE method.name IS NOT NULL AND brew.rating IS NOT NULL
     GROUP BY method.name
     HAVING COUNT(*) >= ${MIN_BREWS_PER_RATED_GROUP}
     ORDER BY averageRating DESC`
  );

  const byGrinder = ratedGroups(
    db,
    `SELECT grinder.name AS label, AVG(brew.rating) AS averageRating, COUNT(*) AS brewCount
     FROM beanconqueror_brews brew
     JOIN beanconqueror_grinders grinder ON brew.mill_id = grinder.id
     WHERE grinder.name IS NOT NULL AND brew.rating IS NOT NULL
     GROUP BY grinder.name
     HAVING COUNT(*) >= ${MIN_BREWS_PER_RATED_GROUP}
     ORDER BY averageRating DESC`
  );

  const averageExtractionYieldPercent = scalarOrNull(
    db,
    `SELECT AVG(extraction_yield_percent) AS value FROM beanconqueror_brews`
  );
  const averageTdsPercent = scalarOrNull(db, `SELECT AVG(tds_percent) AS value FROM beanconqueror_brews`);

  const averageCostPerGram = scalarOrNull(
    db,
    `SELECT AVG(cost * 1.0 / weight_g) AS value
     FROM beanconqueror_beans
     WHERE cost IS NOT NULL AND weight_g IS NOT NULL AND weight_g != 0`
  );

  const costPerGramByRoaster = db
    .prepare(
      `SELECT roaster AS label, AVG(cost * 1.0 / weight_g) AS averageCostPerGram
       FROM beanconqueror_beans
       WHERE cost IS NOT NULL AND weight_g IS NOT NULL AND weight_g != 0 AND roaster IS NOT NULL
       GROUP BY roaster
       ORDER BY averageCostPerGram ASC`
    )
    .all() as { label: string; averageCostPerGram: number }[];

  return {
    totalBrews,
    totalBeans,
    averageRating,
    ratingsOverTime,
    favoritesByRoaster,
    favoritesByOrigin,
    favoritesByProcessing,
    favoritesByRoastLevel,
    byMethod,
    byGrinder,
    averageExtractionYieldPercent,
    averageTdsPercent,
    averageCostPerGram,
    costPerGramByRoaster
  };
}
