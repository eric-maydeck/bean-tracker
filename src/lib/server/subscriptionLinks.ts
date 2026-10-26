// One-time boot migration: link confirmed subscription bags (coffees.subscription_id).
// db.ts imports this file, so value imports here need explicit .ts extensions.
import type { DatabaseSync } from 'node:sqlite';

// slug + roaster identify the bag (test/seed DBs reuse slugs-less low ids, so no ids);
// the plan is guarded by its roaster_service. A bag's roaster may differ from its
// plan's (Airworks bags come from many roasters), so the two are checked separately.
export interface SubscriptionLink { slug: string; roaster: string; planId: number; planRoaster: string }

export const SUBSCRIPTION_LINKS_2026_10: SubscriptionLink[] = [];
export const SUBSCRIPTION_LINKS_2026_10_MARKER = 'subscription_links_2026_10';

// Returns rows set. An empty list writes no marker, so a later filled list still runs.
export function applySubscriptionLinks(db: DatabaseSync, links: readonly SubscriptionLink[], marker: string): number {
  if (links.length === 0) return 0;
  if (db.prepare(`SELECT 1 FROM app_meta WHERE key = ?`).get(marker)) return 0;
  const link = db.prepare(
    `UPDATE coffees SET subscription_id = :planId
     WHERE slug = :slug AND roaster = :roaster AND subscription_id IS NULL
       AND EXISTS (SELECT 1 FROM subscriptions WHERE id = :planId AND roaster_service = :planRoaster)`
  );
  let set = 0;
  db.exec('BEGIN');
  try {
    for (const l of links) set += Number(link.run({ ...l }).changes);
    db.prepare(`INSERT INTO app_meta (key, value) VALUES (?, ?)`).run(marker, new Date().toISOString());
    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
  return set;
}
