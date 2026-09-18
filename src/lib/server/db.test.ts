import { describe, it, expect } from 'vitest';
import { createDb, applySchema } from './db';

describe('createDb', () => {
  it('creates all expected tables', () => {
    const db = createDb(':memory:');
    const tables = (
      db.prepare(`SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name`).all() as {
        name: string;
      }[]
    ).map((row) => row.name);
    expect(tables).toEqual(['app_meta', 'coffees', 'roast_levels', 'subscriptions']);
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
});
