import { describe, it, expect, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { createDb, applySchema, lastImportedAt, getHouseholdSize, setHouseholdSize, InvalidHouseholdSizeError, getBrewingZone, setBrewingZone, InvalidTimeZoneError, getDisplayZone, setDisplayZone, getDateFormat, setDateFormat, getDefaultCaffeine, setDefaultCaffeine, InvalidSettingError } from './db';
import { canonicalZone } from '../displayZone';
import { brewingZone, setBrewingZone as setProcessZone } from '../localDate';
import { schema } from './schema';
import { OWN_DATA_ONLY, OWN_DATA_SIMILAR } from '../gear';
import { createSubscription, deleteSubscription } from './subscriptions';

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
      'beanconqueror_brew_flows',
      'beanconqueror_brews',
      'beanconqueror_grinders',
      'beanconqueror_methods',
      'beanconqueror_waters',
      'brew_now_marks',
      'brew_pour_readings',
      'brew_recipe_matches',
      'coffees',
      'dismissed_structures',
      'gear_details',
      'image_copies',
      'image_fills',
      'locked_drippers',
      'recipes',
      'roast_levels',
      'roaster_images',
      'roaster_recipes',
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

  it('adds coffees.subscription_id to an older DB, null by default', () => {
    const db = new DatabaseSync(':memory:');
    // the current coffees table minus the new column
    db.exec(schema.match(/CREATE TABLE IF NOT EXISTS coffees \([\s\S]*?\n\);/)![0].replace(/.*subscription_id.*\n/, ''));
    db.exec(`INSERT INTO coffees (roaster, coffee_name, slug, created_at, updated_at) VALUES ('R', 'C', 'r-c', '2026-01-01', '2026-01-01')`);
    applySchema(db);
    const cols = (db.prepare(`PRAGMA table_info(coffees)`).all() as { name: string }[]).map((c) => c.name);
    expect(cols).toContain('subscription_id');
    expect(db.prepare(`SELECT subscription_id FROM coffees`).get()).toEqual({ subscription_id: null });
  });

  it("nulls a coffee's subscription_id when its plan is deleted", () => {
    const db = createDb(':memory:');
    const planId = createSubscription(db, {
      roaster_service: 'S', subscription_name: null, price: 20, bag_count: 1, amount_per_bag_g: 250, renewal_day: 1
    });
    db.exec(`INSERT INTO coffees (roaster, coffee_name, slug, subscription_id, created_at, updated_at)
             VALUES ('R', 'C', 'r-c', ${planId}, '2026-01-01', '2026-01-01')`);
    deleteSubscription(db, planId);
    expect(db.prepare(`SELECT subscription_id FROM coffees`).get()).toEqual({ subscription_id: null });
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

  it('marks only S&W Teddy\'s Terror as a blend when the column is added, once', () => {
    const raw = new DatabaseSync(':memory:');
    raw.exec(`CREATE TABLE coffees (id INTEGER PRIMARY KEY, roaster TEXT NOT NULL, coffee_name TEXT NOT NULL,
      origin TEXT, processing TEXT, roast_date TEXT, slug TEXT, status TEXT NOT NULL DEFAULT 'backlog',
      drank INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)`);
    const add = raw.prepare(`INSERT INTO coffees (roaster, coffee_name, origin, slug, created_at, updated_at) VALUES (?, ?, 'Various', ?, 'x', 'x')`);
    add.run('S&W Craft Roasting', "Teddy's Terror (blend)", 'a');
    add.run('Other', "Teddy's Terror (blend)", 'b');
    add.run('S&W Craft Roasting', 'House Blend', 'c');
    applySchema(raw);
    const rows = () => raw.prepare(`SELECT slug, blend, origin FROM coffees ORDER BY slug`).all();
    expect(rows()).toEqual([
      { slug: 'a', blend: 1, origin: 'Blend' },
      { slug: 'b', blend: 0, origin: 'Various' },
      { slug: 'c', blend: 0, origin: 'Various' }
    ]);
    raw.exec(`UPDATE coffees SET blend = 0, origin = 'Mixed' WHERE slug = 'a'`);
    applySchema(raw);
    expect(raw.prepare(`SELECT blend, origin FROM coffees WHERE slug = 'a'`).get()).toEqual({ blend: 0, origin: 'Mixed' });
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
    db.prepare(`INSERT INTO app_meta (key, value) VALUES ('keep_me', 'x')`).run();
    applySchema(db);
    const left = () =>
      (db.prepare(`SELECT COUNT(*) AS n FROM app_meta WHERE key LIKE 'stats_rate_%'`).get() as { n: number }).n;
    expect(left()).toBe(0);
    applySchema(db);
    expect(left()).toBe(0);
    expect(db.prepare(`SELECT value FROM app_meta WHERE key = 'keep_me'`).get()).toEqual({ value: 'x' });
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

describe('image_copies gear kind', () => {
  it('rebuilds an older table (CHECK without gear) keeping its rows', () => {
    const db = createDb(':memory:');
    db.exec(`DROP TABLE image_copies; CREATE TABLE image_copies (url TEXT NOT NULL,
      kind TEXT NOT NULL CHECK (kind IN ('coffees', 'roasters')), file TEXT NOT NULL, PRIMARY KEY (url, kind));
      INSERT INTO image_copies VALUES ('u', 'coffees', 'f.webp')`);
    applySchema(db);
    db.prepare(`INSERT INTO image_copies VALUES ('g', 'gear', 'g.webp')`).run();
    expect(db.prepare(`SELECT COUNT(*) AS n FROM image_copies`).get()).toEqual({ n: 2 });
  });
});

describe('ownData gear migration', () => {
  const seed = (db: ReturnType<typeof createDb>) => {
    const ins = db.prepare(`INSERT INTO gear_details (kind, name, fields, created_at, updated_at) VALUES (?, ?, ?, 'x', 'x')`);
    ins.run('dripper', 'Graycano', '{"shape":"Conical"}');
    ins.run('filter', 'Sibarist Fast', '{}');
    ins.run('dripper', 'Other', '{}');
    ins.run('dripper', 'Old own', '{"ownData":"Own brews only"}');
    ins.run('filter', 'Old similar', '{"ownData":"Similar gear too"}');
  };
  const fields = (db: ReturnType<typeof createDb>, kind: string, name: string) =>
    JSON.parse((db.prepare(`SELECT fields FROM gear_details WHERE kind = ? AND name = ?`).get(kind, name) as { fields: string }).fields);

  it('sets ownData once, keeping other keys; rerun is a no-op; missing rows do not throw', () => {
    const dir = mkdtempSync(join(tmpdir(), 'ownd-'));
    const path = join(dir, 't.db');
    const db = createDb(path); // no rows yet: marker set, nothing thrown
    seed(db);
    db.exec(`DELETE FROM app_meta WHERE key = 'brew_now_own_data_2026_10c'`);
    db.close();
    const db2 = createDb(path);
    expect(fields(db2, 'dripper', 'Graycano')).toEqual({ shape: 'Conical', ownData: OWN_DATA_ONLY });
    expect(fields(db2, 'filter', 'Sibarist Fast')).toEqual({ ownData: OWN_DATA_ONLY });
    expect(fields(db2, 'dripper', 'Other')).toEqual({});
    expect(fields(db2, 'dripper', 'Old own')).toEqual({ ownData: OWN_DATA_ONLY }); // earlier wording carried over
    expect(fields(db2, 'filter', 'Old similar')).toEqual({ ownData: OWN_DATA_SIMILAR });
    db2.prepare(`UPDATE gear_details SET fields = '{}' WHERE name = 'Graycano'`).run();
    db2.close();
    expect(fields(createDb(path), 'dripper', 'Graycano')).toEqual({});
    rmSync(dir, { recursive: true });
  });
});

describe('createDb origin columns', () => {
  it('createDb adds the columns to an existing DB', () => {
    const raw = new DatabaseSync(':memory:');
    raw.exec(`CREATE TABLE coffees (id INTEGER PRIMARY KEY, roaster TEXT NOT NULL, coffee_name TEXT NOT NULL,
      processing TEXT, roast_date TEXT, slug TEXT, status TEXT NOT NULL DEFAULT 'backlog', drank INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL)`);
    applySchema(raw);
    const cols = (raw.prepare(`PRAGMA table_info(coffees)`).all() as { name: string }[]).map((c) => c.name);
    expect(cols).toEqual(expect.arrayContaining(['producer', 'farm', 'variety', 'region', 'elevation', 'harvest_time', 'certification']));
  });
});

describe('lastImportedAt', () => {
  it('is null before any upload, then the stored time', () => {
    const db = createDb(':memory:');
    expect(lastImportedAt(db)).toBeNull();
    db.prepare(`INSERT INTO app_meta (key, value) VALUES ('beanconqueror_last_imported_at', ?)`).run('2026-11-01T10:00:00Z');
    expect(lastImportedAt(db)).toBe('2026-11-01T10:00:00Z');
  });
});

describe('brewing zone', () => {
  afterEach(() => setProcessZone('America/Denver'));
  it('empty db defaults to UTC', () => expect(getBrewingZone(createDb(':memory:'))).toBe('UTC'));
  it('db with brews gets America/Denver on boot, and the process follows', () => {
    const dir = mkdtempSync(join(tmpdir(), 'zone-'));
    try {
      const first = createDb(join(dir, 'a.db'));
      first.prepare(`DELETE FROM app_meta WHERE key = 'brewing_time_zone'`).run(); // a db from before the setting
      first.prepare(`INSERT INTO beanconqueror_brews (bc_created_at, imported_at) VALUES ('2026-03-08T01:30:00.000Z', 'x')`).run();
      first.close();
      setProcessZone('UTC');
      const again = createDb(join(dir, 'a.db'));
      expect(getBrewingZone(again)).toBe('America/Denver');
      expect(brewingZone()).toBe('America/Denver');
      setBrewingZone(again, 'Asia/Tokyo');
      expect(getBrewingZone(createDb(join(dir, 'a.db')))).toBe('Asia/Tokyo'); // a set zone is not overwritten
      again.close();
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
  it('a new account stays UTC across a restart after it adds a coffee', () => {
    const dir = mkdtempSync(join(tmpdir(), 'zone-'));
    try {
      const first = createDb(join(dir, 'b.db'));
      expect(getBrewingZone(first)).toBe('UTC');
      first.prepare(`INSERT INTO coffees (roaster, coffee_name, slug, created_at, updated_at) VALUES ('R', 'C', 'c', 'x', 'x')`).run();
      first.close();
      const again = createDb(join(dir, 'b.db'));
      expect(getBrewingZone(again)).toBe('UTC');
      again.close();
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
  it('a stored value that is not a zone reads as UTC', () => {
    const db = createDb(':memory:');
    db.prepare(`UPDATE app_meta SET value = 'Mars/Base' WHERE key = 'brewing_time_zone'`).run();
    expect(getBrewingZone(db)).toBe('UTC');
  });
  it("setBrewingZone rejects 'Mars/Base' and accepts UTC", () => {
    const db = createDb(':memory:');
    expect(() => setBrewingZone(db, 'Mars/Base')).toThrow(InvalidTimeZoneError);
    setBrewingZone(db, 'UTC');
    expect(getBrewingZone(db)).toBe('UTC');
  });
});

describe('zone aliases', () => {
  it('setters accept an alias and store its canonical name', () => {
    const db = createDb(':memory:');
    setBrewingZone(db, 'Asia/Kolkata');
    setDisplayZone(db, 'Europe/Kyiv');
    expect(getBrewingZone(db)).toBe(canonicalZone('Asia/Kolkata'));
    expect(getDisplayZone(db)).toBe(canonicalZone('Europe/Kyiv'));
    expect(() => setBrewingZone(db, 'Mars/Base')).toThrow(InvalidTimeZoneError);
  });
});

describe('display zone', () => {
  it("defaults to 'browser', stores a zone, rejects a bad one", () => {
    const db = createDb(':memory:');
    expect(getDisplayZone(db)).toBe('browser');
    setDisplayZone(db, 'Asia/Tokyo');
    expect(getDisplayZone(db)).toBe('Asia/Tokyo');
    setDisplayZone(db, 'browser');
    expect(getDisplayZone(db)).toBe('browser');
    expect(() => setDisplayZone(db, 'Mars/Base')).toThrow(InvalidTimeZoneError);
  });
});

describe('date format and default caffeine', () => {
  it('default, store, reject junk, and read a junk stored value as the default', () => {
    const db = createDb(':memory:');
    expect([getDateFormat(db), getDefaultCaffeine(db)]).toEqual(['iso12', 'caffeinated']);
    setDateFormat(db, 'eu');
    setDefaultCaffeine(db, 'all');
    expect([getDateFormat(db), getDefaultCaffeine(db)]).toEqual(['eu', 'all']);
    expect(() => setDateFormat(db, 'zz')).toThrow(InvalidSettingError);
    expect(() => setDefaultCaffeine(db, 'zz')).toThrow(InvalidSettingError);
    db.prepare(`UPDATE app_meta SET value = 'zz' WHERE key IN ('date_format', 'default_caffeine')`).run();
    expect([getDateFormat(db), getDefaultCaffeine(db)]).toEqual(['iso12', 'caffeinated']);
  });
});
