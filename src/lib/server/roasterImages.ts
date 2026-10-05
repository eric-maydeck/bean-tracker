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
