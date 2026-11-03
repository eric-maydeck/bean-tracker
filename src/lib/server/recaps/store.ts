import type { DatabaseSync } from 'node:sqlite';
import { recapYears } from '$lib/recapsUrl';

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
