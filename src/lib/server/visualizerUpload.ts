// Bean Conqueror's "custom Visualizer server" upload: password, parsing and storage (plan 2026-10-27-bc-phone-import).
import { createHash } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import { verifyPassword } from './auth';
import { compactFlow, type CompactFlow } from './bcFlow';

export const MAX_SHOT_BYTES = 5 * 1024 * 1024;
/** Shown on the page; the server ignores the username. */
export const UPLOAD_USERNAME = 'bean-tracker';

const LAST_UPLOAD_KEY = 'visualizer_last_upload_at';

const getMeta = (db: DatabaseSync, key: string): string | null =>
  (db.prepare(`SELECT value FROM app_meta WHERE key = ?`).get(key) as { value: string } | undefined)?.value ?? null;
const setMeta = (db: DatabaseSync, key: string, value: string) =>
  db.prepare(`INSERT INTO app_meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`).run(key, value);

// ponytail: one-entry memo of the last good header (sha256), so "Upload all" doesn't pay scrypt 1,330 times; keyed on the hash, so a new hash invalidates it
let lastGood: string | null = null;
const memoKey = (header: string, storedHash: string) => createHash('sha256').update(header).update('\0').update(storedHash).digest('hex');

/** The Basic password is the admin sign-in password (ADMIN_PASSWORD_HASH), as for /login; the username is ignored. */
export function verifyUploadAuth(authorization: string | null): boolean {
  const stored = process.env.ADMIN_PASSWORD_HASH;
  if (!stored || !authorization) return false;
  const m = /^Basic (\S+)$/i.exec(authorization);
  if (!m) return false;
  const key = memoKey(authorization, stored);
  if (key === lastGood) return true;
  const decoded = Buffer.from(m[1], 'base64').toString('utf8');
  const i = decoded.indexOf(':');
  if (i < 0) return false;
  if (!verifyPassword(decoded.slice(i + 1), stored)) return false;
  lastGood = key;
  return true;
}

export class ShotError extends Error {
  readonly status = 400;
}

export function parseShot(json: unknown): { uuid: string; flow: CompactFlow } {
  const j = (json ?? {}) as { application?: unknown; brew?: { config?: { uuid?: unknown } }; brewFlow?: unknown };
  if (j.application !== 'BEANCONQUEROR') throw new ShotError('Not a Bean Conqueror upload');
  const uuid = j.brew?.config?.uuid;
  if (typeof uuid !== 'string' || !/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(uuid)) throw new ShotError('Missing brew id');
  const flow = compactFlow(j.brewFlow);
  if (!flow) throw new ShotError('This brew has no flow data');
  return { uuid, flow };
}

export function saveShot(db: DatabaseSync, shot: { uuid: string; flow: CompactFlow }): { id: string } {
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO beanconqueror_brew_flows (bc_uuid, format, step_ms, points, weights, uploaded_at) VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(bc_uuid) DO UPDATE SET format = excluded.format, step_ms = excluded.step_ms, points = excluded.points,
       weights = excluded.weights, uploaded_at = excluded.uploaded_at`
  ).run(shot.uuid, shot.flow.v, shot.flow.stepMs, shot.flow.w.length, JSON.stringify(shot.flow.w), now);
  setMeta(db, LAST_UPLOAD_KEY, now);
  return { id: shot.uuid };
}

export function uploadStatus(db: DatabaseSync) {
  const one = (sql: string) => (db.prepare(sql).get() as { n: number | null }).n ?? 0;
  return {
    lastUploadAt: getMeta(db, LAST_UPLOAD_KEY),
    flows: one(`SELECT COUNT(*) n FROM beanconqueror_brew_flows`),
    joined: one(`SELECT COUNT(*) n FROM beanconqueror_brew_flows f JOIN beanconqueror_brews b ON b.bc_uuid = f.bc_uuid WHERE b.has_flow_profile = 1`),
    waiting: one(`SELECT COUNT(*) n FROM beanconqueror_brew_flows f WHERE NOT EXISTS (SELECT 1 FROM beanconqueror_brews b WHERE b.bc_uuid = f.bc_uuid)`),
    brewsWithFlow: one(`SELECT SUM(has_flow_profile) n FROM beanconqueror_brews`)
  };
}
