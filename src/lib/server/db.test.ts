import { describe, it, expect } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { createDb, applySchema, getStatsRates, setStatsRates, InvalidRatesError, getHouseholdSize, setHouseholdSize, InvalidHouseholdSizeError } from './db';

describe('createDb', () => {
  it('creates all expected tables', () => {
    const db = createDb(':memory:');
    const tables = (
      db.prepare(`SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name`).all() as {
        name: string;
      }[]
    ).map((row) => row.name);
    expect(tables).toEqual([
      'alerts',
      'app_meta',
      'beanconqueror_bean_origins',
      'beanconqueror_beans',
      'beanconqueror_brews',
      'beanconqueror_grinders',
      'beanconqueror_methods',
      'beanconqueror_waters',
      'coffees',
      'image_copies',
      'image_fills',
      'roast_levels',
      'roaster_images',
      'roaster_websites',
      'search_usage',
      'short_links',
      'slug_redirects',
      'subscriptions'
    ]);
  });

  it('seeds roast_levels with the 11 reference rows', () => {
    const db = createDb(':memory:');
    const result = db.prepare(`SELECT COUNT(*) as count FROM roast_levels`).get() as {
      count: number;
    };
    expect(result.count).toBe(11);
  });

  it('is idempotent when the schema is applied twice', () => {
    const db = createDb(':memory:');
    expect(() => applySchema(db)).not.toThrow();
    const result = db.prepare(`SELECT COUNT(*) as count FROM roast_levels`).get() as {
      count: number;
    };
    expect(result.count).toBe(11);
  });

  it('turns foreign_keys on, so slug_redirects cascades on delete regardless of node:sqlite defaults', () => {
    const db = createDb(':memory:');
    const result = db.prepare(`PRAGMA foreign_keys`).get() as { foreign_keys: number };
    expect(result.foreign_keys).toBe(1);
  });
});

describe('legacy data migration', () => {
  it('remaps old status values to the new three-state model', () => {
    const db = createDb(':memory:');
    db.exec(
      `INSERT INTO coffees (roaster, coffee_name, slug, status, created_at, updated_at)
       VALUES ('R', 'C1', 'r-c1', 'active', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z')`
    );
    db.exec(
      `INSERT INTO coffees (roaster, coffee_name, slug, status, created_at, updated_at)
       VALUES ('R', 'C2', 'r-c2', 'finished', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z')`
    );
    applySchema(db);
    const statuses = (db.prepare(`SELECT status FROM coffees ORDER BY id`).all() as { status: string }[]).map(
      (r) => r.status
    );
    expect(statuses).toEqual(['backlog', 'archive']);
  });

  it('backfills a slug for legacy rows that have none, without colliding', () => {
    const db = createDb(':memory:');
    db.exec(
      `INSERT INTO coffees (roaster, coffee_name, status, created_at, updated_at)
       VALUES ('Lume', 'Same Name', 'backlog', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z')`
    );
    db.exec(
      `INSERT INTO coffees (roaster, coffee_name, status, created_at, updated_at)
       VALUES ('Lume', 'Same Name', 'backlog', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z')`
    );
    applySchema(db);
    const slugs = (db.prepare(`SELECT slug FROM coffees ORDER BY id`).all() as { slug: string }[]).map(
      (r) => r.slug
    );
    expect(slugs).toEqual(['2026-lume-same-name', '2026-lume-same-name-2']);
  });

  it('is idempotent — running applySchema again does not change already-migrated data', () => {
    const db = createDb(':memory:');
    db.exec(
      `INSERT INTO coffees (roaster, coffee_name, status, created_at, updated_at)
       VALUES ('Lume', 'Once', 'backlog', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z')`
    );
    applySchema(db);
    const firstSlug = (
      db.prepare(`SELECT slug FROM coffees WHERE coffee_name = 'Once'`).get() as { slug: string }
    ).slug;
    applySchema(db);
    const secondSlug = (
      db.prepare(`SELECT slug FROM coffees WHERE coffee_name = 'Once'`).get() as { slug: string }
    ).slug;
    expect(secondSlug).toBe(firstSlug);
  });

  it('backfills decaf=1 for pre-existing coffees whose name OR processing contains "decaf", only once', () => {
    // Simulate a real pre-migration database: a coffees table that predates
    // the decaf column entirely, not one created via the current schema.
    // `processing` is included here because real pre-decaf-column databases
    // already had it (it's an original schema field, never added via
    // ensureColumn) — unlike this test's other omitted columns.
    const raw = new DatabaseSync(':memory:');
    raw.exec(`
      CREATE TABLE coffees (
        id INTEGER PRIMARY KEY,
        roaster TEXT NOT NULL,
        coffee_name TEXT NOT NULL,
        processing TEXT,
        roast_date TEXT,
        slug TEXT,
        status TEXT NOT NULL DEFAULT 'backlog',
        drank INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    `);
    raw.exec(
      `INSERT INTO coffees (roaster, coffee_name, slug, created_at, updated_at)
       VALUES ('R', 'Ethiopia Decaf', 'r-ethiopia-decaf', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z')`
    );
    raw.exec(
      `INSERT INTO coffees (roaster, coffee_name, processing, slug, created_at, updated_at)
       VALUES ('R', 'Marlon Bolanos', 'Natural, EA Decaf', 'r-marlon-bolanos', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z')`
    );
    raw.exec(
      `INSERT INTO coffees (roaster, coffee_name, slug, created_at, updated_at)
       VALUES ('R', 'Regular Blend', 'r-regular-blend', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z')`
    );

    applySchema(raw);

    const decafRow = raw
      .prepare(`SELECT decaf FROM coffees WHERE coffee_name = 'Ethiopia Decaf'`)
      .get() as { decaf: number };
    const decafProcessingRow = raw
      .prepare(`SELECT decaf FROM coffees WHERE coffee_name = 'Marlon Bolanos'`)
      .get() as { decaf: number };
    const regularRow = raw
      .prepare(`SELECT decaf FROM coffees WHERE coffee_name = 'Regular Blend'`)
      .get() as { decaf: number };
    expect(decafRow.decaf).toBe(1);
    expect(decafProcessingRow.decaf).toBe(1);
    expect(regularRow.decaf).toBe(0);

    // Simulate a manual override, then confirm a later applySchema call (e.g.
    // the next server restart) never re-runs the backfill and clobbers it.
    raw.exec(`UPDATE coffees SET decaf = 0 WHERE coffee_name = 'Ethiopia Decaf'`);
    applySchema(raw);
    const afterSecondApply = raw
      .prepare(`SELECT decaf FROM coffees WHERE coffee_name = 'Ethiopia Decaf'`)
      .get() as { decaf: number };
    expect(afterSecondApply.decaf).toBe(0);
  });

  it('adds the product_url column to a pre-existing coffees table', () => {
    const raw = new DatabaseSync(':memory:');
    // processing is included (unlike the brief's original snippet) because
    // applySchema's decaf backfill unconditionally references it — see the
    // decaf backfill test above, which needs it for the same reason.
    raw.exec(`
      CREATE TABLE coffees (
        id INTEGER PRIMARY KEY,
        roaster TEXT NOT NULL,
        coffee_name TEXT NOT NULL,
        processing TEXT,
        roast_date TEXT,
        slug TEXT,
        status TEXT NOT NULL DEFAULT 'backlog',
        drank INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    `);
    applySchema(raw);
    const cols = raw.prepare(`PRAGMA table_info(coffees)`).all() as { name: string }[];
    expect(cols.map((c) => c.name)).toContain('product_url');
  });
});

describe('stats rate settings', () => {
  it('defaults to 72/144 g per day when nothing has been saved', () => {
    const db = createDb(':memory:');
    expect(getStatsRates(db)).toEqual({ selfGPerDay: 72, householdGPerDay: 144 });
  });

  it('persists and reads back saved rates', () => {
    const db = createDb(':memory:');
    setStatsRates(db, { selfGPerDay: 90, householdGPerDay: 180 });
    expect(getStatsRates(db)).toEqual({ selfGPerDay: 90, householdGPerDay: 180 });
  });

  it('overwrites a previously saved rate rather than duplicating rows', () => {
    const db = createDb(':memory:');
    setStatsRates(db, { selfGPerDay: 90, householdGPerDay: 180 });
    setStatsRates(db, { selfGPerDay: 60, householdGPerDay: 120 });
    expect(getStatsRates(db)).toEqual({ selfGPerDay: 60, householdGPerDay: 120 });
    const count = db.prepare(`SELECT COUNT(*) as count FROM app_meta WHERE key LIKE 'stats_rate_%'`).get() as {
      count: number;
    };
    expect(count.count).toBe(2);
  });

  it('rejects a non-positive self rate without writing anything', () => {
    const db = createDb(':memory:');
    expect(() => setStatsRates(db, { selfGPerDay: 0, householdGPerDay: 144 })).toThrow();
    expect(getStatsRates(db)).toEqual({ selfGPerDay: 72, householdGPerDay: 144 });
  });

  it('rejects a non-positive household rate without writing anything', () => {
    const db = createDb(':memory:');
    expect(() => setStatsRates(db, { selfGPerDay: 72, householdGPerDay: -1 })).toThrow();
    expect(getStatsRates(db)).toEqual({ selfGPerDay: 72, householdGPerDay: 144 });
  });

  it('rejects a NaN rate', () => {
    const db = createDb(':memory:');
    expect(() => setStatsRates(db, { selfGPerDay: NaN, householdGPerDay: 144 })).toThrow(InvalidRatesError);
  });

  it('falls back to defaults instead of returning NaN when app_meta holds a corrupted rate value', () => {
    const db = createDb(':memory:');
    db.prepare(
      `INSERT INTO app_meta (key, value) VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`
    ).run('stats_rate_self_g_per_day', 'not-a-number');
    expect(getStatsRates(db)).toEqual({ selfGPerDay: 72, householdGPerDay: 144 });
  });
});

describe('household size', () => {
  it('defaults to 2 when nothing is saved', () => expect(getHouseholdSize(createDb(':memory:'))).toBe(2));

  it('saves and reads back a whole number from 1 to 20', () => {
    const db = createDb(':memory:');
    setHouseholdSize(db, 1);
    expect(getHouseholdSize(db)).toBe(1);
    setHouseholdSize(db, 20);
    expect(getHouseholdSize(db)).toBe(20);
    const n = db.prepare(`SELECT COUNT(*) AS n FROM app_meta WHERE key = 'household_size'`).get() as { n: number };
    expect(n.n).toBe(1);
  });

  it('throws on anything else and keeps the old value', () => {
    const db = createDb(':memory:');
    setHouseholdSize(db, 3);
    for (const bad of [0, 21, 1.5, -1, NaN]) {
      expect(() => setHouseholdSize(db, bad)).toThrow(InvalidHouseholdSizeError);
    }
    expect(getHouseholdSize(db)).toBe(3);
  });

  it('falls back to 2 on a stored value that is not a valid size', () => {
    const db = createDb(':memory:');
    const put = db.prepare(
      `INSERT INTO app_meta (key, value) VALUES ('household_size', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`
    );
    for (const bad of ['0', 'abc', '2.5', '99', '']) {
      put.run(bad);
      expect(getHouseholdSize(db)).toBe(2);
    }
  });
});

describe('hand-set rates migration', () => {
  it('deletes the two old rate keys at startup, and runs again harmlessly', () => {
    const db = createDb(':memory:');
    const put = db.prepare(`INSERT INTO app_meta (key, value) VALUES (?, '90')`);
    put.run('stats_rate_self_g_per_day');
    put.run('stats_rate_household_g_per_day');
    applySchema(db);
    const left = () =>
      (db.prepare(`SELECT COUNT(*) AS n FROM app_meta WHERE key LIKE 'stats_rate_%'`).get() as { n: number }).n;
    expect(left()).toBe(0);
    applySchema(db);
    expect(left()).toBe(0);
  });
});

describe('image fill recompute', () => {
  it('clears cached fills once, then leaves new ones alone', () => {
    const dir = mkdtempSync(join(tmpdir(), 'fills-'));
    try {
      const file = join(dir, 'test.db');
      const first = createDb(file);
      first.prepare(`INSERT INTO image_fills (url, fill) VALUES ('https://a/x.png', '#000000')`).run();
      // Simulate a DB from before the marker existed.
      first.prepare(`DELETE FROM app_meta WHERE key = 'image_fills_recompute_2026_10_06'`).run();
      first.close();
      const second = createDb(file);
      expect(second.prepare(`SELECT COUNT(*) AS n FROM image_fills`).get()).toEqual({ n: 0 });
      second.prepare(`INSERT INTO image_fills (url, fill) VALUES ('https://a/y.png', '#ffffff')`).run();
      second.close();
      const third = createDb(file);
      expect(third.prepare(`SELECT COUNT(*) AS n FROM image_fills`).get()).toEqual({ n: 1 });
      third.close();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('Bean Conqueror JSON import schema', () => {
  it('upgrades a pre-JSON-import database: waters table, new brew columns, UUID indexes', () => {
    const db = new DatabaseSync(':memory:');
    db.exec(`PRAGMA foreign_keys = ON`);
    // The brews table and identity index exactly as prod had them before this change.
    db.exec(`
      CREATE TABLE beanconqueror_brews (
        id INTEGER PRIMARY KEY, bc_created_at TEXT NOT NULL, bean_id TEXT, preparation_id TEXT,
        mill_id TEXT, grind_setting TEXT, ground_coffee_g REAL, brew_temperature REAL, bean_type TEXT,
        grind_speed_rpm REAL, grind_time TEXT, profile TEXT, preparation_tools TEXT,
        temperature_time TEXT, brew_time TEXT, bloom_time TEXT, first_drip_time TEXT,
        water_amount_g REAL, coffee_type TEXT, coffee_concentration TEXT, rating REAL, notes TEXT,
        beverage_quantity REAL, tds_percent REAL, extraction_yield_percent REAL, brew_ratio TEXT,
        bean_age_days INTEGER, bc_archived INTEGER NOT NULL DEFAULT 0, water TEXT,
        imported_at TEXT NOT NULL
      );
      CREATE UNIQUE INDEX beanconqueror_brews_identity
        ON beanconqueror_brews (bc_created_at, COALESCE(bean_id, ''));
    `);
    db.prepare(`INSERT INTO beanconqueror_brews (bc_created_at, imported_at) VALUES ('2026-06-01T12:00:00.000Z', 'x')`).run();
    applySchema(db);
    const cols = (db.prepare(`PRAGMA table_info(beanconqueror_brews)`).all() as { name: string }[]).map((c) => c.name);
    expect(cols).toEqual(
      expect.arrayContaining(['bc_uuid', 'water_id', 'best_brew', 'favourite', 'vessel_name', 'has_flow_profile'])
    );
    const indexes = (
      db
        .prepare(`SELECT name FROM sqlite_master WHERE type = 'index' AND tbl_name = 'beanconqueror_brews'
                  AND name NOT LIKE 'sqlite_%' ORDER BY name`)
        .all() as { name: string }[]
    ).map((r) => r.name);
    expect(indexes).toEqual(['beanconqueror_brews_legacy_identity', 'beanconqueror_brews_uuid']);
    expect(db.prepare(`SELECT best_brew, has_flow_profile FROM beanconqueror_brews`).get()).toEqual({ best_brew: 0, has_flow_profile: 0 });
    applySchema(db); // idempotent on the next boot
  });
});
