import type { DatabaseSync } from 'node:sqlite';
import { autoLinkBeanConquerorBeans, getLinkableCoffees } from './beanConquerorLinks';

export interface ParsedBean {
  id: string;
  name: string;
  roaster: string | null;
  roastDate: string | null;
  roastType: string | null;
  degreeOfRoast: number | null;
  customDegreeOfRoast: string | null;
  blend: string | null;
  weightG: number | null;
  cost: number | null;
  aromatics: string | null;
  cuppingPoints: string | null;
  decaffeinated: boolean;
  url: string | null;
  eanArticleNumber: string | null;
  notes: string | null;
  rating: number | null;
  bcCreatedAt: string | null;
  bcArchived: boolean;
}

export interface ParsedBeanOrigin {
  beanId: string;
  componentNumber: number;
  country: string | null;
  region: string | null;
  farm: string | null;
  farmer: string | null;
  elevation: string | null;
  variety: string | null;
  processing: string | null;
  certification: string | null;
  harvested: string | null;
  percentage: number | null;
}

export interface ParsedMethod {
  id: string;
  preparationMethod: string | null;
  name: string | null;
  preparationStyle: string | null;
  preparationTools: string | null;
  notes: string | null;
  bcArchived: boolean;
  bcCreatedAt: string | null;
}

export interface ParsedGrinder {
  id: string;
  name: string | null;
  notes: string | null;
  bcArchived: boolean;
  bcCreatedAt: string | null;
}

export interface ParsedBrew {
  bcCreatedAt: string;
  beanId: string | null;
  preparationId: string | null;
  millId: string | null;
  grindSetting: string | null;
  groundCoffeeG: number | null;
  brewTemperature: number | null;
  beanType: string | null;
  grindSpeedRpm: number | null;
  grindTime: string | null;
  profile: string | null;
  preparationTools: string | null;
  temperatureTime: string | null;
  brewTime: string | null;
  bloomTime: string | null;
  firstDripTime: string | null;
  waterAmountG: number | null;
  coffeeType: string | null;
  coffeeConcentration: string | null;
  rating: number | null;
  notes: string | null;
  beverageQuantity: number | null;
  tdsPercent: number | null;
  extractionYieldPercent: number | null;
  brewRatio: string | null;
  beanAgeDays: number | null;
  bcArchived: boolean;
  water: string | null;
  bcUuid?: string;
  waterId?: string | null;
  bestBrew?: boolean;
  favourite?: boolean;
  vesselName?: string | null;
  hasFlowProfile?: boolean;
}

export interface ParsedWater {
  id: string;
  name: string;
  calcium: number | null;
  magnesium: number | null;
  sodium: number | null;
  potassium: number | null;
  chloride: number | null;
  sulfate: number | null;
  tds: number | null;
  storedGh: number | null;
  storedGhType: string | null;
  storedKh: number | null;
  storedKhType: string | null;
  type: string | null;
  note: string | null;
  bcArchived: boolean;
}

export interface ParsedBeanConquerorData {
  waters?: ParsedWater[];
  beans: ParsedBean[];
  beanOrigins: ParsedBeanOrigin[];
  methods: ParsedMethod[];
  grinders: ParsedGrinder[];
  brews: ParsedBrew[];
}

// Every column the brew upsert writes, in value order (see brewValues).
const BREW_COLUMNS = [
  'bc_created_at', 'bean_id', 'preparation_id', 'mill_id', 'grind_setting', 'ground_coffee_g',
  'brew_temperature', 'bean_type', 'grind_speed_rpm', 'grind_time', 'profile', 'preparation_tools',
  'temperature_time', 'brew_time', 'bloom_time', 'first_drip_time', 'water_amount_g', 'coffee_type',
  'coffee_concentration', 'rating', 'notes', 'beverage_quantity', 'tds_percent',
  'extraction_yield_percent', 'brew_ratio', 'bean_age_days', 'bc_archived', 'water',
  'water_id', 'best_brew', 'favourite', 'vessel_name', 'has_flow_profile', 'bc_uuid', 'imported_at'
];

function brewValues(br: ParsedBrew, now: string) {
  return [
    br.bcCreatedAt, br.beanId, br.preparationId, br.millId, br.grindSetting, br.groundCoffeeG,
    br.brewTemperature, br.beanType, br.grindSpeedRpm, br.grindTime, br.profile, br.preparationTools,
    br.temperatureTime, br.brewTime, br.bloomTime, br.firstDripTime, br.waterAmountG, br.coffeeType,
    br.coffeeConcentration, br.rating || null, br.notes, br.beverageQuantity, br.tdsPercent,
    br.extractionYieldPercent, br.brewRatio, br.beanAgeDays, br.bcArchived ? 1 : 0, br.water,
    br.waterId ?? null, br.bestBrew ? 1 : 0, br.favourite ? 1 : 0, br.vesselName ?? null,
    br.hasFlowProfile ? 1 : 0, br.bcUuid ?? null, now
  ];
}

export function importBeanConquerorData(db: DatabaseSync, parsed: ParsedBeanConquerorData): void {
  const now = new Date().toISOString();
  db.exec('BEGIN');
  try {
    // Auto-link only considers beans that are new in this import.
    const existingBeanIds = new Set(
      (db.prepare(`SELECT id FROM beanconqueror_beans`).all() as { id: string }[]).map((r) => r.id)
    );
    for (const b of parsed.beans) {
      db.prepare(
        `INSERT INTO beanconqueror_beans (
           id, name, roaster, roast_date, roast_type, degree_of_roast, custom_degree_of_roast,
           blend, weight_g, cost, aromatics, cupping_points, decaffeinated, url,
           ean_article_number, notes, rating, bc_created_at, bc_archived, imported_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           name = excluded.name, roaster = excluded.roaster, roast_date = excluded.roast_date,
           roast_type = excluded.roast_type, degree_of_roast = excluded.degree_of_roast,
           custom_degree_of_roast = excluded.custom_degree_of_roast, blend = excluded.blend,
           weight_g = excluded.weight_g, cost = excluded.cost, aromatics = excluded.aromatics,
           cupping_points = excluded.cupping_points, decaffeinated = excluded.decaffeinated,
           url = excluded.url, ean_article_number = excluded.ean_article_number,
           notes = excluded.notes, rating = excluded.rating, bc_created_at = excluded.bc_created_at,
           bc_archived = excluded.bc_archived, imported_at = excluded.imported_at`
      ).run(
        b.id, b.name, b.roaster, b.roastDate, b.roastType, b.degreeOfRoast, b.customDegreeOfRoast,
        b.blend, b.weightG, b.cost, b.aromatics, b.cuppingPoints, b.decaffeinated ? 1 : 0, b.url,
        b.eanArticleNumber, b.notes, b.rating || null, b.bcCreatedAt, b.bcArchived ? 1 : 0, now
      );
    }

    for (const o of parsed.beanOrigins) {
      db.prepare(
        `INSERT INTO beanconqueror_bean_origins (
           bean_id, component_number, country, region, farm, farmer, elevation,
           variety, processing, certification, harvested, percentage
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(bean_id, component_number) DO UPDATE SET
           country = excluded.country, region = excluded.region, farm = excluded.farm,
           farmer = excluded.farmer, elevation = excluded.elevation, variety = excluded.variety,
           processing = excluded.processing, certification = excluded.certification,
           harvested = excluded.harvested, percentage = excluded.percentage`
      ).run(
        o.beanId, o.componentNumber, o.country, o.region, o.farm, o.farmer, o.elevation,
        o.variety, o.processing, o.certification, o.harvested, o.percentage
      );
    }

    for (const m of parsed.methods) {
      db.prepare(
        `INSERT INTO beanconqueror_methods (
           id, preparation_method, name, preparation_style, preparation_tools, notes,
           bc_archived, bc_created_at, imported_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           preparation_method = excluded.preparation_method, name = excluded.name,
           preparation_style = excluded.preparation_style, preparation_tools = excluded.preparation_tools,
           notes = excluded.notes, bc_archived = excluded.bc_archived,
           bc_created_at = excluded.bc_created_at, imported_at = excluded.imported_at`
      ).run(m.id, m.preparationMethod, m.name, m.preparationStyle, m.preparationTools, m.notes, m.bcArchived ? 1 : 0, m.bcCreatedAt, now);
    }

    for (const g of parsed.grinders) {
      db.prepare(
        `INSERT INTO beanconqueror_grinders (id, name, notes, bc_archived, bc_created_at, imported_at)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           name = excluded.name, notes = excluded.notes, bc_archived = excluded.bc_archived,
           bc_created_at = excluded.bc_created_at, imported_at = excluded.imported_at`
      ).run(g.id, g.name, g.notes, g.bcArchived ? 1 : 0, g.bcCreatedAt, now);
    }

    for (const w of parsed.waters ?? []) {
      db.prepare(
        `INSERT INTO beanconqueror_waters (
           id, name, calcium, magnesium, sodium, potassium, chloride, sulfate, tds,
           stored_gh, stored_gh_type, stored_kh, stored_kh_type, type, note, bc_archived, imported_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           name = excluded.name, calcium = excluded.calcium, magnesium = excluded.magnesium,
           sodium = excluded.sodium, potassium = excluded.potassium, chloride = excluded.chloride,
           sulfate = excluded.sulfate, tds = excluded.tds, stored_gh = excluded.stored_gh,
           stored_gh_type = excluded.stored_gh_type, stored_kh = excluded.stored_kh,
           stored_kh_type = excluded.stored_kh_type, type = excluded.type, note = excluded.note,
           bc_archived = excluded.bc_archived, imported_at = excluded.imported_at`
      ).run(
        w.id, w.name, w.calcium, w.magnesium, w.sodium, w.potassium, w.chloride, w.sulfate, w.tds,
        w.storedGh, w.storedGhType, w.storedKh, w.storedKhType, w.type, w.note, w.bcArchived ? 1 : 0, now
      );
    }

    const findByUuid = db.prepare(`SELECT id FROM beanconqueror_brews WHERE bc_uuid = ?`);
    const findLegacy = db.prepare(
      `SELECT id FROM beanconqueror_brews
       WHERE bc_uuid IS NULL AND bc_created_at = ? AND COALESCE(bean_id, '') = COALESCE(?, '')`
    );
    const insertBrew = db.prepare(
      `INSERT INTO beanconqueror_brews (${BREW_COLUMNS.join(', ')}) VALUES (${BREW_COLUMNS.map(() => '?').join(', ')})`
    );
    const updateBrew = db.prepare(
      `UPDATE beanconqueror_brews SET ${BREW_COLUMNS.map((c) => `${c} = ?`).join(', ')} WHERE id = ?`
    );
    for (const br of parsed.brews) {
      // By UUID; else claim the legacy row once (it gets this UUID, so a
      // second brew with the same key finds nothing and is inserted).
      const row = ((br.bcUuid ? findByUuid.get(br.bcUuid) : undefined) ?? findLegacy.get(br.bcCreatedAt, br.beanId)) as
        | { id: number }
        | undefined;
      if (row) updateBrew.run(...brewValues(br, now), row.id);
      else insertBrew.run(...brewValues(br, now));
    }

    // The bean upsert above never writes coffee_id, so existing links survive.
    autoLinkBeanConquerorBeans(db, parsed.beans.map((b) => b.id).filter((id) => !existingBeanIds.has(id)));

    db.prepare(
      `INSERT INTO app_meta (key, value) VALUES ('beanconqueror_last_imported_at', ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`
    ).run(now);

    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

export interface LikelyMatch {
  id: number;
  slug: string;
  coffeeName: string;
  roastDate: string | null;
  status: string;
}

export interface UnmatchedBean extends ParsedBean {
  origin: string | null;
  processing: string | null;
  likelyMatch: LikelyMatch | null;
}

// Beyond this many days apart, two same-roaster same-ish-name entries are
// treated as separate purchases, not a formatting-only duplicate of the
// same bag — confirmed against real data: this user's genuine repurchases
// of the same coffee are always weeks-to-months apart (one case: the same
// coffee bought 3 separate times), while true duplicates caused by
// inconsistent recording between Bean Conqueror and this site are same-day
// or off by at most a couple of days.
const LIKELY_MATCH_DATE_WINDOW_DAYS = 7;

function normalizeForMatch(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // strip diacritics: "Corazón" -> "Corazon"
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

// Small hand-rolled edit distance — no fuzzy-matching dependency justified
// for comparing a handful of short coffee names per import.
function levenshteinDistance(a: string, b: string): number {
  const dp: number[][] = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
  for (let i = 0; i <= a.length; i++) dp[i][0] = i;
  for (let j = 0; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[a.length][b.length];
}

// Exact-after-normalizing (accents/case/punctuation) or one name containing
// the other (a country/varietal prefix or suffix one side omits) catch most
// real duplicates outright; the similarity ratio on top only exists to
// catch a single-character typo ("Boquette"/"Boquete") that's neither.
// Deliberately does NOT try to bridge reordered/inserted words (e.g.
// "Mejorada #4732" vs "Natural Mejorada") — false negatives here just leave
// a candidate unflagged (same as today), while a looser rule risks flagging
// two genuinely different processing lots ("... Gesha Washed" vs "...
// Gesha Natural") as a likely match, which is the worse failure mode.
function namesLikelyMatch(a: string, b: string): boolean {
  const normA = normalizeForMatch(a);
  const normB = normalizeForMatch(b);
  if (!normA || !normB) return false;
  if (normA === normB || normA.includes(normB) || normB.includes(normA)) return true;
  const distance = levenshteinDistance(normA, normB);
  const similarity = 1 - distance / Math.max(normA.length, normB.length);
  return similarity >= 0.9;
}

export interface LikelyMatchCandidate {
  slug: string;
  coffee_name: string;
  roaster: string;
  roast_date: string | null;
  status: string;
}

function daysBetween(a: string, b: string): number {
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.abs(new Date(a).getTime() - new Date(b).getTime()) / msPerDay;
}

// Ranks a same-roaster, same-ish-name coffee with a real roast date within
// the window above the best real-date match found so far, but a missing
// roast date on either side (some older Bean Conqueror beans have none)
// still qualifies as a fallback — it's just outranked by any candidate we
// can actually confirm is close in time.
export function findLikelyMatch<T extends LikelyMatchCandidate>(
  bean: { name: string; roaster: string | null; roastDate: string | null },
  coffees: T[]
): T | null {
  if (!bean.roaster) return null;
  const normalizedRoaster = normalizeForMatch(bean.roaster);
  let best: T | null = null;
  let bestScore = Infinity;
  for (const coffee of coffees) {
    if (normalizeForMatch(coffee.roaster) !== normalizedRoaster) continue;
    if (!namesLikelyMatch(bean.name, coffee.coffee_name)) continue;
    let score: number;
    if (bean.roastDate && coffee.roast_date) {
      const diff = daysBetween(bean.roastDate, coffee.roast_date);
      if (diff > LIKELY_MATCH_DATE_WINDOW_DAYS) continue;
      score = diff;
    } else {
      score = LIKELY_MATCH_DATE_WINDOW_DAYS;
    }
    if (score < bestScore) {
      bestScore = score;
      best = coffee;
    }
  }
  return best;
}

// Shared by getUnmatchedBeanConquerorBeans and countUnmatchedBeanConquerorBeans.
// Tracked means linked (beanconqueror_beans.coffee_id); the exact text match
// only feeds the backfill and auto-link (beanConquerorLinks.ts).
const UNMATCHED_BEAN_WHERE = `WHERE b.dismissed_at IS NULL AND b.coffee_id IS NULL`;

export function countUnmatchedBeanConquerorBeans(db: DatabaseSync): number {
  const row = db.prepare(`SELECT COUNT(*) c FROM beanconqueror_beans b ${UNMATCHED_BEAN_WHERE}`).get() as { c: number };
  return row.c;
}

export function getUnmatchedBeanConquerorBeans(db: DatabaseSync, limit: number): UnmatchedBean[] {
  const rows = db
    .prepare(
      `SELECT b.* FROM beanconqueror_beans b
       ${UNMATCHED_BEAN_WHERE}
       -- Ordered by the bean's own Bean Conqueror creation timestamp, not
       -- by imported_at: every row from a single import shares one
       -- imported_at value (set once per importBeanConquerorData call), so
       -- ordering by it ties on every row and SQLite falls back to
       -- arbitrary rowid order. bc_created_at actually differs per bean,
       -- giving a genuine newest-bean-first list.
       ORDER BY b.bc_created_at DESC
       LIMIT ?`
    )
    .all(limit) as Array<{
    id: string;
    name: string;
    roaster: string | null;
    roast_date: string | null;
    roast_type: string | null;
    degree_of_roast: number | null;
    custom_degree_of_roast: string | null;
    blend: string | null;
    weight_g: number | null;
    cost: number | null;
    aromatics: string | null;
    cupping_points: string | null;
    decaffeinated: number;
    url: string | null;
    ean_article_number: string | null;
    notes: string | null;
    rating: number | null;
    bc_created_at: string | null;
    bc_archived: number;
  }>;

  // Only coffees without a bean can be linked, so only they can be suggested.
  const coffees = getLinkableCoffees(db);

  return rows.map((r) => {
    const origin = db
      .prepare(
        `SELECT country, processing FROM beanconqueror_bean_origins WHERE bean_id = ? ORDER BY component_number ASC LIMIT 1`
      )
      .get(r.id) as { country: string | null; processing: string | null } | undefined;
    const likelyMatch = findLikelyMatch({ name: r.name, roaster: r.roaster, roastDate: r.roast_date }, coffees);
    return {
      id: r.id,
      name: r.name,
      roaster: r.roaster,
      roastDate: r.roast_date,
      roastType: r.roast_type,
      degreeOfRoast: r.degree_of_roast,
      customDegreeOfRoast: r.custom_degree_of_roast,
      blend: r.blend,
      weightG: r.weight_g,
      cost: r.cost,
      aromatics: r.aromatics,
      cuppingPoints: r.cupping_points,
      decaffeinated: r.decaffeinated === 1,
      url: r.url,
      eanArticleNumber: r.ean_article_number,
      notes: r.notes,
      rating: r.rating,
      bcCreatedAt: r.bc_created_at,
      bcArchived: r.bc_archived === 1,
      origin: origin?.country ?? null,
      processing: origin?.processing ?? null,
      likelyMatch: likelyMatch
        ? {
            id: likelyMatch.id,
            slug: likelyMatch.slug,
            coffeeName: likelyMatch.coffee_name,
            roastDate: likelyMatch.roast_date,
            status: likelyMatch.status
          }
        : null
    };
  });
}

export function dismissBeanConquerorBean(db: DatabaseSync, id: string): void {
  db.prepare(`UPDATE beanconqueror_beans SET dismissed_at = ? WHERE id = ?`).run(new Date().toISOString(), id);
}
