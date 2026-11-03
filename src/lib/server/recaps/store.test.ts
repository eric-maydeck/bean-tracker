import { describe, it, expect } from 'vitest';
import { createDb } from '$lib/server/db';
import { brewYears, freezeIds, frozenIds, markRecapSeen, recapSeen } from './store';

describe('store', () => {
  it('freezeIds keeps the first write', () => {
    const db = createDb(':memory:');
    expect(frozenIds(db, 2026)).toBeNull();
    expect(freezeIds(db, 2026, ['total', 'a'])).toEqual(['total', 'a']);
    expect(freezeIds(db, 2026, ['total', 'b'])).toEqual(['total', 'a']);
  });
  it('seen flag and brew years', () => {
    const db = createDb(':memory:');
    expect(recapSeen(db, 2026)).toBe(false);
    markRecapSeen(db, 2026);
    expect(recapSeen(db, 2026)).toBe(true);
    for (const d of ['2024-03-01T10:00:00.000Z', '2026-01-05T10:00:00.000Z', '2026-02-05T10:00:00.000Z'])
      db.prepare(`INSERT INTO beanconqueror_brews (bc_created_at, imported_at) VALUES (?, ?)`).run(d, d);
    expect(brewYears(db)).toEqual([2024, 2026]);
  });
});
