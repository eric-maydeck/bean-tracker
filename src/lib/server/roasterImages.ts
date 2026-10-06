// Roaster → default image (spec 2026-10-05-roaster-default-image-design.md).
// coffees.ts imports this and db.ts imports coffees.ts (via beanConquerorLinks.ts),
// so any value import added here needs an explicit .ts extension.
import type { DatabaseSync } from 'node:sqlite';

export function setRoasterImage(db: DatabaseSync, roaster: string, url: string): void {
  db.prepare(
    `INSERT INTO roaster_images (roaster, image_url) VALUES (?, ?)
     ON CONFLICT(roaster) DO UPDATE SET image_url = excluded.image_url`
  ).run(roaster.trim(), url.trim());
}

export function getRoasterImage(db: DatabaseSync, roaster: string): string | null {
  const row = db.prepare(`SELECT image_url FROM roaster_images WHERE roaster = ?`).get(roaster.trim()) as
    | { image_url: string }
    | undefined;
  return row?.image_url ?? null;
}

// The coffee form's preview map, keyed by the stored name (lookup ignores case: coffeeImage.ts).
export function getRoasterImages(db: DatabaseSync): Record<string, string> {
  const rows = db.prepare(`SELECT roaster, image_url FROM roaster_images`).all() as { roaster: string; image_url: string }[];
  return Object.fromEntries(rows.map((r) => [r.roaster, r.image_url]));
}

export type RoasterImageDefault = { roaster: string; image_url: string };

// The 2026-10 review's defaults (roasterImageDefaults.ts), applied once at boot
// in one transaction, then the marker stops a re-run. Fixes 'still' → 'Still'
// (slugs are lowercase, so unchanged), never overwrites a default set in the UI,
// then clears coffee images equal to their roaster's default so they inherit
// (the save-time dedupe in coffees.ts). No marker on a DB with no coffees yet.
export function applyRoasterImageDefaults(
  db: DatabaseSync,
  defaults: readonly RoasterImageDefault[],
  marker: string
): { renamed: number; added: number; skipped: number; cleared: number } | null {
  if (!db.prepare(`SELECT 1 FROM coffees LIMIT 1`).get()) return null;
  if (db.prepare(`SELECT 1 FROM app_meta WHERE key = ?`).get(marker)) return null;
  let added = 0;
  db.exec('BEGIN');
  try {
    const renamed = Number(db.prepare(`UPDATE coffees SET roaster = 'Still' WHERE roaster = 'still'`).run().changes);
    for (const d of defaults) {
      if (getRoasterImage(db, d.roaster) !== null) continue;
      setRoasterImage(db, d.roaster, d.image_url);
      added++;
    }
    const cleared = Number(
      db
        .prepare(
          `UPDATE coffees SET image_url = NULL
           WHERE image_url = (SELECT ri.image_url FROM roaster_images ri WHERE ri.roaster = coffees.roaster)`
        )
        .run().changes
    );
    db.prepare(`INSERT INTO app_meta (key, value) VALUES (?, ?)`).run(marker, new Date().toISOString());
    db.exec('COMMIT');
    const skipped = defaults.length - added;
    console.log(`roaster image defaults (${marker}): added ${added}, skipped ${skipped}, renamed ${renamed}, cleared ${cleared}`);
    return { renamed, added, skipped, cleared };
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}
