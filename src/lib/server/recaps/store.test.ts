import { describe, it, expect } from 'vitest';
import { createDb } from '$lib/server/db';
import { brewYears, ensureRecapAlerts, freezeIds, frozenIds, markRecapSeen, recapReadyYear, recapSeen } from './store';
import { dismissAlert, getActiveAlerts, markAlertRead } from '$lib/server/alerts';

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
  it('ensureRecapAlerts: one inbox alert per open year, kept by mark-read, never back after a dismiss, none for public', () => {
    const db = createDb(':memory:');
    for (const d of ['2025-03-01T10:00:00.000Z', '2026-03-01T10:00:00.000Z'])
      db.prepare(`INSERT INTO beanconqueror_brews (bc_created_at, imported_at) VALUES (?, ?)`).run(d, d);
    ensureRecapAlerts(db, '2026-11-01', false);
    expect(getActiveAlerts(db)).toEqual([]);
    ensureRecapAlerts(db, '2026-11-01', true);
    ensureRecapAlerts(db, '2026-11-01', true); // once
    const [a] = getActiveAlerts(db);
    expect(getActiveAlerts(db)).toHaveLength(1);
    expect(a).toMatchObject({ source: 'recap', message: 'Your 2025 recap is ready', severity: 'info', href: '/recaps/2025', read_at: null });
    markAlertRead(db, a.id);
    expect(getActiveAlerts(db)).toHaveLength(1); // mark-read keeps it
    markRecapSeen(db, 2025); // the banner's flag is independent
    expect(getActiveAlerts(db)).toHaveLength(1);
    dismissAlert(db, a.id);
    ensureRecapAlerts(db, '2026-11-01', true);
    expect(getActiveAlerts(db)).toEqual([]); // dismissed stays gone
    expect(recapReadyYear(db, '2026-11-01', true)).toBeNull(); // 2025 was seen by the banner flag; the alert changed nothing there
    ensureRecapAlerts(db, '2027-01-02', true);
    expect(getActiveAlerts(db).map((x) => x.message)).toEqual(['Your 2026 recap is ready']); // the next year opens
  });
});
