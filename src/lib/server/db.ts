import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { schema } from './schema.ts';
import { backfillBeanConquerorLinks, applyBeanConquerorPairs } from './beanConquerorLinks.ts';
import { BEAN_CONQUEROR_PAIRS, PAIRS_2026_10B, PAIRS_2026_10B_MARKER, FIXES_2026_10B } from './beanConquerorPairs.ts';
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
  ensureColumn(db, 'coffees', 'image_url', 'TEXT');
  ensureColumn(db, 'coffees', 'slug', 'TEXT');
  ensureColumn(db, 'coffees', 'opened_date', 'TEXT');
  ensureColumn(db, 'coffees', 'product_url', 'TEXT');
  ensureColumn(db, 'subscriptions', 'updated_at', 'TEXT');
  ensureColumn(db, 'subscriptions', 'renewal_day', 'INTEGER');
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
  applyRoasterImageDefaults(db, ROASTER_IMAGE_DEFAULTS, ROASTER_IMAGE_DEFAULTS_MARKER);
  applyRoasterImageDefaults(db, ROASTER_IMAGE_DEFAULTS_2026_10B, ROASTER_IMAGE_DEFAULTS_2026_10B_MARKER);
  // computeFill's solid-border rule changed, so cached fills may be wrong; drop
  // them once and the background run refills every displayed URL at boot.
  if (!db.prepare(`SELECT 1 FROM app_meta WHERE key = ?`).get('image_fills_recompute_2026_10_06')) {
    db.exec('BEGIN');
    db.exec(`DELETE FROM image_fills`);
    db.prepare(`INSERT INTO app_meta (key, value) VALUES (?, ?)`).run('image_fills_recompute_2026_10_06', new Date().toISOString());
    db.exec('COMMIT');
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

export interface StatsRates {
  selfGPerDay: number;
  householdGPerDay: number;
}

export class InvalidRatesError extends Error {}

const DEFAULT_SELF_RATE_G_PER_DAY = 72;
const DEFAULT_HOUSEHOLD_RATE_G_PER_DAY = 144;
const SELF_RATE_KEY = 'stats_rate_self_g_per_day';
const HOUSEHOLD_RATE_KEY = 'stats_rate_household_g_per_day';

export function getStatsRates(db: DatabaseSync): StatsRates {
  const rows = db
    .prepare(`SELECT key, value FROM app_meta WHERE key IN (?, ?)`)
    .all(SELF_RATE_KEY, HOUSEHOLD_RATE_KEY) as { key: string; value: string }[];
  const map = new Map(rows.map((r) => [r.key, r.value]));
  const self = map.get(SELF_RATE_KEY);
  const household = map.get(HOUSEHOLD_RATE_KEY);
  const selfRate = self != null ? Number(self) : NaN;
  const householdRate = household != null ? Number(household) : NaN;
  return {
    selfGPerDay: Number.isFinite(selfRate) && selfRate > 0 ? selfRate : DEFAULT_SELF_RATE_G_PER_DAY,
    householdGPerDay:
      Number.isFinite(householdRate) && householdRate > 0 ? householdRate : DEFAULT_HOUSEHOLD_RATE_G_PER_DAY
  };
}

export function setStatsRates(db: DatabaseSync, rates: StatsRates): void {
  if (!Number.isFinite(rates.selfGPerDay) || rates.selfGPerDay <= 0) {
    throw new InvalidRatesError('selfGPerDay must be a positive number');
  }
  if (!Number.isFinite(rates.householdGPerDay) || rates.householdGPerDay <= 0) {
    throw new InvalidRatesError('householdGPerDay must be a positive number');
  }
  db.prepare(
    `INSERT INTO app_meta (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`
  ).run(SELF_RATE_KEY, String(rates.selfGPerDay));
  db.prepare(
    `INSERT INTO app_meta (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`
  ).run(HOUSEHOLD_RATE_KEY, String(rates.householdGPerDay));
}

export function createDb(path: string): DatabaseSync {
  if (path !== ':memory:') {
    mkdirSync(dirname(path), { recursive: true });
  }
  const db = new DatabaseSync(path);
  // node:sqlite's default for this pragma isn't guaranteed across versions;
  // slug_redirects' ON DELETE CASCADE needs it explicitly on.
  db.exec(`PRAGMA foreign_keys = ON`);
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
