// Builds the throwaway DB the UI layout checks run against. Never real data:
// it refuses any path outside .ui-test/. Usage: npx vite-node --config scripts/vite-node.config.mjs scripts/ui-seed.ts .ui-test/ui.db
import { rmSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { resolve, sep } from 'node:path';
import { createDb } from '../src/lib/server/db.ts';
import { createCoffee, type NewCoffeeInput } from '../src/lib/server/coffees.ts';
import { createSubscription } from '../src/lib/server/subscriptions.ts';
import { setRoasterImage } from '../src/lib/server/roasterImages.ts';
import { bcTimestamp } from '../src/lib/server/beanConquerorJson.ts';
import { FLOW_STEP_MS, compactFlow } from '../src/lib/server/bcFlow.ts';
import { readStale } from '../src/lib/server/pourReadings.ts';
import { dismissStructure, rematchBrews, saveRecipe } from '../src/lib/server/recipes.ts';
import { draftFromReadings } from '../src/lib/recipes.ts';
import type { PourReading } from '../src/lib/pours.ts';

const path = process.argv[2] ?? '';
if (!resolve(path).startsWith(resolve('.ui-test') + sep)) {
  console.error('ui-seed: path must be under .ui-test/ (got "' + path + '")');
  process.exit(1);
}
for (const p of [path, `${path}-wal`, `${path}-shm`]) rmSync(p, { force: true });
rmSync('.ui-test/screenshots', { recursive: true, force: true });
mkdirSync('.ui-test', { recursive: true });

// Dates count back from the local "now", as the app does (insights/time.ts): bc_created_at is local
// wall time with a fake 'Z' (bcTimestamp). UTC "now" put every brew a day late from 18:00 local.
const day = 24 * 60 * 60 * 1000;
// the local offset, fixed at seed time (wall clock as fake UTC: no DST jumps). The clock keeps
// ticking, so same-day brews of one bean keep distinct timestamps (a unique index).
const toLocal = Date.parse(bcTimestamp(Date.now() / 1000)) - Date.now();
const isoDaysAgo = (n: number) => new Date(Date.now() + toLocal - n * day).toISOString();
const daysAgo = (n: number) => isoDaysAgo(n).slice(0, 10);

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
const decaf = coffee({ roaster: 'Onyx', coffee_name: 'Swiss Water Decaf Colombia Huila', decaf: true, roast_date: daysAgo(5),
  cost: 0 }); // the seed's free bag (Over time names it: "1 free bag not in $/g")
const sey = coffee({ roaster: 'Sey', coffee_name: 'Kenya Kiambu Karindundu AA', roast_date: daysAgo(20) });
coffee({ roaster: 'Sey', coffee_name: 'Kenya Kiambu Karindundu AA', roast_date: daysAgo(20) });
const frozen = coffee({ roaster: 'Moonwake', coffee_name: 'Ethiopia Bensa Bombe', roast_date: daysAgo(40),
  frozen_start_date: daysAgo(30) });
// Moonwake has no image of its own: its cards show only the roaster default.
// A data: URI so the check never needs the network.
setRoasterImage(db, 'Moonwake', 'data:image/svg+xml,' + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="64" height="64" fill="#6b4f3a"/></svg>'));
coffee({ roaster: 'Hydrangea', coffee_name: 'Colombia Pink Bourbon', status: 'archive', roast_date: daysAgo(90) });
const linked = coffee({ roaster: 'The Picky Chemist', coffee_name: 'El Dorado Double Ferment Gesha', status: 'open',
  roast_date: daysAgo(15) });
// 4:1, so the UI checks can see it isn't cropped (object-fit: contain). The
// worker never fetches data: URIs, so its fill is seeded below.
const WIDE = 'data:image/svg+xml,' + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="160" height="40"><rect width="160" height="40" fill="#f2c14e"/></svg>');
const wide = coffee({ roaster: 'Flower Child', coffee_name: 'Rwanda Gitega Natural', roast_date: daysAgo(9), image_url: WIDE,
  image_source_url: 'https://www.shop.flowerchildcoffee.com/products/rwanda-gitega-natural' });
db.prepare(`INSERT INTO image_fills (url, fill) VALUES (?, ?)`).run(WIDE, '#f2c14e');
// Open + linked, so "grams left" shows: "2kg (2kg left)", "999g (999g left)", "1.5kg (1.2kg left)".
const GRAMS_NAMES = {
  big: 'Ethiopia Guji Hambela Natural Bulk Bag',
  under: 'Colombia Inmaculada Sudan Rume Washed',
  part: 'Costa Rica Las Lajas Black Honey Catuai'
};
const grams = {
  big: coffee({ roaster: 'Black & White Coffee Roasters', coffee_name: GRAMS_NAMES.big, status: 'open', amount_g: 2000 }),
  under: coffee({ roaster: 'Prodigal Coffee', coffee_name: GRAMS_NAMES.under, status: 'open', amount_g: 999 }),
  part: coffee({ roaster: 'Passenger Coffee', coffee_name: GRAMS_NAMES.part, status: 'open', amount_g: 1500 })
};

const longPlan = createSubscription(db, { roaster_service: 'A Very Long Subscription Service Name That Keeps Going', subscription_name:
  'Explorer Series: Two Rotating Single Origins Every Other Week', price: 44.5, bag_count: 2, amount_per_bag_g: 250, renewal_day: 15,
  subscription_url: 'https://www.averylongsubscriptionservice.example.com/pages/subscriptions/explorer-series-two-rotating-single-origins' });
createSubscription(db, { roaster_service: 'Ceto', subscription_name: 'Paused Monthly', price: 22, bag_count: 1, amount_per_bag_g: 250,
  renewal_day: 9, subscription_url: 'https://ceto.coffee/products/subscription', paused: 1 });
const seyPlan = createSubscription(db, { roaster_service: 'Sey', subscription_name: null, price: 30, bag_count: 1, amount_per_bag_g: 250,
  renewal_day: 1 });
const link = db.prepare(`UPDATE coffees SET subscription_id = ? WHERE id = ?`);
link.run(seyPlan, sey.id);
link.run(longPlan, long.id);

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
for (const [key, c] of Object.entries(grams)) {
  bean.run(`bean-${key}`, GRAMS_NAMES[key as keyof typeof grams], null, daysAgo(10), null, null, 0, isoDaysAgo(9), now);
  db.prepare(`UPDATE beanconqueror_beans SET coffee_id = ? WHERE id = ?`).run(c.id, `bean-${key}`);
}
db.prepare(
  `INSERT INTO beanconqueror_bean_origins (bean_id, component_number, country, processing) VALUES (?, 1, ?, ?)`
).run('bean-long', 'Colombia', 'Double Anaerobic Thermal Shock Natural');
db.prepare(`INSERT INTO beanconqueror_methods (id, preparation_method, name, imported_at) VALUES ('m1', 'V60', 'V60', ?)`).run(now);
db.prepare(`UPDATE beanconqueror_methods SET preparation_style = 'POUR OVER' WHERE id = 'm1'`).run();
db.prepare(`INSERT INTO beanconqueror_methods (id, preparation_method, name, preparation_style, imported_at)
  VALUES ('m2', 'CUSTOM_PREPARATION', 'OXO Rapid Brewer - Long Soup', 'ESPRESSO', ?)`).run(now);
db.prepare(`INSERT INTO beanconqueror_grinders (id, name, imported_at) VALUES ('g1', 'ZP6 Special', ?)`).run(now);
const brew = db.prepare(
  `INSERT INTO beanconqueror_brews (bc_created_at, bean_id, preparation_id, mill_id, ground_coffee_g, brew_temperature,
     water_amount_g, rating, bean_age_days, imported_at) VALUES (?, ?, 'm1', 'g1', 15, 93, 250, ?, ?, ?)`
);
for (let i = 0; i < 8; i++) brew.run(isoDaysAgo(i + 1), 'bean-linked', 6 + (i % 4), 14 - i, now);
for (let i = 0; i < 3; i++) brew.run(isoDaysAgo(i + 2), 'bean-twin-1', 7, 18 + i, now);
for (let i = 0; i < 2; i++) brew.run(isoDaysAgo(i + 1), 'bean-likely', 8, 7 + i, now);
// Ratings 7-10 (one 10); the first brew is at 05:40 and the second at 23:10 local, for the clock records.
// bc_created_at is read as wall time (its digits), so write the clock time as-is, whatever the machine's zone.
const atLocal = (n: number, h: number, m: number) => `${daysAgo(n)}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00.000Z`;
for (let i = 0; i < 20; i++) {
  brew.run(i === 0 ? atLocal(1, 5, 40) : i === 1 ? atLocal(2, 23, 10) : isoDaysAgo(i + 1), 'bean-part', i === 2 ? 10 : 7 + (i % 3), 9, now);
} // 20 × 15g = 300g, plus 60g of soup below; brews 1-24 then get flow-brew dose/water (~378g), see the recipes seed
// Soup: 3 brews of 20g in 100g water.
const soup = db.prepare(
  `INSERT INTO beanconqueror_brews (bc_created_at, bean_id, preparation_id, mill_id, ground_coffee_g, brew_temperature,
     water_amount_g, rating, imported_at) VALUES (?, 'bean-part', 'm2', 'g1', 20, 93, 100, 8, ?)`
);
for (let i = 0; i < 3; i++) soup.run(isoDaysAgo(i + 1), now);
// One decaf brew, through a bean linked to the decaf coffee.
bean.run('bean-decaf-linked', 'Swiss Water Decaf Colombia Huila', 'Onyx', daysAgo(5), 250, 22, 1, isoDaysAgo(4), now);
db.prepare(`UPDATE beanconqueror_beans SET coffee_id = ? WHERE id = 'bean-decaf-linked'`).run(decaf.id);
brew.run(isoDaysAgo(3), 'bean-decaf-linked', 8, 2, now);
// Insights tab: 3 coffees bought twice (6 archived bags), 6 days each, two cups a day, 25-60 days ago
// (72 brews), with planted effects: second cup +0.5, noted brews −0.15 (too early to tell), second bag of a pair higher,
// Origami days swing ±1.5 (the wildcard, solid over the 2 drippers compared). First cups before 9 am.
db.prepare(`INSERT INTO beanconqueror_methods (id, preparation_method, name, preparation_style, imported_at)
  VALUES ('m3', 'ORIGAMI', 'Origami', 'POUR OVER', ?)`).run(now);
const timed = db.prepare(
  `INSERT INTO beanconqueror_brews (bc_created_at, bean_id, preparation_id, mill_id, ground_coffee_g, brew_temperature,
     water_amount_g, rating, notes, imported_at) VALUES (?, ?, ?, 'g1', 15, 93, 250, ?, ?, ?)`
);
const PAIRS = [['Kurasu', 'Kenya Gichathaini AA', 'Kenya'], ['Luna', 'Ethiopia Hambela Alaka', 'Ethiopia'], ['Rogue Wave', 'Colombia La Palma Skipper', 'Colombia']];
// "Skipper": a keyword-colored coffee name (src/lib/nameColor.ts), checked by the `skip-name-color` tests.

// A1 B1 C1 A2 B2 C2: with the Origami swings, second bags rate 0.5, 0.6 and 0.8 above their first.
const BASE = [7.0, 6.8, 7.2, 8.5, 6.4, 8.5];
const ROAST = [7, 12, 9, 15, 10, 13]; // days roasted before the bag's first brew, so rest days vary
let skipSlug = '';
for (let k = 0; k < 6; k++) {
  const [roaster, name, origin] = PAIRS[k % 3];
  const first = 60 - k * 6;
  const c = coffee({ roaster, coffee_name: name, origin, status: 'archive', roast_date: daysAgo(first + ROAST[k]) });
  if (k === 2) skipSlug = c.slug;
  bean.run(`bean-hl-${k}`, name, roaster, daysAgo(first + ROAST[k]), 250, 22, 0, isoDaysAgo(first), now);
  db.prepare(`UPDATE beanconqueror_beans SET coffee_id = ? WHERE id = ?`).run(c.id, `bean-hl-${k}`);
  for (let j = 0; j < 6; j++) {
    const origami = j % 2 === 1, swing = origami ? ((j + k) % 4 === 1 ? 1.5 : -1.5) : 0;
    for (const cup of [0, 1]) {
      const noted = (j + cup) % 2 === 0;
      const rating = Math.min(9.9, +(BASE[k] + 0.5 * cup - (noted ? 0.15 : 0) + swing).toFixed(2)); // no seeded 10s
      timed.run(cup ? atLocal(first - j, 14, 10) : atLocal(first - j, 8, 20), `bean-hl-${k}`, origami ? 'm3' : 'm1', rating,
        noted ? 'A touch sour' : null, now);
    }
  }
}
// A small origin for the zoomed-map checks (insights-map-zoom-tip): Rwanda, two brews (Medium: outside the Washed · Light filter insights-leaderboards-cut expects empty).
{
  const c = coffee({ roaster: 'Flower Child', coffee_name: 'Rwanda Nyamasheke Washed', origin: 'Rwanda', roast_level: 'Medium', status: 'archive', roast_date: daysAgo(80) });
  bean.run('bean-rw', 'Rwanda Nyamasheke Washed', 'Flower Child', daysAgo(80), 250, 22, 0, isoDaysAgo(70), now);
  db.prepare(`UPDATE beanconqueror_beans SET coffee_id = ? WHERE id = ?`).run(c.id, 'bean-rw');
  for (const d of [70, 69]) timed.run(atLocal(d, 8, 20), 'bean-rw', 'm1', 7.5, null, now);
}
// Brewing lab: 8 archived bags × 32 rated brews, one a day from 132 − 10k days ago (all after the
// 2026-06-01 Current-ratings cutoff, spread over 3+ months for the eras charts), every lab variable
// varied so each chart has solid bands (≥ 3 paired bags, ≥ 30 brews) and pale ones (95+ °C, ZP6, brew #1–9).
// Planted: 91–92 °C +0.4 vs the same bag, Lab Water B +0.3, Origami −0.3. 4 Light + 4 Ultralight,
// Natural / Washed alternating, 2 origins and 2 roasters: every breakdown has rows of ≥ 3 bags.
db.prepare(`INSERT INTO beanconqueror_grinders (id, name, imported_at) VALUES ('g2', 'A4Z (Femobook)', ?)`).run(now);
const water = db.prepare(`INSERT INTO beanconqueror_waters (id, name, calcium, magnesium, sodium, potassium, chloride, sulfate, imported_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`);
// GH (2.497 Ca + 4.118 Mg): A 74 ppm (60–90), B 124 ppm (90+), C 26 ppm (0–30): three GH bands. Ca/K
// stay non-zero on enough recipes (Mg:Ca: A, C; Mg:K: A, B) for the ratio cards to have 2+ values.
water.run('w1', 'Lab Water A', 10, 12, 0, 8, 30, 20, now);
water.run('w2', 'Lab Water B', 0, 30, 0, 6, 40, 10, now);
water.run('w3', 'Lab Water C', 4, 4, 5, 0, 25, 30, now);
const method = db.prepare(`INSERT INTO beanconqueror_methods (id, preparation_method, name, preparation_style, imported_at)
  VALUES (?, 'CUSTOM_PREPARATION', ?, 'POUR OVER', ?)`);
method.run('m4', 'V60 - Cafec Abaca', now);
method.run('m5', 'V60 - Sibarist Fast', now);
method.run('m6', 'Origami - Cafec Abaca', now);
// Four more drippers (used by 8 extra brews on the last lab bag, below): the Dripper board has 6 groups, so its Show all appears.
['Kalita', 'Chemex', 'Clever', 'Switch'].forEach((d, i) => method.run(`m${7 + i}`, `${d} - Cafec Abaca`, now));
// Switch (m10) is archived in Bean Conqueror: the Gear trophy case's Retired shelf.
db.prepare(`UPDATE beanconqueror_methods SET bc_archived = 1 WHERE id = 'm10'`).run();
const labBrew = db.prepare(
  `INSERT INTO beanconqueror_brews (bc_created_at, bean_id, preparation_id, mill_id, water_id, ground_coffee_g, brew_temperature,
     water_amount_g, brew_time, bloom_time, grind_setting, rating, imported_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
);
const LAB = [['Light', 'Natural'], ['Light', 'Washed'], ['Ultralight', 'Natural'], ['Ultralight', 'Washed']] as const;
const TEMPS = [91, 92, 94, 88], DOSES = [15, 17, 19], WATERS = ['w1', 'w2', 'w3'], METHODS = ['m4', 'm5', 'm6'];
const TIMES = ['150', '180', '210', '240'], BLOOMS = ['30', '45'];
const labSlugs: string[] = [];
for (let k = 0; k < 8; k++) {
  const [roast_level, processing] = LAB[k % 4];
  const first = 132 - 10 * k;
  const name = `Lab Bag ${k + 1}`;
  const c = coffee({ roaster: k < 4 ? 'Lab Roasters' : 'Other Lab', coffee_name: name, roast_level, processing,
    origin: k % 2 ? 'Kenya' : 'Ethiopia', status: 'archive', roast_date: daysAgo(first + 10) });
  labSlugs.push(c.slug);
  bean.run(`bean-lab-${k}`, name, 'Lab', daysAgo(first + 10), 250, 22, 0, isoDaysAgo(first), now);
  db.prepare(`UPDATE beanconqueror_beans SET coffee_id = ? WHERE id = ?`).run(c.id, `bean-lab-${k}`);
  // Origin details for the Varieties / Producers boards: Lab Farmer A..C own two bags each, D one, Solo (k=7) one no other
  // bag has; Kenya (odd k) regions include a 40+ character top level for the tip's ellipsis.
  db.prepare(`UPDATE coffees SET producer = ?, variety = ?, region = ? WHERE id = ?`).run(
    k === 7 ? 'Lab Farmer Solo' : `Lab Farmer ${'ABCD'[k >> 1]}`, k < 4 ? 'SL28, SL34' : 'Batian',
    k === 7 ? "Kangema, Murang'a Highlands Smallholder Cooperative Zone" : k % 2 ? 'Nyeri' : 'Guji', c.id);
  for (let j = 0; j < 32; j++) {
    const temp = k < 2 && j === 31 ? 96 : TEMPS[j % 4];
    const dose = DOSES[j % 3], w = WATERS[(j + k) % 3], m = METHODS[(j + 2 * k) % 3], zp6 = k === 7 && j % 4 === 0;
    const rating = 7 + (k % 3) * 0.3 + (temp === 91 || temp === 92 ? 0.4 : 0) + (w === 'w2' ? 0.3 : 0) - (m === 'm6' ? 0.3 : 0) + ((j * 7) % 5) * 0.1 - 0.2;
    labBrew.run(atLocal(first - j, 8, 15), `bean-lab-${k}`, m, zp6 ? 'g1' : 'g2', w, dose, temp, dose * (15 + ((j >> 1) % 4)),
      TIMES[(j >> 2) % 4], BLOOMS[j % 2], zp6 ? String(5 + (j % 3) * 0.5) : `1.${6 - Math.floor(j / 8)}.0`, +Math.min(9.9, rating).toFixed(1), now);
  }
}
for (let j = 32; j < 40; j++) // after the bag's 32 brews (the last four a month before: each new dripper has a gap), on the water it already uses
  labBrew.run(atLocal(132 - 70 - j + (j >= 36 ? 28 : 0), 9, 15), 'bean-lab-7', `m${7 + (j % 4)}`, 'g2', WATERS[j % 3], 15, 92, 240, '150', '30', '1.4.0', 6.4 + 0.5 * (j % 4), now);
// Like-with-like dial-in (Part 4): 18 archived bags, 7 rated brews each, daily from `first` days ago. Two roasters
// × two (roast, process) groups, 9 bags each. Only Light / Ultralight: the mixed-roast nudge needs exactly two levels. Ultralight / Washed bags are right on brew 1; Light / Natural bags (same average, so the mixed-roast nudge stays hidden) start
// low (three 5s) and settle on brew 4, so dial-in by roast and by process both show a spread and some bags are
// rescued. Slow bags brew on the Origami (their swings widen it, keeping the wildcard finding solid), fast ones on
// the V60 (flat ratings). 'Dial Co' rates 1 point above 'Cup Co' everywhere, so likeRoaster has a gap to find.
for (let k = 0; k < 18; k++) {
  const slow = k >= 9, roaster = k % 2 ? 'Cup Co' : 'Dial Co', up = roaster === 'Dial Co' ? 0.5 : -0.5;
  const [roast_level, processing] = slow ? (['Light', 'Natural'] as const) : (['Ultralight', 'Washed'] as const);
  const first = 100 - 5 * k, name = `Dial Bag ${k + 1}`;
  const c = coffee({ roaster, coffee_name: name, roast_level, processing, origin: 'Ethiopia', status: 'archive', roast_date: daysAgo(first + 10) });
  bean.run(`bean-dial-${k}`, name, roaster, daysAgo(first + 10), 250, 22, 0, isoDaysAgo(first), now);
  db.prepare(`UPDATE beanconqueror_beans SET coffee_id = ? WHERE id = ?`).run(c.id, `bean-dial-${k}`);
  db.prepare(`UPDATE coffees SET producer = ?, variety = ?, region = ? WHERE id = ?`).run(
    ['Tamiru Tadesse Tesema', 'Ture Waji', 'Haider Aba Mecha'][k % 3], ['Gesha 1931', 'Landrace', 'Gesha, Pink Bourbon', '74158'][k % 4],
    ['Hambela, Guji', 'Gedeb, Gedeo', 'Sidama'][k % 3], c.id);
  for (let j = 0; j < 7; j++) timed.run(atLocal(first - j, 8, 30), `bean-dial-${k}`, slow ? 'm3' : 'm1', (slow ? (j < 3 ? 5 : 9) : 7.3) + up, null, now);
}
// Gear showcase: stored details for a dripper (many fields + photo on a backdrop) and a grinder (two fields), and a grinder
// with a 2-line name and no rated brew (one unrated brew on the unlinked decaf bean, so no coffee page's brew count moves).
const GEAR_IMG = 'data:image/svg+xml,' + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="160" height="40"><rect width="160" height="40" fill="#7fb7a4"/></svg>');
db.prepare(`INSERT INTO image_fills (url, fill) VALUES (?, ?)`).run(GEAR_IMG, '#7fb7a4');
const gearRow = db.prepare(`INSERT INTO gear_details (kind, name, fields, image_url, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`);
gearRow.run('dripper', 'V60', JSON.stringify({ brand: 'Hario', model: 'V60-02', cost: 24, website: 'https://www.hario.com/v60', shape: 'Conical',
  coneAngle: 60, material: 'Ceramic' }), GEAR_IMG, '2026-09-01T12:00:00.000Z', '2026-10-10T12:00:00.000Z');
gearRow.run('grinder', 'ZP6 Special', JSON.stringify({ brand: 'Timemore', burrSize: 64 }), null, '2026-09-02T12:00:00.000Z', '2026-09-02T12:00:00.000Z');
db.prepare(`INSERT INTO beanconqueror_grinders (id, name, imported_at) VALUES ('g3', 'Comandante C40 MK4', ?)`).run(now);
db.prepare(`INSERT INTO beanconqueror_brews (bc_created_at, bean_id, preparation_id, mill_id, ground_coffee_g, brew_temperature,
  water_amount_g, rating, imported_at) VALUES (?, 'bean-decaf', 'm1', 'g3', 15, 93, 250, NULL, ?)`).run(isoDaysAgo(3), now);
db.prepare(`INSERT INTO app_meta (key, value) VALUES ('beanconqueror_last_imported_at', ?)
  ON CONFLICT(key) DO UPDATE SET value = excluded.value`).run(now);

// Account page + recipes: 24 brews (ids 1-24) with real flows from the fixtures (10 bbs, 10 bbj, 3 4sy, 1 bbf), each with its
// fixture's logged water / dose / time so the readings are confident; one orphan flow waits for its brew ("waiting").
const fixture = (n: string) =>
  compactFlow(JSON.parse(readFileSync(new URL(`../src/lib/server/fixtures/bcflow/${n}.json`, import.meta.url), 'utf8')))!;
const LOGGED = { bbs: [295.3, 18, '117'], bbj: [244.7, 15.8, '96'], bbf: [324, 18, '130'], '4sy': [303.3, 18.1, '88'] } as const;
// ids 1-10 bbs, 11-20 bbj (each group needs MIN_GROUP = 10 brews), 21-23 4sy (the recipe's), 24 bbf (dismissed). Brews 1-24 are
// the first linked / twin / likely / Costa Rica brews, none in the Brewing lab's or Dial-in's data.
const PLAN = [...Array(10).fill('bbs'), ...Array(10).fill('bbj'), '4sy', '4sy', '4sy', 'bbf'] as ('bbs' | 'bbj' | '4sy' | 'bbf')[];
const FLOW_UUIDS = PLAN.map((_, i) => `aaaaaaaa-0000-4000-8000-${String(i + 1).padStart(12, '0')}`);
const flow = db.prepare(`INSERT INTO beanconqueror_brew_flows (bc_uuid, format, step_ms, points, weights, uploaded_at) VALUES (?, 1, ${FLOW_STEP_MS}, ?, ?, ?)`);
PLAN.forEach((tag, i) => {
  const [water, dose, time] = LOGGED[tag];
  db.prepare(`UPDATE beanconqueror_brews SET bc_uuid = ?, has_flow_profile = 1, water_amount_g = ?, ground_coffee_g = ?, brew_time = ? WHERE id = ?`)
    .run(FLOW_UUIDS[i], water, dose, time, i + 1);
  const w = fixture(tag).w;
  flow.run(FLOW_UUIDS[i], w.length, JSON.stringify(w), now);
});
// Two of the bbs brews carry the user's tag in their notes (only where the seed left them empty).
db.prepare(`UPDATE beanconqueror_brews SET notes = 'BBS.' WHERE id IN (1, 2) AND notes IS NULL`).run();
flow.run('bbbbbbbb-0000-4000-8000-000000000009', 3, '[0,1,2]', now);
db.prepare(`INSERT INTO app_meta (key, value) VALUES ('visualizer_last_upload_at', ?)`).run(now);
// Recipes: "Seed equal pours" from the 4sy readings (its 3 brews then match it), and the bbf structure dismissed.
readStale(db, -1);
const readingOf = (i: number) => JSON.parse((db.prepare(`SELECT reading FROM brew_pour_readings WHERE bc_uuid = ?`).get(FLOW_UUIDS[i]) as { reading: string }).reading) as PourReading;
const keyOf = (i: number) => (db.prepare(`SELECT structure_key k FROM brew_pour_readings WHERE bc_uuid = ?`).get(FLOW_UUIDS[i]) as { k: string }).k;
const equalDef = draftFromReadings([20, 21, 22].map(readingOf), [null, null, null]);
for (const p of equalDef.pours.slice(0, 2)) p.length = { kind: 'time', targetS: 20, maxS: 30 }; // timed steps: the cards draw bloom bands
equalDef.tempC = 93;
equalDef.notes = 'Rinse the filter';
if (equalDef.pours.length > 3) equalDef.pours[2].length = { kind: 'low' }; // a low-water step: the cards show Low with its tip
const recipeId = saveRecipe(db, { name: 'Seed equal pours', tags: [], def: equalDef });
dismissStructure(db, keyOf(23));
rematchBrews(db);
// Pours tab: two more recipes, logged by a tag in the notes of lab bags 0-5 (roast Light / process Natural, Washed / roaster
// Lab Roasters each reach 3+ bags): per bag two brews of each, high vs low agitation, in the 15-30 day rest band. A tag-logged
// brew needs no reading, so the account page's flow counts stay as they were (its "with notes only" count does not).
const baseDef = draftFromReadings([20, 21, 22].map(readingOf), [null, null, null]);
const loggedRecipe = (name: string, tag: string, agitation: 'high' | 'low') => saveRecipe(db, { name, tags: [tag], def: {
  ...baseDef, pourCount: { min: 9, max: 9 }, pours: Array.from({ length: 9 }, (_, i) => ({ ...baseDef.pours[Math.min(i, baseDef.pours.length - 1)], bloom: i === 0, agitation })) } });
const TAGS = ['seedhigh', 'seedlow'];
// Each logged brew's note also carries a flavor word (two words, 12 brews each, 6 bags): the Pours tab's Words block renders.
const NOTES = ['seedhigh bright', 'seedhigh sweet', 'seedlow bright', 'seedlow sweet'];
loggedRecipe('Seed high agitation', TAGS[0], 'high');
loggedRecipe('Seed low agitation', TAGS[1], 'low');
for (let k = 0; k < 6; k++) {
  const ids = (db.prepare(`SELECT id FROM beanconqueror_brews WHERE bean_id = ? ORDER BY bc_created_at`).all(`bean-lab-${k}`) as { id: number }[]).map((r) => r.id);
  ids.slice(10, 14).forEach((id, i) => db.prepare(`UPDATE beanconqueror_brews SET notes = ? WHERE id = ? AND notes IS NULL`).run(NOTES[i], id));
}
rematchBrews(db);

// Brew now: one coffee with two bags (clones) and 13 brews on two grinders incl. a Best brew and an isolated dripper (Origami),
// plus a coffee from a roaster nobody has brewed.
const BN = { roaster: 'Brew Roasters', coffee_name: 'Brew Seed Ethiopia Guji', origin: 'Ethiopia', processing: 'Natural' };
const bnBags = [coffee({ ...BN, status: 'open', roast_date: daysAgo(25) }), coffee({ ...BN, status: 'open', roast_date: daysAgo(12) })];
bnBags.forEach((c, i) => {
  bean.run(`bean-bn-${i}`, BN.coffee_name, BN.roaster, daysAgo(i ? 12 : 25), 250, 22, 0, isoDaysAgo(i ? 11 : 24), now);
  db.prepare(`UPDATE beanconqueror_beans SET coffee_id = ? WHERE id = ?`).run(c.id, `bean-bn-${i}`);
});
const bnBrew = db.prepare(`INSERT INTO beanconqueror_brews (bc_created_at, bean_id, preparation_id, mill_id, grind_setting, ground_coffee_g,
  brew_temperature, water_amount_g, rating, best_brew, notes, imported_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
for (let j = 0; j < 6; j++) // bag 1 on the ZP6: finer each brew, ratings rise
  bnBrew.run(atLocal(24 - j, 8, 5), 'bean-bn-0', 'm1', 'g1', String(6 - Math.floor(j / 2) * 0.5), 15, 93, 250, 6 + j * 0.5, 0, null, now);
for (let j = 0; j < 4; j++) // bag 2 on the A4Z
  bnBrew.run(atLocal(11 - j, 8, 10), 'bean-bn-1', 'm4', 'g2', `1.${Math.max(5 - j, 3)}.0`, 18, 92, 270, 7 + j * 0.4, j === 3 ? 1 : 0, j === 3 ? 'Try a touch finer next' : null, now);
for (let j = 0; j < 3; j++) // Origami brews (no gear_details row, so isolated)
  bnBrew.run(atLocal(6 - j, 9, 0), 'bean-bn-1', 'm3', 'g2', '1.3.0', 15, 90, 250, 7.5 - j * 0.5, 0, null, now);
// One unrated brew with a second filter on the Origami (brew-now-filter-keeps-dripper picks it: filters follow the dripper).
db.prepare(`INSERT INTO beanconqueror_methods (id, preparation_method, name, preparation_style, imported_at)
  VALUES ('m12', 'CUSTOM_PREPARATION', 'Origami - Sibarist Fast', 'POUR OVER', ?)`).run(now);
bnBrew.run(atLocal(9, 9, 30), 'bean-bn-1', 'm12', 'g2', '1.3.0', 15, 90, 250, null, 0, null, now);
// A third grinder with a brew on a linked bag but no grind setting: pickable, with no grind data.
bnBrew.run(atLocal(2, 8, 0), 'bean-bn-1', 'm4', 'g3', null, 15, 93, 250, 7, 0, null, now);
// Brew now marks on bag 2: one linked to the first Origami brew (grind and temp changed), one pending after the last brew.
const bnMark = db.prepare(`INSERT INTO brew_now_marks (coffee_id, marked_at, marked_local, grinder, dripper, filter, suggestion, brew_id, status)
  VALUES (?, ?, ?, 'A4Z (Femobook)', 'Origami', NULL, ?, ?, ?)`);
const gabi = db.prepare(`SELECT id, bc_created_at FROM beanconqueror_brews WHERE preparation_id = 'm3' AND mill_id = 'g2' AND bean_id = 'bean-bn-1' ORDER BY bc_created_at LIMIT 1`).get() as { id: number; bc_created_at: string };
const bnSug = (grind: string, temp: string) => JSON.stringify({ grind, temp: `${temp} °C`, dose: '15 g', recipe: null, water: null });
bnMark.run(bnBags[1].id, now, atLocal(7, 8, 0).slice(0, 16), bnSug('1.4.0', '93'), gabi.id, 'linked');
bnMark.run(bnBags[1].id, now, atLocal(1, 8, 0).slice(0, 16), bnSug('1.2.0', '92'), null, 'pending');
const bnNew = coffee({ roaster: 'Nobody Brewed Roasters', coffee_name: 'Brew Seed Fresh Lot', origin: 'Kenya', processing: 'Washed', status: 'backlog' });
// Origin details on this one bag (others have none); one long value must wrap inside its stat and field.
db.prepare(`UPDATE coffees SET producer = ?, farm = ?, variety = ?, region = ?, elevation = ?, harvest_time = ?, certification = ? WHERE id = ?`).run(
  'Ana Maria Gutierrez', 'Finca La Esperanza de los Altos de Huila, Cooperativa Norte', 'SL28, SL34', 'Nyeri', '1900-2100m', 'Nov 2025', 'Organic', bnNew.id);
// A stored roaster recipe (long unbroken title and snippet) for the never-brewed roaster.
db.prepare(`INSERT INTO roaster_recipes (roaster, url, title, snippet, searched_at) VALUES (?, ?, ?, ?, ?)`).run(
  'Nobody Brewed Roasters', 'https://example.com/brew-guide', 'Brew guide: ' + 'Pour-over-recipe-with-a-very-long-title-'.repeat(3),
  '15 g coffee to 250 g water at 93 C. ' + 'Pour in three stages, then swirl and let it drain. '.repeat(5).slice(0, 240), now);

writeFileSync('.ui-test/seed.json', JSON.stringify({
  slugs: { long: long.slug, linked: linked.slug, frozen: frozen.slug, wide: wide.slug, decaf: decaf.slug, lab: labSlugs[0], labTwo: labSlugs[7], sey: sey.slug, brew: bnBags[1].slug, brewNew: bnNew.slug, big: grams.big.slug,
    under: grams.under.slug, part: grams.part.slug, skip: skipSlug },
  recipes: { bbsKey: keyOf(0), bbjKey: keyOf(10), bbfKey: keyOf(23), recipeId },
  names: { long: LONG_NAME, everyAction: 'Ethiopia Bensa Bombe', ...GRAMS_NAMES }
}));
db.close();
console.log(`ui-seed: wrote ${path}`);
