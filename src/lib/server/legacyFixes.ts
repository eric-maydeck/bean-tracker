// FROZEN history: one-off fixes written for the owner's database. Already applied there; never runs
// on a fresh database (applySchema skips it when app_meta has `fresh_db`). Do not add to this file:
// new fixes go in applySchema (fixes for every database) or scripts/fixes/ (one person's data).
import type { DatabaseSync } from 'node:sqlite';
import { applyCoffeeFixes } from './coffees.ts';
import { PRODUCT_PAGE_BACKFILLS } from './productPageBackfill.ts';
import { BEAN_DATA_BACKFILLS } from './beanDataBackfill.ts';
import { BEAN_BASE_BACKFILLS } from './beanBaseBackfill.ts';
import { COFFEE_CORRECTIONS } from './coffeeCorrections.ts';
import { applyDataStandards } from './standards.ts';
import { applySubscriptionUrls, SUBSCRIPTION_URLS_2026_10_08 } from './subscriptions.ts';
import { applyBeanConquerorPairs } from './beanConquerorLinks.ts';
import { applySubscriptionLinks, SUBSCRIPTION_LINKS_2026_10, SUBSCRIPTION_LINKS_2026_10_MARKER } from './subscriptionLinks.ts';
import { applyImageSources } from './imageSourceFixes.ts';
import { IMAGE_SOURCES_2026_10 } from './imageSourceData.ts';
import { applyRecipeFixes, applyRecipeLengthFix } from './recipeFixes.ts';
import { BEAN_CONQUEROR_PAIRS, PAIRS_2026_10B, PAIRS_2026_10B_MARKER, FIXES_2026_10B, PAIRS_2026_11, PAIRS_2026_11_MARKER } from './beanConquerorPairs.ts';
import { OWN_DATA_ONLY, OWN_DATA_SIMILAR } from '../gear.ts';
import { applyRoasterImageDefaults } from './roasterImages.ts';
import { ROASTER_IMAGE_DEFAULTS, ROASTER_IMAGE_DEFAULTS_MARKER, ROASTER_IMAGE_DEFAULTS_2026_10B, ROASTER_IMAGE_DEFAULTS_2026_10B_MARKER } from './roasterImageDefaults.ts';

// Runs after applySchema's own transactions (SQLite throws on a nested BEGIN). blendJustAdded: coffees.blend was added this boot.
export function applyLegacyFixes(db: DatabaseSync, blendJustAdded: boolean): void {
  applyBeanConquerorPairs(db, BEAN_CONQUEROR_PAIRS); // own transaction, so after the COMMIT above
  applyBeanConquerorPairs(db, PAIRS_2026_10B, FIXES_2026_10B, PAIRS_2026_10B_MARKER);
  applyBeanConquerorPairs(db, PAIRS_2026_11, [], PAIRS_2026_11_MARKER);
  applyRoasterImageDefaults(db, ROASTER_IMAGE_DEFAULTS, ROASTER_IMAGE_DEFAULTS_MARKER);
  applyRoasterImageDefaults(db, ROASTER_IMAGE_DEFAULTS_2026_10B, ROASTER_IMAGE_DEFAULTS_2026_10B_MARKER);
  for (const b of PRODUCT_PAGE_BACKFILLS) applyCoffeeFixes(db, b); // own transaction each, after roaster defaults
  for (const b of BEAN_DATA_BACKFILLS) applyCoffeeFixes(db, b); // reviewed origin/amount/cost fixes + unlinked deletes
  for (const b of BEAN_BASE_BACKFILLS) applyCoffeeFixes(db, b); // reviewed Bean Base fills (tasting notes, bean_base_id, origin detail)
  for (const b of COFFEE_CORRECTIONS) applyCoffeeFixes(db, b);
  applyDataStandards(db, 'data_standards_2026_11'); // one-time conversion to docs/data-standards.md forms
  applyImageSources(db, IMAGE_SOURCES_2026_10);
  applySubscriptionUrls(db, SUBSCRIPTION_URLS_2026_10_08, 'subscription_urls_2026_10_08');
  applySubscriptionLinks(db, SUBSCRIPTION_LINKS_2026_10, SUBSCRIPTION_LINKS_2026_10_MARKER);
  applyRecipeFixes(db);
  applyRecipeLengthFix(db);
  // computeFill's solid-border rule changed, so cached fills may be wrong; drop
  // them once and the background run refills every displayed URL at boot.
  if (!db.prepare(`SELECT 1 FROM app_meta WHERE key = ?`).get('image_fills_recompute_2026_10_06')) {
    db.exec('BEGIN');
    db.exec(`DELETE FROM image_fills`);
    db.prepare(`INSERT INTO app_meta (key, value) VALUES (?, ?)`).run('image_fills_recompute_2026_10_06', new Date().toISOString());
    db.exec('COMMIT');
  }
  // The Shoebox roaster default (a transparent logo) on its labels' green
  // rather than the computed tan (user request). A later full recompute (like
  // the one above) would drop it; re-add it then.
  if (!db.prepare(`SELECT 1 FROM app_meta WHERE key = ?`).get('shoebox_logo_fill_2026_10_08')) {
    db.exec('BEGIN');
    db.prepare(
      `INSERT INTO image_fills (url, fill) VALUES (?, ?) ON CONFLICT(url) DO UPDATE SET fill = excluded.fill`
    ).run('https://shoebox.coffee/cdn/shop/files/Main.png?v=1737911185', '#9ae197');
    db.prepare(`INSERT INTO app_meta (key, value) VALUES (?, ?)`).run('shoebox_logo_fill_2026_10_08', new Date().toISOString());
    db.exec('COMMIT');
  }
  // Single origin / Blend: the only real blend (user, 2026-11-01). Runs only the moment the column is added.
  if (blendJustAdded) {
    const ids = db.prepare(`SELECT id FROM coffees WHERE roaster = ? AND coffee_name = ?`)
      .all('S&W Craft Roasting', "Teddy's Terror (blend)") as { id: number }[];
    for (const { id } of ids) db.prepare(`UPDATE coffees SET blend = 1, origin = 'Blend' WHERE id = ?`).run(id);
  }
  // Brew now: the user's own dripper/filter suggest from their own brews only. Once; a later edit sticks.
  if (!db.prepare(`SELECT 1 FROM app_meta WHERE key = ?`).get('brew_now_own_data_2026_10c')) {
    // Unshipped wording changes: carry any earlier values over to the current strings.
    const rename = db.prepare(`UPDATE gear_details SET fields = json_set(fields, '$.ownData', ?) WHERE json_extract(fields, '$.ownData') IN (?, ?)`);
    rename.run(OWN_DATA_ONLY, 'This gear only', 'Own brews only');
    rename.run(OWN_DATA_SIMILAR, 'Similar gear too', 'Similar gear');
    const set = db.prepare(
      `UPDATE gear_details SET fields = json_set(fields, '$.ownData', '${OWN_DATA_ONLY.replace(/'/g, "''")}') WHERE kind = ? AND name = ?`
    );
    set.run('dripper', 'Graycano');
    set.run('filter', 'Sibarist Fast');
    db.prepare(`INSERT INTO app_meta (key, value) VALUES (?, ?)`).run('brew_now_own_data_2026_10c', new Date().toISOString());
  }
}
