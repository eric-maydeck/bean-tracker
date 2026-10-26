// One-time boot migration: link confirmed subscription bags (coffees.subscription_id).
// db.ts imports this file, so value imports here need explicit .ts extensions.
import type { DatabaseSync } from 'node:sqlite';

// slug + roaster identify the bag (test/seed DBs reuse slugs-less low ids, so no ids);
// the plan is guarded by its roaster_service. A bag's roaster may differ from its
// plan's (Airworks bags come from many roasters), so the two are checked separately.
export interface SubscriptionLink { slug: string; roaster: string; planId: number; planRoaster: string }

export const SUBSCRIPTION_LINKS_2026_10: SubscriptionLink[] = [
  { slug: '2026-shoebox-ethiopia-dembi-natural', roaster: 'Shoebox', planId: 3, planRoaster: 'Shoebox' },
  { slug: '2026-shoebox-mexico-san-pedro-ocopetatillo-washed', roaster: 'Shoebox', planId: 3, planRoaster: 'Shoebox' },
  { slug: '2026-shoebox-ethiopia-halo-beriti-washed-2026', roaster: 'Shoebox', planId: 3, planRoaster: 'Shoebox' },
  { slug: '2026-shoebox-ethiopia-halo-beriti-washed-2026-2', roaster: 'Shoebox', planId: 3, planRoaster: 'Shoebox' },
  { slug: '2026-shoebox-getachew-zeleke', roaster: 'Shoebox', planId: 3, planRoaster: 'Shoebox' },
  { slug: '2026-shoebox-getachew-zeleke-2', roaster: 'Shoebox', planId: 3, planRoaster: 'Shoebox' },
  { slug: '2026-shoebox-kamwangi-aa', roaster: 'Shoebox', planId: 3, planRoaster: 'Shoebox' },
  { slug: '2026-shoebox-mulish', roaster: 'Shoebox', planId: 3, planRoaster: 'Shoebox' },
  { slug: '2026-shoebox-ashenafi-getaneh', roaster: 'Shoebox', planId: 3, planRoaster: 'Shoebox' },
  { slug: '2026-shoebox-bookissa', roaster: 'Shoebox', planId: 3, planRoaster: 'Shoebox' },
  { slug: '2026-shoebox-habtamu-fikadu', roaster: 'Shoebox', planId: 3, planRoaster: 'Shoebox' },
  { slug: '2026-shoebox-fugi-kiyonza', roaster: 'Shoebox', planId: 3, planRoaster: 'Shoebox' },
  { slug: '2026-shoebox-fugi-ikizere', roaster: 'Shoebox', planId: 3, planRoaster: 'Shoebox' },
  { slug: '2026-shoebox-marlon-bolanos-3', roaster: 'Shoebox', planId: 3, planRoaster: 'Shoebox' },
  { slug: '2026-shoebox-marlon-bolanos-4', roaster: 'Shoebox', planId: 3, planRoaster: 'Shoebox' },
  { slug: '2026-shoebox-colombia-yessica-parra-aji-washed', roaster: 'Shoebox', planId: 3, planRoaster: 'Shoebox' },
  { slug: '2026-shoebox-colombia-yessica-parra-aji-washed-2', roaster: 'Shoebox', planId: 3, planRoaster: 'Shoebox' },
  { slug: '2026-shoebox-brazil-marcelo-assis-bioma-natural', roaster: 'Shoebox', planId: 3, planRoaster: 'Shoebox' },
  { slug: '2026-shoebox-tanzania-iyenga-amcos-washed', roaster: 'Shoebox', planId: 3, planRoaster: 'Shoebox' },
  { slug: '2026-shoebox-colombia-jeisson-burbano-gesha-washed', roaster: 'Shoebox', planId: 3, planRoaster: 'Shoebox' },
  { slug: '2026-shoebox-colombia-marlon-bolanos-gesha-natural', roaster: 'Shoebox', planId: 3, planRoaster: 'Shoebox' },
  { slug: '2026-shoebox-colombia-marlon-bolanos-gesha-natural-2', roaster: 'Shoebox', planId: 3, planRoaster: 'Shoebox' },
  { slug: '2026-shoebox-colombia-carlos-estrella-gesha-washed', roaster: 'Shoebox', planId: 3, planRoaster: 'Shoebox' },
  { slug: '2026-h-s-colombia-nemecio-ramos', roaster: 'H&S', planId: 2, planRoaster: 'H&S' },
  { slug: '2026-h-s-ethiopia-habtamu-fekadu', roaster: 'H&S', planId: 2, planRoaster: 'H&S' },
  { slug: '2026-h-s-mikuba-8-red-bourbon', roaster: 'H&S', planId: 2, planRoaster: 'H&S' },
  { slug: '2026-h-s-yessica-parra-pink-bourbon', roaster: 'H&S', planId: 2, planRoaster: 'H&S' },
  { slug: '2026-h-s-la-fortuna-pink-bourbon', roaster: 'H&S', planId: 2, planRoaster: 'H&S' },
  { slug: '2026-h-s-la-fortuna-bourbon-aji', roaster: 'H&S', planId: 2, planRoaster: 'H&S' },
  { slug: '2026-h-s-colombia-ernedis-rodriguez', roaster: 'H&S', planId: 2, planRoaster: 'H&S' },
  { slug: '2026-h-s-peru-efrain-carhuallocllo', roaster: 'H&S', planId: 2, planRoaster: 'H&S' },
  { slug: '2026-h-s-kageyo', roaster: 'H&S', planId: 2, planRoaster: 'H&S' },
  { slug: '2026-h-s-teodomiro-jimenez', roaster: 'H&S', planId: 2, planRoaster: 'H&S' },
  { slug: '2026-h-s-la-victoria', roaster: 'H&S', planId: 2, planRoaster: 'H&S' },
  { slug: '2026-h-s-yulisa-carhuallocllo-corazon-de-chirinos-2', roaster: 'H&S', planId: 2, planRoaster: 'H&S' },
  { slug: '2026-norml-coffee-ppl-tnt-flower-touch-gesha-roast-a', roaster: 'norml coffee ppl', planId: 4, planRoaster: 'norml coffee ppl' },
  { slug: '2026-norml-coffee-ppl-tnt-flower-touch-gesha-roast-b', roaster: 'norml coffee ppl', planId: 4, planRoaster: 'norml coffee ppl' },
  { slug: '2026-scenery-kenya-kerugoya-aa-026', roaster: 'Scenery', planId: 5, planRoaster: 'Scenery' },
  { slug: '2026-scenery-costa-rica-don-senel-milenio', roaster: 'Scenery', planId: 5, planRoaster: 'Scenery' },
  { slug: '2026-scenery-rwanda-cyesha-natural', roaster: 'Scenery', planId: 5, planRoaster: 'Scenery' },
  { slug: '2026-ceto-long-miles-munyinya', roaster: 'Ceto', planId: 6, planRoaster: 'Ceto' },
  { slug: '2026-ceto-long-miles-munyinya-2', roaster: 'Ceto', planId: 6, planRoaster: 'Ceto' },
  { slug: '2026-ceto-kigezi-valley-natural', roaster: 'Ceto', planId: 6, planRoaster: 'Ceto' },
  { slug: '2026-ceto-kigezi-valley-natural-2', roaster: 'Ceto', planId: 6, planRoaster: 'Ceto' },
  { slug: '2026-ceto-jorge-pikudo-andrade-rosado', roaster: 'Ceto', planId: 6, planRoaster: 'Ceto' },
  { slug: '2026-ceto-jorge-pikudo-andrade-rosado-2', roaster: 'Ceto', planId: 6, planRoaster: 'Ceto' },
  { slug: '2026-ceto-luis-edgar-camacho-bourbon', roaster: 'Ceto', planId: 6, planRoaster: 'Ceto' },
  { slug: '2026-ceto-luis-edgar-camacho-bourbon-2', roaster: 'Ceto', planId: 6, planRoaster: 'Ceto' },
  { slug: '2026-h-s-colombia-jailer-plazas', roaster: 'H&S', planId: 1, planRoaster: 'Airworks' },
  { slug: '2026-shoebox-honduras-alexia-meija-parainema-washed', roaster: 'Shoebox', planId: 1, planRoaster: 'Airworks' },
  { slug: '2026-delicate-coffee-roasters-suke-quto', roaster: 'delicate coffee roasters', planId: 1, planRoaster: 'Airworks' },
  { slug: '2026-shoebox-jigesa', roaster: 'Shoebox', planId: 1, planRoaster: 'Airworks' },
  { slug: '2026-shoebox-jigesa-2', roaster: 'Shoebox', planId: 1, planRoaster: 'Airworks' },
  { slug: '2026-ceto-kenya-mugaya-aa', roaster: 'Ceto', planId: 1, planRoaster: 'Airworks' },
  { slug: '2026-ceto-kenya-mugaya-aa-2', roaster: 'Ceto', planId: 1, planRoaster: 'Airworks' },
  { slug: '2026-big-sur-kenya-kamoko-aa', roaster: 'Big Sur', planId: 1, planRoaster: 'Airworks' },
  { slug: '2026-big-sur-kenya-kamoko-aa-2', roaster: 'Big Sur', planId: 1, planRoaster: 'Airworks' },
  { slug: '2026-big-sur-pure-bloom-pink-bourbon', roaster: 'Big Sur', planId: 1, planRoaster: 'Airworks' },
  { slug: '2026-big-sur-pure-bloom-pink-bourbon-2', roaster: 'Big Sur', planId: 1, planRoaster: 'Airworks' },
  { slug: '2026-h-s-efren-rodriguez-pink-bourbon', roaster: 'H&S', planId: 1, planRoaster: 'Airworks' },
  { slug: '2026-h-s-efren-rodriguez-pink-bourbon-2', roaster: 'H&S', planId: 1, planRoaster: 'Airworks' },
  { slug: '2026-ceto-habtamu-fikadu', roaster: 'Ceto', planId: 1, planRoaster: 'Airworks' },
  { slug: '2026-ceto-habtamu-fikadu-2', roaster: 'Ceto', planId: 1, planRoaster: 'Airworks' },
  { slug: '2026-scenery-ethiopia-kebena-natural-decaf', roaster: 'Scenery', planId: 1, planRoaster: 'Airworks' },
  { slug: '2026-big-sur-faysel-abdosh-single-farm-premium', roaster: 'Big Sur', planId: 1, planRoaster: 'Airworks' },
  { slug: '2026-big-sur-faysel-abdosh-single-farm-premium-2', roaster: 'Big Sur', planId: 1, planRoaster: 'Airworks' },
  { slug: '2026-september-abel-salinas-mejorado', roaster: 'September', planId: 1, planRoaster: 'Airworks' },
  { slug: '2026-september-abel-salinas-mejorado-2', roaster: 'September', planId: 1, planRoaster: 'Airworks' },
  { slug: '2026-still-komothai-kanake', roaster: 'Still', planId: 1, planRoaster: 'Airworks' },
  { slug: '2026-still-komothai-kanake-2', roaster: 'Still', planId: 1, planRoaster: 'Airworks' },
  { slug: '2026-ceto-marlon-bolanos-ea-decaf', roaster: 'Ceto', planId: 1, planRoaster: 'Airworks' },
  { slug: '2026-anamorphic-bukeye-hills', roaster: 'Anamorphic', planId: 1, planRoaster: 'Airworks' },
  { slug: '2026-anamorphic-bukeye-hills-2', roaster: 'Anamorphic', planId: 1, planRoaster: 'Airworks' },
  { slug: '2026-ceto-anthony-carranza', roaster: 'Ceto', planId: 1, planRoaster: 'Airworks' },
  { slug: '2026-ceto-anthony-carranza-2', roaster: 'Ceto', planId: 1, planRoaster: 'Airworks' },
  { slug: '2026-shoebox-jkt-itende-youth', roaster: 'Shoebox', planId: 1, planRoaster: 'Airworks' },
  { slug: '2026-shoebox-jkt-itende-youth-2', roaster: 'Shoebox', planId: 1, planRoaster: 'Airworks' },
];
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
  console.log(`subscription links (${marker}): applied ${set}, skipped ${links.length - set}`);
  return set;
}
