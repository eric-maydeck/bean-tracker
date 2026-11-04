import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { schema } from './schema.ts';
import { COFFEE_ORIGIN_FIELDS } from '../types.ts';
import { applyCoffeeFixes } from './coffees.ts';
import { PRODUCT_PAGE_BACKFILLS } from './productPageBackfill.ts';
import { BEAN_DATA_BACKFILLS } from './beanDataBackfill.ts';
import { COFFEE_CORRECTIONS } from './coffeeCorrections.ts';
import { applySubscriptionUrls, SUBSCRIPTION_URLS_2026_10_08 } from './subscriptions.ts';
import { backfillBeanConquerorLinks, applyBeanConquerorPairs } from './beanConquerorLinks.ts';
import { applySubscriptionLinks, SUBSCRIPTION_LINKS_2026_10, SUBSCRIPTION_LINKS_2026_10_MARKER } from './subscriptionLinks.ts';
import { applyImageSources } from './imageSourceFixes.ts';
import { IMAGE_SOURCES_2026_10 } from './imageSourceData.ts';
import { applyRecipeFixes, applyRecipeLengthFix } from './recipeFixes.ts';
import { BEAN_CONQUEROR_PAIRS, PAIRS_2026_10B, PAIRS_2026_10B_MARKER, FIXES_2026_10B, PAIRS_2026_11, PAIRS_2026_11_MARKER } from './beanConquerorPairs.ts';
import { OWN_DATA_ONLY, OWN_DATA_SIMILAR } from '../gear.ts';
import { generateBaseSlug, uniqueSlug } from './slug.ts';
import { applyRoasterImageDefaults } from './roasterImages.ts';
import { ROASTER_IMAGE_DEFAULTS, ROASTER_IMAGE_DEFAULTS_MARKER, ROASTER_IMAGE_DEFAULTS_2026_10B, ROASTER_IMAGE_DEFAULTS_2026_10B_MARKER } from './roasterImageDefaults.ts';

// Returns true the moment the column is actually added, false if it already
// existed — callers use this to run a backfill exactly once, rather than on
// every process boot (which would clobber any manual edit made afterward).
function ensureColumn(db: DatabaseSync, table: string, column: string, type: string): boolean {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
  if (!columns.some((c) => c.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`);
    return true;
  }
  return false;
}

function dropColumnIfExists(db: DatabaseSync, table: string, column: string): void {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
  if (columns.some((c) => c.name === column)) {
    db.exec(`ALTER TABLE ${table} DROP COLUMN ${column}`);
  }
}

function migrateStatusValues(db: DatabaseSync): void {
  db.exec(`UPDATE coffees SET status = 'backlog' WHERE status = 'active'`);
  db.exec(`UPDATE coffees SET status = 'archive' WHERE status = 'finished'`);
}

// Measured rates replaced the hand-set ones (stats-per-person spec). Every boot; idempotent.
function dropHandSetRates(db: DatabaseSync): void {
  db.exec(`DELETE FROM app_meta WHERE key IN ('stats_rate_self_g_per_day', 'stats_rate_household_g_per_day')`);
}

function backfillSlugs(db: DatabaseSync): void {
  const rows = db
    .prepare(`SELECT id, roaster, coffee_name, roast_date, created_at FROM coffees WHERE slug IS NULL`)
    .all() as {
    id: number;
    roaster: string;
    coffee_name: string;
    roast_date: string | null;
    created_at: string;
  }[];
  for (const row of rows) {
    const base = generateBaseSlug({
      roaster: row.roaster,
      coffeeName: row.coffee_name,
      roastDate: row.roast_date,
      createdAt: row.created_at
    });
    const slug = uniqueSlug(db, base);
    db.prepare(`UPDATE coffees SET slug = ? WHERE id = ?`).run(slug, row.id);
  }
}

export function applySchema(db: DatabaseSync): void {
  db.exec(schema);
  // Databases created before these columns existed need them added on top
  // of CREATE TABLE IF NOT EXISTS, which only applies to brand-new tables.
  ensureColumn(db, 'alerts', 'href', 'TEXT');
  ensureColumn(db, 'coffees', 'image_url', 'TEXT');
  ensureColumn(db, 'coffees', 'slug', 'TEXT');
  ensureColumn(db, 'coffees', 'opened_date', 'TEXT');
  ensureColumn(db, 'coffees', 'product_url', 'TEXT');
  ensureColumn(db, 'coffees', 'image_source_url', 'TEXT');
  ensureColumn(db, 'coffees', 'subscription_id', 'INTEGER REFERENCES subscriptions(id) ON DELETE SET NULL');
  for (const f of COFFEE_ORIGIN_FIELDS) ensureColumn(db, 'coffees', f, 'TEXT');
  ensureColumn(db, 'subscriptions', 'updated_at', 'TEXT');
  ensureColumn(db, 'subscriptions', 'renewal_day', 'INTEGER');
  ensureColumn(db, 'subscriptions', 'subscription_url', 'TEXT');
  ensureColumn(db, 'subscriptions', 'paused', 'INTEGER NOT NULL DEFAULT 0');
  // Bean Conqueror JSON import (spec 2026-10-09): brews get their UUID and new fields.
  ensureColumn(db, 'beanconqueror_brews', 'water_id', 'TEXT REFERENCES beanconqueror_waters(id)');
  ensureColumn(db, 'beanconqueror_brews', 'best_brew', 'INTEGER NOT NULL DEFAULT 0');
  ensureColumn(db, 'beanconqueror_brews', 'favourite', 'INTEGER NOT NULL DEFAULT 0');
  ensureColumn(db, 'beanconqueror_brews', 'vessel_name', 'TEXT');
  ensureColumn(db, 'beanconqueror_brews', 'has_flow_profile', 'INTEGER NOT NULL DEFAULT 0');
  ensureColumn(db, 'beanconqueror_brews', 'bc_uuid', 'TEXT');
  // Brews are identified by bc_uuid. The old (bc_created_at, bean) key only
  // identifies legacy xlsx rows (no UUID yet): two real brews share one
  // (same second, same bean), so it can't be unique once both are imported.
  db.exec(`DROP INDEX IF EXISTS beanconqueror_brews_identity;
    CREATE UNIQUE INDEX IF NOT EXISTS beanconqueror_brews_uuid ON beanconqueror_brews(bc_uuid);
    CREATE UNIQUE INDEX IF NOT EXISTS beanconqueror_brews_legacy_identity
      ON beanconqueror_brews (bc_created_at, COALESCE(bean_id, '')) WHERE bc_uuid IS NULL;`);
  // Bean Conqueror bean → coffee link (one-to-one). SQLite allows many NULLs
  // in a unique index. Backfill only the moment the column is added, so a
  // later Unlink survives restarts.
  // Atomic: a crash between the ADD COLUMN and the backfill must not skip it forever.
  db.exec('BEGIN');
  try {
    const bcLinkJustAdded = ensureColumn(
      db,
      'beanconqueror_beans',
      'coffee_id',
      'INTEGER REFERENCES coffees(id) ON DELETE SET NULL'
    );
    if (bcLinkJustAdded) backfillBeanConquerorLinks(db);
    db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS beanconqueror_beans_coffee ON beanconqueror_beans(coffee_id)`);
    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
  applyBeanConquerorPairs(db, BEAN_CONQUEROR_PAIRS); // own transaction, so after the COMMIT above
  applyBeanConquerorPairs(db, PAIRS_2026_10B, FIXES_2026_10B, PAIRS_2026_10B_MARKER);
  applyBeanConquerorPairs(db, PAIRS_2026_11, [], PAIRS_2026_11_MARKER);
  applyRoasterImageDefaults(db, ROASTER_IMAGE_DEFAULTS, ROASTER_IMAGE_DEFAULTS_MARKER);
  applyRoasterImageDefaults(db, ROASTER_IMAGE_DEFAULTS_2026_10B, ROASTER_IMAGE_DEFAULTS_2026_10B_MARKER);
  for (const b of PRODUCT_PAGE_BACKFILLS) applyCoffeeFixes(db, b); // own transaction each, after roaster defaults
  for (const b of BEAN_DATA_BACKFILLS) applyCoffeeFixes(db, b); // reviewed origin/amount/cost fixes + unlinked deletes
  for (const b of COFFEE_CORRECTIONS) applyCoffeeFixes(db, b);
  applyImageSources(db, IMAGE_SOURCES_2026_10);
  applySubscriptionUrls(db, SUBSCRIPTION_URLS_2026_10_08, 'subscription_urls_2026_10_08');
  applySubscriptionLinks(db, SUBSCRIPTION_LINKS_2026_10, SUBSCRIPTION_LINKS_2026_10_MARKER);
  applyRecipeFixes(db);
  applyRecipeLengthFix(db);
  // computeFill's solid-border rule changed, so cached fills may be wrong; drop
  // them once and the background run refills every displayed URL at boot.
  if (!db.prepare(`SELECT 1 FROM app_meta WHERE key = ?`).get('image_fills_recompute_2026_10_06')) {
    db.exec('BEGIN');
    db.exec(`DELETE FROM image_fills`);
    db.prepare(`INSERT INTO app_meta (key, value) VALUES (?, ?)`).run('image_fills_recompute_2026_10_06', new Date().toISOString());
    db.exec('COMMIT');
  }
  // The Shoebox roaster default (a transparent logo) on its labels' green
  // rather than the computed tan (user request). A later full recompute (like
  // the one above) would drop it; re-add it then.
  if (!db.prepare(`SELECT 1 FROM app_meta WHERE key = ?`).get('shoebox_logo_fill_2026_10_08')) {
    db.exec('BEGIN');
    db.prepare(
      `INSERT INTO image_fills (url, fill) VALUES (?, ?) ON CONFLICT(url) DO UPDATE SET fill = excluded.fill`
    ).run('https://shoebox.coffee/cdn/shop/files/Main.png?v=1737911185', '#9ae197');
    db.prepare(`INSERT INTO app_meta (key, value) VALUES (?, ?)`).run('shoebox_logo_fill_2026_10_08', new Date().toISOString());
    db.exec('COMMIT');
  }
  // image_copies' kind CHECK gained 'gear' (gear showcase): SQLite can't alter a CHECK, so rebuild an older table once.
  if (!(db.prepare(`SELECT sql FROM sqlite_master WHERE name = 'image_copies'`).get() as { sql: string }).sql.includes("'gear'")) {
    db.exec(`BEGIN; ALTER TABLE image_copies RENAME TO image_copies_old;
      CREATE TABLE image_copies (url TEXT NOT NULL, kind TEXT NOT NULL CHECK (kind IN ('coffees', 'roasters', 'gear')),
        file TEXT NOT NULL, PRIMARY KEY (url, kind));
      INSERT INTO image_copies SELECT url, kind, file FROM image_copies_old; DROP TABLE image_copies_old; COMMIT;`);
  }
  dropColumnIfExists(db, 'subscriptions', 'purchased');
  // Bean Conqueror's default rating is 0, which it shows as "no rating";
  // imports now store it as NULL. Idempotent, so it just runs every boot.
  db.exec(`UPDATE beanconqueror_brews SET rating = NULL WHERE rating = 0;
           UPDATE beanconqueror_beans SET rating = NULL WHERE rating = 0;`);
  const decafJustAdded = ensureColumn(db, 'coffees', 'decaf', 'INTEGER NOT NULL DEFAULT 0');
  if (decafJustAdded) {
    // One-time backfill for pre-existing rows: several coffees already had
    // "Decaf"/"Decaffeinated" in their name or processing method before this
    // column existed (e.g. processing "Natural, EA Decaf" or "Thermal Shock
    // Decaffeinated Washed" with a coffee_name that doesn't mention it at
    // all). Only runs the moment the column is added, never again — so a
    // later manual override always sticks, even across restarts.
    db.exec(
      `UPDATE coffees SET decaf = 1
       WHERE coffee_name LIKE '%decaf%' COLLATE NOCASE
          OR processing LIKE '%decaf%' COLLATE NOCASE`
    );
  }
  // Single origin / Blend: the only real blend (user, 2026-11-01). Runs only the moment the column is added.
  if (ensureColumn(db, 'coffees', 'blend', 'INTEGER NOT NULL DEFAULT 0')) {
    const ids = db.prepare(`SELECT id FROM coffees WHERE roaster = ? AND coffee_name = ?`)
      .all('S&W Craft Roasting', "Teddy's Terror (blend)") as { id: number }[];
    for (const { id } of ids) db.prepare(`UPDATE coffees SET blend = 1, origin = 'Blend' WHERE id = ?`).run(id);
  }
  // Brew now: the user's own dripper/filter suggest from their own brews only. Once; a later edit sticks.
  if (!db.prepare(`SELECT 1 FROM app_meta WHERE key = ?`).get('brew_now_own_data_2026_10c')) {
    // Unshipped wording changes: carry any earlier values over to the current strings.
    const rename = db.prepare(`UPDATE gear_details SET fields = json_set(fields, '$.ownData', ?) WHERE json_extract(fields, '$.ownData') IN (?, ?)`);
    rename.run(OWN_DATA_ONLY, 'This gear only', 'Own brews only');
    rename.run(OWN_DATA_SIMILAR, 'Similar gear too', 'Similar gear');
    const set = db.prepare(
      `UPDATE gear_details SET fields = json_set(fields, '$.ownData', '${OWN_DATA_ONLY.replace(/'/g, "''")}') WHERE kind = ? AND name = ?`
    );
    set.run('dripper', 'Graycano');
    set.run('filter', 'Sibarist Fast');
    db.prepare(`INSERT INTO app_meta (key, value) VALUES (?, ?)`).run('brew_now_own_data_2026_10c', new Date().toISOString());
  }
  migrateStatusValues(db);
  dropHandSetRates(db);
  backfillSlugs(db);
  db.exec(
    `UPDATE subscriptions SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE updated_at IS NULL`
  );
  db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_coffees_slug ON coffees(slug)`);
}

// Called once per process start (createDb runs once via the getDb() singleton),
// so this timestamp tracks "when this server process booted" — which, since the
// container is recreated on every real deploy, doubles as "last deployed" without
// needing any CI/build-time wiring.
function recordDeploy(db: DatabaseSync): void {
  const now = new Date().toISOString();
  db.prepare(`INSERT INTO app_meta (key, value) VALUES ('last_deployed', ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value`).run(now);
}

export function getLastDeployed(db: DatabaseSync): string | null {
  const row = db.prepare(`SELECT value FROM app_meta WHERE key = 'last_deployed'`).get() as
    | { value: string }
    | undefined;
  return row?.value ?? null;
}

export class InvalidHouseholdSizeError extends Error {}

const HOUSEHOLD_SIZE_KEY = 'household_size';
// 2 is right for this household; the multi-user work defaults it to 1 (settings catalog,
// docs/backlog/multi-user-or-self-host.md).
const DEFAULT_HOUSEHOLD_SIZE = 2;
const isHouseholdSize = (n: number) => Number.isInteger(n) && n >= 1 && n <= 20;

// When the last Bean Conqueror upload landed (ISO), or null before the first.
export function lastImportedAt(db: DatabaseSync): string | null {
  const row = db.prepare(`SELECT value FROM app_meta WHERE key = 'beanconqueror_last_imported_at'`).get() as
    | { value: string }
    | undefined;
  return row?.value ?? null;
}

// How many people share the brews: Per person divides totals and rates by it.
export function getHouseholdSize(db: DatabaseSync): number {
  const row = db.prepare(`SELECT value FROM app_meta WHERE key = ?`).get(HOUSEHOLD_SIZE_KEY) as
    | { value: string }
    | undefined;
  const n = row && row.value !== '' ? Number(row.value) : NaN;
  return isHouseholdSize(n) ? n : DEFAULT_HOUSEHOLD_SIZE;
}

export function setHouseholdSize(db: DatabaseSync, n: number): void {
  if (!isHouseholdSize(n)) throw new InvalidHouseholdSizeError('household size must be a whole number from 1 to 20');
  db.prepare(
    `INSERT INTO app_meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`
  ).run(HOUSEHOLD_SIZE_KEY, String(n));
}

export function createDb(path: string): DatabaseSync {
  if (path !== ':memory:') {
    mkdirSync(dirname(path), { recursive: true });
  }
  const db = new DatabaseSync(path);
  // node:sqlite's default for this pragma isn't guaranteed across versions;
  // slug_redirects' ON DELETE CASCADE needs it explicitly on.
  db.exec(`PRAGMA foreign_keys = ON`);
  // Outside readers (test read(), external tools) can hold a lock; wait instead of SQLITE_BUSY.
  db.exec(`PRAGMA busy_timeout = 5000`);
  applySchema(db);
  recordDeploy(db);
  return db;
}

let singleton: DatabaseSync | undefined;

export function getDb(): DatabaseSync {
  if (!singleton) {
    singleton = createDb(process.env.DB_PATH ?? 'data/bean-tracker.db');
  }
  return singleton;
}
