import type { DatabaseSync } from 'node:sqlite';
import { recapYears } from '$lib/recapsUrl';
import { createAlert } from '$lib/server/alerts';

const get = (db: DatabaseSync, key: string) =>
  (db.prepare(`SELECT value FROM app_meta WHERE key = ?`).get(key) as { value: string } | undefined)?.value ?? null;

export function frozenIds(db: DatabaseSync, year: number): string[] | null {
  const v = get(db, `recap_ids_${year}`);
  return v ? (JSON.parse(v) as string[]) : null;
}
export function freezeIds(db: DatabaseSync, year: number, ids: readonly string[]): string[] {
  db.prepare(`INSERT OR IGNORE INTO app_meta (key, value) VALUES (?, ?)`).run(`recap_ids_${year}`, JSON.stringify(ids));
  return frozenIds(db, year)!;
}
export const recapSeen = (db: DatabaseSync, year: number) => get(db, `recap_seen_${year}`) !== null;
export function markRecapSeen(db: DatabaseSync, year: number): void {
  db.prepare(`INSERT OR IGNORE INTO app_meta (key, value) VALUES (?, ?)`).run(`recap_seen_${year}`, '1');
}
export function brewYears(db: DatabaseSync): number[] {
  return (db.prepare(`SELECT DISTINCT substr(bc_created_at, 1, 4) AS y FROM beanconqueror_brews WHERE bc_created_at IS NOT NULL ORDER BY y`).all() as { y: string }[])
    .map((r) => Number(r.y)).filter(Boolean);
}
// The newest open year the admin hasn't seen; the layout shows its banner.
export function recapReadyYear(db: DatabaseSync, today: string, isAdmin: boolean): number | null {
  return isAdmin ? (recapYears(brewYears(db), today).find((y) => !recapSeen(db, y)) ?? null) : null;
}
// One inbox alert per open year for the admin, created the first time we see the year open. The app_meta guard keeps it
// from coming back after the admin dismisses it, and the banner's seen flag is separate (neither touches the other).
export function ensureRecapAlerts(db: DatabaseSync, today: string, isAdmin: boolean): void {
  if (!isAdmin) return;
  // ponytail: newest open year already alerted => done, one small read, no brew scan (an older year gaining brews later is not alerted)
  if (get(db, `recap_alert_${Number(today.slice(0, 4)) - 1}`) !== null) return;
  for (const y of recapYears(brewYears(db), today)) {
    const made = db.prepare(`INSERT OR IGNORE INTO app_meta (key, value) VALUES (?, '1')`).run(`recap_alert_${y}`);
    if (made.changes) createAlert(db, { source: 'recap', message: `Your ${y} recap is ready`, severity: 'info', href: `/recaps/${y}` });
  }
}
