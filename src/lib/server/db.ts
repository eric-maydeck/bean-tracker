import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { schema } from './schema.ts';
import { canonicalZone } from '../displayZone.ts';
import { STORE_ZONE, setBrewingZone as setProcessZone, DATE_FORMATS, DEFAULT_DATE_FORMAT, type DateFormat } from '../localDate.ts';
import { COFFEE_ORIGIN_FIELDS } from '../types.ts';
import { backfillBeanConquerorLinks } from './beanConquerorLinks.ts';
import { applyLegacyFixes } from './legacyFixes.ts';
import { generateBaseSlug, uniqueSlug } from './slug.ts';

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
  // No tables yet = a database this code creates: it gets the schema and reference data, never the owner's fixes.
  const fresh = !db.prepare(`SELECT 1 FROM sqlite_master WHERE type = 'table' LIMIT 1`).get();
  db.exec(schema);
  if (fresh) db.prepare(`INSERT INTO app_meta (key, value) VALUES ('fresh_db', ?)`).run(new Date().toISOString());
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
  ensureColumn(db, 'coffees', 'bean_base_id', 'TEXT');
  const blendJustAdded = ensureColumn(db, 'coffees', 'blend', 'INTEGER NOT NULL DEFAULT 0'); // legacyFixes marks the one real blend then
  ensureColumn(db, 'subscriptions', 'updated_at', 'TEXT');
  ensureColumn(db, 'subscriptions', 'renewal_day', 'INTEGER');
  ensureColumn(db, 'subscriptions', 'subscription_url', 'TEXT');
  ensureColumn(db, 'subscriptions', 'paused', 'INTEGER NOT NULL DEFAULT 0');
  // Bean Conqueror JSON import: brews get their UUID and new fields.
  ensureColumn(db, 'beanconqueror_brews', 'water_id', 'TEXT REFERENCES beanconqueror_waters(id)');
  ensureColumn(db, 'beanconqueror_waters', 'warning_accepted', 'TEXT');
  ensureColumn(db, 'beanconqueror_brews', 'best_brew', 'INTEGER NOT NULL DEFAULT 0');
  ensureColumn(db, 'beanconqueror_brews', 'favourite', 'INTEGER NOT NULL DEFAULT 0');
  ensureColumn(db, 'beanconqueror_brews', 'vessel_name', 'TEXT');
  ensureColumn(db, 'beanconqueror_brews', 'has_flow_profile', 'INTEGER NOT NULL DEFAULT 0');
  ensureColumn(db, 'beanconqueror_brews', 'bc_uuid', 'TEXT');
  ensureColumn(db, 'beanconqueror_grinders', 'has_adjustable_speed', 'INTEGER NOT NULL DEFAULT 0');
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
  // Owner-only fixes: skipped on a database this code created (see legacyFixes.ts).
  if (!db.prepare(`SELECT 1 FROM app_meta WHERE key = 'fresh_db'`).get()) applyLegacyFixes(db, blendJustAdded);
  // image_copies' kind CHECK gained 'gear' (gear showcase): SQLite can't alter a CHECK, so rebuild an older table once.
  if (!(db.prepare(`SELECT sql FROM sqlite_master WHERE name = 'image_copies'`).get() as { sql: string }).sql.includes("'gear'")) {
    db.exec(`BEGIN; ALTER TABLE image_copies RENAME TO image_copies_old;
      CREATE TABLE image_copies (url TEXT NOT NULL, kind TEXT NOT NULL CHECK (kind IN ('coffees', 'roasters', 'gear')),
        file TEXT NOT NULL, PRIMARY KEY (url, kind));
      INSERT INTO image_copies SELECT url, kind, file FROM image_copies_old; DROP TABLE image_copies_old; COMMIT;`);
  }
  // gear_details lost its kind CHECK (tools add kinds like 'accessory'): rebuild an older table once.
  if ((db.prepare(`SELECT sql FROM sqlite_master WHERE name = 'gear_details'`).get() as { sql: string }).sql.includes('CHECK')) {
    db.exec(`BEGIN; ALTER TABLE gear_details RENAME TO gear_details_old;
      CREATE TABLE gear_details (kind TEXT NOT NULL, name TEXT NOT NULL, fields TEXT NOT NULL DEFAULT '{}', image_url TEXT,
        created_at TEXT NOT NULL, updated_at TEXT NOT NULL, PRIMARY KEY (kind, name));
      INSERT INTO gear_details SELECT kind, name, fields, image_url, created_at, updated_at FROM gear_details_old;
      DROP TABLE gear_details_old; COMMIT;`);
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
// 2 is right for this household; the multi-user work defaults it to 1 (settings catalog).
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

export class InvalidTimeZoneError extends Error {}

const BREWING_ZONE_KEY = 'brewing_time_zone';

// The account's brewing zone (day and hour lines); UTC until set, and UTC if the stored value is not a zone.
export function getBrewingZone(db: DatabaseSync): string {
  const v = (db.prepare(`SELECT value FROM app_meta WHERE key = ?`).get(BREWING_ZONE_KEY) as { value: string } | undefined)?.value;
  return (v && canonicalZone(v)) || 'UTC';
}


// Saves the zone and applies it to this process.
export function setBrewingZone(db: DatabaseSync, input: string): void {
  const z = canonicalZone(input);
  if (!z) throw new InvalidTimeZoneError(`unknown time zone: ${input}`);
  db.prepare(`INSERT INTO app_meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`).run(BREWING_ZONE_KEY, z);
  setProcessZone(z);
}

const DISPLAY_ZONE_KEY = 'display_time_zone';

// Zone for clock times shown to a reader: 'browser' (the default) or an IANA zone.
export function getDisplayZone(db: DatabaseSync): string {
  const row = db.prepare(`SELECT value FROM app_meta WHERE key = ?`).get(DISPLAY_ZONE_KEY) as { value: string } | undefined;
  return (row && canonicalZone(row.value)) || 'browser';
}

export function setDisplayZone(db: DatabaseSync, input: string): void {
  const z = input === 'browser' ? input : canonicalZone(input);
  if (!z) throw new InvalidTimeZoneError(`unknown time zone: ${input}`);
  db.prepare(`INSERT INTO app_meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`).run(DISPLAY_ZONE_KEY, z);
}

const DATE_FORMAT_KEY = 'date_format';

// How dates and times are written; a missing or junk stored value is the default.
export function getDateFormat(db: DatabaseSync): DateFormat {
  const row = db.prepare(`SELECT value FROM app_meta WHERE key = ?`).get(DATE_FORMAT_KEY) as { value: string } | undefined;
  return DATE_FORMATS.find((f) => f === row?.value) ?? DEFAULT_DATE_FORMAT;
}

export class InvalidSettingError extends Error {}

export function setDateFormat(db: DatabaseSync, f: string): void {
  if (!(DATE_FORMATS as readonly string[]).includes(f)) throw new InvalidSettingError(`unknown date format: ${f}`);
  db.prepare(`INSERT INTO app_meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`).run(DATE_FORMAT_KEY, f);
}

const DEFAULT_CAFFEINE_KEY = 'default_caffeine';
// Same values as insightsUrl's CAFFEINES (not imported: that module is client-sized).
const CAFFEINE_DEFAULTS = ['caffeinated', 'decaf', 'all'] as const;
export type CaffeineDefault = (typeof CAFFEINE_DEFAULTS)[number];

// The Stats Caffeine filter's value when the URL has none; a missing or junk stored value is 'caffeinated'.
export function getDefaultCaffeine(db: DatabaseSync): CaffeineDefault {
  const row = db.prepare(`SELECT value FROM app_meta WHERE key = ?`).get(DEFAULT_CAFFEINE_KEY) as { value: string } | undefined;
  return CAFFEINE_DEFAULTS.find((c) => c === row?.value) ?? 'caffeinated';
}

export function setDefaultCaffeine(db: DatabaseSync, c: string): void {
  if (!(CAFFEINE_DEFAULTS as readonly string[]).includes(c)) throw new InvalidSettingError(`unknown caffeine filter: ${c}`);
  db.prepare(`INSERT INTO app_meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`).run(DEFAULT_CAFFEINE_KEY, c);
}

// First boot with the setting absent: an account that already has brews or bags was America/Denver before the setting
// existed (it keeps its numbers); an empty one starts on UTC. Either way the choice is stored, so it never flips later.
function bootBrewingZone(db: DatabaseSync): void {
  const has = (t: string) => db.prepare(`SELECT 1 FROM ${t} LIMIT 1`).get() !== undefined;
  if (!db.prepare(`SELECT 1 FROM app_meta WHERE key = ?`).get(BREWING_ZONE_KEY))
    setBrewingZone(db, has('beanconqueror_brews') || has('coffees') ? STORE_ZONE : 'UTC');
  setProcessZone(getBrewingZone(db));
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
  bootBrewingZone(db);
  return db;
}

let singleton: DatabaseSync | undefined;

export function getDb(): DatabaseSync {
  if (!singleton) {
    singleton = createDb(process.env.DB_PATH ?? 'data/bean-tracker.db');
  }
  return singleton;
}
