// Builds the throwaway DB the UI layout checks run against. Never real data:
// it refuses any path outside .ui-test/. Usage: node scripts/ui-seed.ts .ui-test/ui.db
import { rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve, sep } from 'node:path';
import { createDb } from '../src/lib/server/db.ts';
import { createCoffee, type NewCoffeeInput } from '../src/lib/server/coffees.ts';
import { createSubscription } from '../src/lib/server/subscriptions.ts';

const path = process.argv[2] ?? '';
if (!resolve(path).startsWith(resolve('.ui-test') + sep)) {
  console.error('ui-seed: path must be under .ui-test/ (got "' + path + '")');
  process.exit(1);
}
for (const p of [path, `${path}-wal`, `${path}-shm`]) rmSync(p, { force: true });
rmSync('.ui-test/screenshots', { recursive: true, force: true });
mkdirSync('.ui-test', { recursive: true });

const day = 24 * 60 * 60 * 1000;
const daysAgo = (n: number) => new Date(Date.now() - n * day).toISOString().slice(0, 10);
const isoDaysAgo = (n: number) => new Date(Date.now() - n * day).toISOString();

const LONG_ROASTER = 'The Extraordinarily Long-Named Specialty Roasting Collective of Portland';
const LONG_NAME = 'Finca El Paraíso Lychee Double Anaerobic Thermal Shock Gesha Lot 42 Competition Reserve';

const db = createDb(path);

function coffee(over: Partial<NewCoffeeInput> & Pick<NewCoffeeInput, 'roaster' | 'coffee_name'>) {
  return createCoffee(db, {
    origin: 'Ethiopia',
    roast_level: 'Light',
    processing: 'Washed',
    amount_g: 250,
    cost: 22,
    roast_date: daysAgo(10),
    frozen_start_date: null,
    frozen_end_date: null,
    rest_days_low: 7,
    rest_days_high: 21,
    image_url: null,
    ...over
  });
}

// Status coverage: backlog, frozen backlog, open, archive, so every status
// action button (Open, Freeze, Thaw, Unopen, Archive, Restore, Delete) shows up somewhere.
const long = coffee({ roaster: LONG_ROASTER, coffee_name: LONG_NAME, status: 'open', roast_date: daysAgo(12),
  origin: 'Colombia', processing: 'Double Anaerobic Thermal Shock Natural' });
const decaf = coffee({ roaster: 'Onyx', coffee_name: 'Swiss Water Decaf Colombia Huila', decaf: true, roast_date: daysAgo(5) });
coffee({ roaster: 'Sey', coffee_name: 'Kenya Kiambu Karindundu AA', roast_date: daysAgo(20) });
coffee({ roaster: 'Sey', coffee_name: 'Kenya Kiambu Karindundu AA', roast_date: daysAgo(20) });
const frozen = coffee({ roaster: 'Moonwake', coffee_name: 'Ethiopia Bensa Bombe', roast_date: daysAgo(40),
  frozen_start_date: daysAgo(30) });
coffee({ roaster: 'Hydrangea', coffee_name: 'Colombia Pink Bourbon', status: 'archive', roast_date: daysAgo(90) });
const linked = coffee({ roaster: 'The Picky Chemist', coffee_name: 'El Dorado Double Ferment Gesha', status: 'open',
  roast_date: daysAgo(15) });
coffee({ roaster: 'Flower Child', coffee_name: 'Rwanda Gitega Natural', roast_date: daysAgo(9) });

createSubscription(db, { roaster_service: 'A Very Long Subscription Service Name That Keeps Going', subscription_name:
  'Explorer Series: Two Rotating Single Origins Every Other Week', price: 44.5, bag_count: 2, amount_per_bag_g: 250, renewal_day: 15 });
createSubscription(db, { roaster_service: 'Sey', subscription_name: null, price: 30, bag_count: 1, amount_per_bag_g: 250,
  renewal_day: 1 });

const now = new Date().toISOString();
const bean = db.prepare(
  `INSERT INTO beanconqueror_beans (id, name, roaster, roast_date, weight_g, cost, decaffeinated, bc_created_at, imported_at)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
);
bean.run('bean-linked', 'El Dorado Double Ferment Gesha', 'The Picky Chemist', daysAgo(15), 250, 30, 0, isoDaysAgo(14), now);
bean.run('bean-twin-1', 'Kenya Kiambu Karindundu AA', 'Sey', daysAgo(20), 250, 24, 0, isoDaysAgo(19), now);
bean.run('bean-twin-2', 'Kenya Kiambu Karindundu AA', 'Sey', daysAgo(20), 250, 24, 0, isoDaysAgo(18), now);
bean.run('bean-likely', 'Rwanda Gitega Natural Anaerobic', 'Flower Child', daysAgo(9), 250, 21, 0, isoDaysAgo(8), now);
bean.run('bean-long', `${LONG_NAME} (second bag)`, LONG_ROASTER, daysAgo(3), 250, 40, 0, isoDaysAgo(2), now);
bean.run('bean-decaf', 'Mountain Water Decaf Peru Cajamarca Organic Fair Trade', null, null, 340, 19, 1, isoDaysAgo(1), now);
// createDb made this DB with the column already present, so no backfill ran
// and the import's auto-link doesn't apply here: link the one bean explicitly.
// The twins stay unlinked (they show up in Stats → Not yet tracked).
db.prepare(`UPDATE beanconqueror_beans SET coffee_id = ? WHERE id = 'bean-linked'`).run(linked.id);
db.prepare(
  `INSERT INTO beanconqueror_bean_origins (bean_id, component_number, country, processing) VALUES (?, 1, ?, ?)`
).run('bean-long', 'Colombia', 'Double Anaerobic Thermal Shock Natural');
db.prepare(`INSERT INTO beanconqueror_methods (id, preparation_method, name, imported_at) VALUES ('m1', 'V60', 'V60', ?)`).run(now);
db.prepare(`INSERT INTO beanconqueror_grinders (id, name, imported_at) VALUES ('g1', 'ZP6 Special', ?)`).run(now);
const brew = db.prepare(
  `INSERT INTO beanconqueror_brews (bc_created_at, bean_id, preparation_id, mill_id, ground_coffee_g, brew_temperature,
     water_amount_g, rating, bean_age_days, imported_at) VALUES (?, ?, 'm1', 'g1', 15, 93, 250, ?, ?, ?)`
);
for (let i = 0; i < 8; i++) brew.run(isoDaysAgo(i + 1), 'bean-linked', 6 + (i % 4), 14 - i, now);
for (let i = 0; i < 3; i++) brew.run(isoDaysAgo(i + 2), 'bean-twin-1', 7, 18 + i, now);
for (let i = 0; i < 2; i++) brew.run(isoDaysAgo(i + 1), 'bean-likely', 8, 7 + i, now);
db.prepare(`INSERT INTO app_meta (key, value) VALUES ('beanconqueror_last_imported_at', ?)
  ON CONFLICT(key) DO UPDATE SET value = excluded.value`).run(now);

writeFileSync('.ui-test/seed.json', JSON.stringify({
  slugs: { long: long.slug, linked: linked.slug, frozen: frozen.slug, decaf: decaf.slug },
  names: { long: LONG_NAME, everyAction: 'Ethiopia Bensa Bombe' }
}));
db.close();
console.log(`ui-seed: wrote ${path}`);
