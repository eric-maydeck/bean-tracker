// One-time boot fix: coffees.image_source_url for coffees whose own image was found on a page
// (imageSourceData.ts). Keyed by id + roaster + the image_url that was checked, and only fills an
// empty source, so a newer image or a Suggest pick since is never overwritten. updated_at is left alone
// (a data fix, not an edit). A fifth element also replaces the image (checked live on the page); that also fills an empty product_url with the page.
import type { DatabaseSync } from 'node:sqlite';

export const IMAGE_SOURCES_MARKER = 'image_sources_2026_10';

export function applyImageSources(
  db: DatabaseSync,
  rows: [number, string, string, string, string?][],
  marker = IMAGE_SOURCES_MARKER
): number | null {
  if (!db.prepare(`SELECT 1 FROM coffees LIMIT 1`).get()) return null;
  if (db.prepare(`SELECT 1 FROM app_meta WHERE key = ?`).get(marker)) return null;
  const set = db.prepare(
    `UPDATE coffees SET image_source_url = ?, image_url = COALESCE(?, image_url),
       product_url = CASE WHEN ? IS NOT NULL AND COALESCE(product_url, '') = '' THEN ? ELSE product_url END
     WHERE id = ? AND roaster = ? AND image_url = ? AND image_source_url IS NULL`
  );
  let applied = 0;
  db.exec('BEGIN');
  try {
    for (const [id, roaster, image, source, newImage] of rows) {
      applied += Number(set.run(source, newImage ?? null, newImage ?? null, source, id, roaster, image).changes);
    }
    db.prepare(`INSERT INTO app_meta (key, value) VALUES (?, ?)`).run(marker, new Date().toISOString());
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
  console.log(`image sources (${marker}): applied ${applied} of ${rows.length}`);
  return applied;
}
