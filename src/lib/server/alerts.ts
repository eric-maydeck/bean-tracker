import type { DatabaseSync } from 'node:sqlite';
import type { AlertRow } from '../types';

export interface NewAlertInput {
  source: string;
  message: string;
  severity?: string;
}

export function createAlert(db: DatabaseSync, input: NewAlertInput): AlertRow {
  const now = new Date().toISOString();
  const severity = input.severity ?? 'error';
  const result = db
    .prepare(`INSERT INTO alerts (source, message, severity, created_at) VALUES (?, ?, ?, ?)`)
    .run(input.source, input.message, severity, now);
  return {
    id: Number(result.lastInsertRowid),
    source: input.source,
    message: input.message,
    severity,
    created_at: now,
    read_at: null,
    dismissed_at: null
  };
}

export function getActiveAlerts(db: DatabaseSync): AlertRow[] {
  return db.prepare(`SELECT * FROM alerts WHERE dismissed_at IS NULL ORDER BY created_at DESC, id DESC`).all() as unknown as AlertRow[];
}

export function markAlertRead(db: DatabaseSync, id: number): void {
  const now = new Date().toISOString();
  db.prepare(`UPDATE alerts SET read_at = ? WHERE id = ? AND read_at IS NULL`).run(now, id);
}

export function dismissAlert(db: DatabaseSync, id: number): void {
  const now = new Date().toISOString();
  db.prepare(`UPDATE alerts SET dismissed_at = ? WHERE id = ? AND dismissed_at IS NULL`).run(now, id);
}
