import { describe, it, expect } from 'vitest';
import { createDb } from '$lib/server/db';
import { brewYears, freezeIds, frozenIds, markRecapSeen, recapReadyYear, recapSeen } from './store';

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
  it('recapReadyYear: newest unseen open year, admin only', () => {
    const db = createDb(':memory:');
    expect(recapReadyYear(db, '2026-11-01', true)).toBeNull();
    for (const d of ['2024-03-01T10:00:00.000Z', '2025-03-01T10:00:00.000Z', '2026-03-01T10:00:00.000Z'])
      db.prepare(`INSERT INTO beanconqueror_brews (bc_created_at, imported_at) VALUES (?, ?)`).run(d, d);
    expect(recapReadyYear(db, '2026-11-01', true)).toBe(2025);
    expect(recapReadyYear(db, '2026-11-01', false)).toBeNull();
    markRecapSeen(db, 2025);
    expect(recapReadyYear(db, '2026-11-01', true)).toBe(2024);
    markRecapSeen(db, 2024);
    expect(recapReadyYear(db, '2026-11-01', true)).toBeNull();
  });
});
