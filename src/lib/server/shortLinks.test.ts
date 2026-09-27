import { describe, it, expect, beforeEach } from 'vitest';
import type { DatabaseSync } from 'node:sqlite';
import { createDb } from './db';
import { isShareablePath, createShortLink, resolveShortLink, SHORT_LINK_MAX_ROWS } from './shortLinks';

let db: DatabaseSync;
beforeEach(() => {
  db = createDb(':memory:');
});
const day = 24 * 60 * 60 * 1000;
const t0 = new Date('2026-09-27T00:00:00Z');

describe('isShareablePath', () => {
  it('accepts site pages with queries', () => {
    for (const u of [
      '/coffees',
      '/coffees?status=all&q=lume',
      '/coffees/2026-h-s-some-coffee',
      '/stats?bc=brewing',
      '/on-deck?show=decaf',
      '/subscriptions?view=list'
    ])
      expect(isShareablePath(u)).toBe(true);
  });
  it('refuses everything else', () => {
    for (const u of [
      'https://evil.com/coffees',
      '//evil.com/coffees',
      '/login',
      '/api/coffees/commit-batch',
      '/s/abc',
      '/coffees/a/b',
      'coffees',
      '',
      42,
      null,
      '/coffees?' + 'x'.repeat(2048)
    ])
      expect(isShareablePath(u)).toBe(false);
  });
});

describe('create / resolve', () => {
  it('creates a 6-char base62 code and resolves it', () => {
    const code = createShortLink(db, '/coffees?q=lume', t0);
    expect(code).toMatch(/^[0-9A-Za-z]{6}$/);
    expect(resolveShortLink(db, code, t0)).toBe('/coffees?q=lume');
  });
  it('dedupes identical urls', () => {
    expect(createShortLink(db, '/stats', t0)).toBe(createShortLink(db, '/stats', t0));
  });
  it('unknown codes resolve to null', () => {
    expect(resolveShortLink(db, 'nope00', t0)).toBeNull();
  });
  it('expires after 365 days unused, and resolving refreshes the clock', () => {
    const code = createShortLink(db, '/on-deck', t0);
    expect(resolveShortLink(db, code, new Date(t0.getTime() + 300 * day))).toBe('/on-deck');
    expect(resolveShortLink(db, code, new Date(t0.getTime() + 600 * day))).toBe('/on-deck'); // 300d since last use
    expect(resolveShortLink(db, code, new Date(t0.getTime() + 1000 * day))).toBeNull();
  });
  it('evicts least-recently-used rows past the cap', () => {
    const insert = db.prepare('INSERT INTO short_links (code, url, created_at, last_used_at) VALUES (?, ?, ?, ?)');
    for (let i = 0; i < SHORT_LINK_MAX_ROWS; i++) {
      const ts = new Date(t0.getTime() + i * 1000).toISOString();
      insert.run(`c${String(i).padStart(5, '0')}`, `/coffees?q=${i}`, ts, ts);
    }
    createShortLink(db, '/stats', new Date(t0.getTime() + day));
    const { n } = db.prepare('SELECT COUNT(*) n FROM short_links').get() as { n: number };
    expect(n).toBe(SHORT_LINK_MAX_ROWS);
    expect(resolveShortLink(db, 'c00000', t0)).toBeNull(); // oldest evicted
  });
});
