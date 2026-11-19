import type { DatabaseSync } from 'node:sqlite';

export function getUserKv(db: DatabaseSync, userId: string, key: string): unknown | null {
  const row = db.prepare(`SELECT value FROM user_kv WHERE user_id = ? AND key = ?`).get(userId, key) as
    | { value: string }
    | undefined;
  if (!row) return null;
  try {
    return JSON.parse(row.value);
  } catch {
    return null;
  }
}

export function setUserKv(db: DatabaseSync, userId: string, key: string, value: unknown): void {
  db.prepare(
    `INSERT INTO user_kv (user_id, key, value, updated_at) VALUES (?, ?, ?, ?)
     ON CONFLICT (user_id, key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
  ).run(userId, key, JSON.stringify(value), new Date().toISOString());
}
