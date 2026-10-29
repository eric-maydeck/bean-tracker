import type { DatabaseSync } from 'node:sqlite';

const DOSES_KEY = 'brew_now_doses';
const DEFAULT_DOSES = [15, 18, 20];

// 1–6 doses of 5–40 g, comma/space separated; stored sorted and unique.
export function parseBrewDoses(raw: string): { doses: number[] } | { error: string } {
  const parts = raw.split(/[,\s]+/).filter(Boolean).map(Number);
  if (parts.some((n) => !Number.isFinite(n) || n < 5 || n > 40)) return { error: 'Each dose must be 5–40 g' };
  const doses = [...new Set(parts)].sort((a, b) => a - b);
  if (doses.length < 1 || doses.length > 6) return { error: 'Enter 1–6 doses' };
  return { doses };
}

export function getBrewDoses(db: DatabaseSync): number[] {
  const row = db.prepare(`SELECT value FROM app_meta WHERE key = ?`).get(DOSES_KEY) as { value: string } | undefined;
  if (!row) return DEFAULT_DOSES;
  try {
    const p = parseBrewDoses(JSON.parse(row.value).join(' '));
    return 'doses' in p ? p.doses : DEFAULT_DOSES;
  } catch {
    return DEFAULT_DOSES;
  }
}

export function setBrewDoses(db: DatabaseSync, doses: number[]): void {
  db.prepare(
    `INSERT INTO app_meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`
  ).run(DOSES_KEY, JSON.stringify(doses));
}
