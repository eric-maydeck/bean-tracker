import { describe, it, expect } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { createDb, applySchema, getStatsRates, setStatsRates, InvalidRatesError } from './db';

describe('createDb', () => {
  it('creates all expected tables', () => {
    const db = createDb(':memory:');
    const tables = (
      db.prepare(`SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name`).all() as {
        name: string;
      }[]
    ).map((row) => row.name);
    expect(tables).toEqual([
      'app_meta',
      'beanconqueror_bean_origins',
      'beanconqueror_beans',
      'beanconqueror_brews',
      'beanconqueror_grinders',
      'beanconqueror_methods',
      'coffees',
      'roast_levels',
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
