// Roaster → website origin (spec 2026-10-06-image-suggest-design.md "Data").
// Not imported by db.ts's chain; keep it that way or value imports need .ts.
import type { DatabaseSync } from 'node:sqlite';

// A typed or stored website as an origin. A bare host gets https://.
export function toOrigin(raw: string | null | undefined): string | null {
  const s = raw?.trim();
  if (!s) return null;
  try {
    const url = new URL(/^[a-z][a-z0-9+.-]*:/i.test(s) ? s : `https://${s}`);
    return (url.protocol === 'http:' || url.protocol === 'https:') && url.hostname ? url.origin : null;
  } catch {
    return null;
  }
}

export function setRoasterWebsite(db: DatabaseSync, roaster: string, url: string): void {
  const origin = toOrigin(url);
  if (!origin) throw new Error(`Not a web address: ${url}`);
  db.prepare(
    `INSERT INTO roaster_websites (roaster, url) VALUES (?, ?)
     ON CONFLICT(roaster) DO UPDATE SET url = excluded.url`
  ).run(roaster.trim(), origin);
}

export function getRoasterWebsite(db: DatabaseSync, roaster: string): string | null {
  const row = db.prepare(`SELECT url FROM roaster_websites WHERE roaster = ?`).get(roaster.trim()) as { url: string } | undefined;
  return row?.url ?? null;
}

// ASCII-only folding, like SQLite's NOCASE on roaster_websites.roaster.
const roasterKey = (roaster: string) => roaster.trim().replace(/[A-Z]/g, (ch) => ch.toLowerCase());

// Boot (init hook): each roaster with no row gets the most common origin among
// its coffees' product URLs; ties go to the most recent coffee (rows come
// newest first and Map keeps first-seen order). Idempotent; never overwrites.
export function backfillRoasterWebsites(db: DatabaseSync): number {
  const rows = db
    .prepare(
      `SELECT roaster, product_url FROM coffees c
       WHERE product_url IS NOT NULL AND product_url <> ''
         AND NOT EXISTS (SELECT 1 FROM roaster_websites w WHERE w.roaster = c.roaster)
       ORDER BY created_at DESC, id DESC`
    )
    .all() as { roaster: string; product_url: string }[];
  const byRoaster = new Map<string, { roaster: string; counts: Map<string, number> }>();
  for (const r of rows) {
    const origin = toOrigin(r.product_url);
    if (!origin) continue;
    const key = roasterKey(r.roaster);
    if (!byRoaster.has(key)) byRoaster.set(key, { roaster: r.roaster.trim(), counts: new Map() });
    const counts = byRoaster.get(key)!.counts;
    counts.set(origin, (counts.get(origin) ?? 0) + 1);
  }
  const insert = db.prepare(`INSERT OR IGNORE INTO roaster_websites (roaster, url) VALUES (?, ?)`);
  let added = 0;
  for (const { roaster, counts } of byRoaster.values()) {
    let best = '';
    let most = 0;
    for (const [origin, n] of counts) if (n > most) [best, most] = [origin, n];
    added += Number(insert.run(roaster, best).changes);
  }
  if (added) console.log(`roaster websites: backfilled ${added}`);
  return added;
}
