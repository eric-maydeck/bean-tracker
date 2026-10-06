import type { DatabaseSync } from 'node:sqlite';

export interface RatedGroup {
  label: string;
  averageRating: number;
  brewCount: number;
}

// Trailing windows ending today, for the per-day/per-brew-day/rating tiles.
// null days = all time (first brew day through today).
export const PERIOD_WINDOWS = { all: null, year: 365, month: 30, week: 7 } as const;
export type PeriodWindow = keyof typeof PERIOD_WINDOWS;

export interface PeriodAverages {
  window: PeriodWindow;
  brewsPerDay: number | null;
  brewsPerBrewDay: number | null;
  gramsPerDay: number | null;
  gramsPerBrewDay: number | null;
  rating: number | null;
}

export interface BeanConquerorStats {
  totalBrews: number;
  totalBeans: number;
  averageRating: number | null;
  totalGramsBrewed: number | null;
  ratingsOverTime: { date: string; rating: number }[];
  periodAverages: PeriodAverages[];
  brewsPerDay: { date: string; brews: number; rollingAverage: number; grams: number; gramsRollingAverage: number }[];
  favoritesByRoaster: RatedGroup[];
  favoritesByOrigin: RatedGroup[];
  favoritesByProcessing: RatedGroup[];
  favoritesByRoastLevel: RatedGroup[];
  byMethod: RatedGroup[];
  byGrinder: RatedGroup[];
  averageBrewTemperatureC: number | null;
  averageBeanAgeAtBrewDays: number | null;
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

function addDays(isoDate: string, days: number): string {
  return new Date(Date.parse(isoDate) + days * 86_400_000).toISOString().slice(0, 10);
}

function scalarOrNull(db: DatabaseSync, sql: string): number | null {
  const row = db.prepare(sql).get() as { value: number | null };
  return row.value ?? null;
}

export function buildBeanConquerorStats(
  db: DatabaseSync,
  today: string = new Date().toISOString().slice(0, 10)
): BeanConquerorStats {
  const totalBrews = (db.prepare(`SELECT COUNT(*) AS value FROM beanconqueror_brews`).get() as { value: number })
    .value;
  const totalBeans = (db.prepare(`SELECT COUNT(*) AS value FROM beanconqueror_beans`).get() as { value: number })
    .value;
  const averageRating = scalarOrNull(db, `SELECT AVG(rating) AS value FROM beanconqueror_brews`);
  // SUM skips NULL doses, and is NULL itself when no brew has one.
  const totalGramsBrewed = scalarOrNull(db, `SELECT SUM(ground_coffee_g) AS value FROM beanconqueror_brews`);


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

  // One row per calendar day from the first brew to the last, with no-brew
  // days filled in as 0 by the recursive `days` CTE — a gap has to read as
  // "no coffee that day", not be skipped over by the line. rollingAverage is
  // a trailing 7-day mean; the first 6 days average over however many days
  // exist so far (a partial window), so the line starts at day 1 rather than
  // leaving a hole. grams/gramsRollingAverage are the same series over
  // ground_coffee_g (a brew with no recorded dose counts as 0g but still
  // counts as a brew). On an empty table MIN() is NULL, so the CTE yields just
  // that one NULL row, filtered out below.
  const brewsPerDay = db
    .prepare(
      `WITH RECURSIVE days(date) AS (
         SELECT date(MIN(bc_created_at)) FROM beanconqueror_brews
         UNION ALL
         SELECT date(date, '+1 day') FROM days
         WHERE date < (SELECT date(MAX(bc_created_at)) FROM beanconqueror_brews)
       ),
       counts AS (
         SELECT date(bc_created_at) AS date, COUNT(*) AS brews, TOTAL(ground_coffee_g) AS grams
         FROM beanconqueror_brews GROUP BY 1
       )
       SELECT days.date, COALESCE(counts.brews, 0) AS brews,
              AVG(COALESCE(counts.brews, 0)) OVER week AS rollingAverage,
              COALESCE(counts.grams, 0) AS grams,
              AVG(COALESCE(counts.grams, 0)) OVER week AS gramsRollingAverage
       FROM days LEFT JOIN counts ON counts.date = days.date
       WHERE days.date IS NOT NULL
       WINDOW week AS (ORDER BY days.date ROWS 6 PRECEDING)
       ORDER BY days.date ASC`
    )
    .all() as BeanConquerorStats['brewsPerDay'];
  // Each window's start is clamped to the first brew day, so a new user's
  // "last year" isn't diluted by days before they used the app. "Per day"
  // divides by every calendar day in the window (no-brew days count as 0);
  // "per brew day" only by days with at least one brew, so it's null for a
  // window with no brews. AVG(rating) already skips unrated brews.
  const firstBrewDay = brewsPerDay[0]?.date;
  const windowTotals = db.prepare(
    `SELECT COUNT(*) AS brews, TOTAL(ground_coffee_g) AS grams,
            COUNT(DISTINCT date(bc_created_at)) AS brewDays, AVG(rating) AS rating
     FROM beanconqueror_brews WHERE date(bc_created_at) BETWEEN ? AND ?`
  );
  const periodAverages = (Object.entries(PERIOD_WINDOWS) as [PeriodWindow, number | null][]).map(
    ([window, length]): PeriodAverages => {
      const windowStart = length === null ? firstBrewDay : addDays(today, 1 - length);
      const start = firstBrewDay && windowStart && windowStart > firstBrewDay ? windowStart : firstBrewDay;
      const days = start ? Math.round((Date.parse(today) - Date.parse(start)) / 86_400_000) + 1 : 0;
      if (!start || days < 1) {
        return { window, brewsPerDay: null, brewsPerBrewDay: null, gramsPerDay: null, gramsPerBrewDay: null, rating: null };
      }
      const t = windowTotals.get(start, today) as { brews: number; grams: number; brewDays: number; rating: number | null };
      return {
        window,
        brewsPerDay: t.brews / days,
        brewsPerBrewDay: t.brewDays ? t.brews / t.brewDays : null,
        gramsPerDay: t.grams / days,
        gramsPerBrewDay: t.brewDays ? t.grams / t.brewDays : null,
        rating: t.rating
      };
    }
  );

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

  // extraction_yield_percent/tds_percent were dropped here: Bean Conqueror
  // stores 0 (not NULL) for a brew where these were never entered, and for
  // this user's whole 1270-brew history every single one is exactly 0 —
  // an always-0.0% tile carries no information. brew_temperature and
  // bean_age_days use the same "0 means not entered" convention for a
  // missing brew_temperature reading, so that one's still filtered; a
  // brewed-on-roast-day bean_age_days of 0 is a real value, so that one
  // only filters NULL.
  const averageBrewTemperatureC = scalarOrNull(
    db,
    `SELECT AVG(brew_temperature) AS value FROM beanconqueror_brews
     WHERE brew_temperature IS NOT NULL AND brew_temperature != 0`
  );
  const averageBeanAgeAtBrewDays = scalarOrNull(
    db,
    `SELECT AVG(bean_age_days) AS value FROM beanconqueror_brews WHERE bean_age_days IS NOT NULL`
  );

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
       ORDER BY averageCostPerGram DESC`
    )
    .all() as { label: string; averageCostPerGram: number }[];

  return {
    totalBrews,
    totalBeans,
    averageRating,
    totalGramsBrewed,
    ratingsOverTime,
    periodAverages,
    brewsPerDay,
    favoritesByRoaster,
    favoritesByOrigin,
    favoritesByProcessing,
    favoritesByRoastLevel,
    byMethod,
    byGrinder,
    averageBrewTemperatureC,
    averageBeanAgeAtBrewDays,
    averageCostPerGram,
    costPerGramByRoaster
  };
}
