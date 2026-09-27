import type { DatabaseSync } from 'node:sqlite';
import { randomBytes } from 'node:crypto';

// Public short links for sharing long, filter-heavy views. Bounded so a
// flood can't grow the DB (it is copied with the DB):
// site pages only, 2 KB max, 365 days since last use, 10k rows (LRU).
// ponytail: no per-client rate limit; add one if the table gets flooded.
export const SHORT_LINK_TTL_DAYS = 365;
export const SHORT_LINK_MAX_ROWS = 10_000;
export const SHORT_LINK_MAX_LENGTH = 2048;

const SHAREABLE_PATH = /^\/(coffees(\/[a-z0-9-]+)?|stats|on-deck|subscriptions)$/;
const ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
const DAY_MS = 24 * 60 * 60 * 1000;

export function isShareablePath(url: unknown): url is string {
  if (typeof url !== 'string' || url.length > SHORT_LINK_MAX_LENGTH || !url.startsWith('/') || url.startsWith('//')) return false;
  let parsed: URL;
  try {
    parsed = new URL(url, 'http://local.invalid');
  } catch {
    return false;
  }
  return parsed.origin === 'http://local.invalid' && SHAREABLE_PATH.test(parsed.pathname);
}

// ponytail: modulo bias over 256 is irrelevant for link codes.
function newCode(): string {
  return Array.from(randomBytes(6), (b) => ALPHABET[b % ALPHABET.length]).join('');
}

function cutoff(now: Date): string {
  return new Date(now.getTime() - SHORT_LINK_TTL_DAYS * DAY_MS).toISOString();
}

export function createShortLink(db: DatabaseSync, url: string, now: Date): string {
  const iso = now.toISOString();
  const existing = db.prepare('SELECT code FROM short_links WHERE url = ?').get(url) as { code: string } | undefined;
  if (existing) {
    db.prepare('UPDATE short_links SET last_used_at = ? WHERE code = ?').run(iso, existing.code);
    return existing.code;
  }
  db.prepare('DELETE FROM short_links WHERE last_used_at < ?').run(cutoff(now));
  db.prepare(
    `DELETE FROM short_links WHERE code IN (
       SELECT code FROM short_links ORDER BY last_used_at DESC LIMIT -1 OFFSET ?)`
  ).run(SHORT_LINK_MAX_ROWS - 1);
  const insert = db.prepare('INSERT INTO short_links (code, url, created_at, last_used_at) VALUES (?, ?, ?, ?)');
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = newCode();
    try {
      insert.run(code, url, iso, iso);
      return code;
    } catch (err) {
      if (!String(err).includes('short_links.code')) throw err;
    }
  }
  throw new Error('could not allocate a short link code');
}

export function resolveShortLink(db: DatabaseSync, code: string, now: Date): string | null {
  const row = db.prepare('SELECT url, last_used_at FROM short_links WHERE code = ?').get(code) as
    | { url: string; last_used_at: string }
    | undefined;
  if (!row || row.last_used_at < cutoff(now)) return null;
  db.prepare('UPDATE short_links SET last_used_at = ? WHERE code = ?').run(now.toISOString(), code);
  return row.url;
}
