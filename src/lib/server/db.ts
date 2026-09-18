import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { schema } from './schema.ts';
import { generateBaseSlug, uniqueSlug } from './slug.ts';

function ensureColumn(db: DatabaseSync, table: string, column: string, type: string): void {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
  if (!columns.some((c) => c.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`);
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
  ensureColumn(db, 'subscriptions', 'updated_at', 'TEXT');
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

export function createDb(path: string): DatabaseSync {
  if (path !== ':memory:') {
    mkdirSync(dirname(path), { recursive: true });
  }
  const db = new DatabaseSync(path);
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
