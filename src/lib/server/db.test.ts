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
    expect(tables).toEqual(['coffees', 'roast_levels', 'subscriptions']);
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
