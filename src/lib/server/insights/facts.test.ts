import { describe, it, expect } from 'vitest';
import { setBrewingZone } from '$lib/localDate';
import { parseMethod, normalizeRoastLevel, restDays, costPerBrew, seconds, loadFacts, brewerType, grindKey, grindValue, MIXED_FILTER, waitBucket, windowState } from './facts';
import { createDb } from '$lib/server/db';
import { createCoffee } from '$lib/server/coffees';
import { createSubscription } from '$lib/server/subscriptions';

// [name, preparation_tools, dripper, filter]: every prod method on 2026-10-09.
const METHODS: [string, string, string, string][] = [
  ['Alpha Switch - Cafec Abaca', 'Cafec Abaca filters', 'Alpha Switch', 'Cafec Abaca'],
  ['Alpha Switch - Cafec T90', 'Cafec T90 filters', 'Alpha Switch', 'Cafec T90'],
  ['Alpha Switch - Sibarist Fast', 'Sibarist Fast filters', 'Alpha Switch', 'Sibarist Fast'],
  ['Alpha Tritan - Cafec Abaca', 'Cafec Abaca filters', 'Alpha Tritan', 'Cafec Abaca'],
  ['CT62 - Cafec Abaca', 'Cafec Abaca filters', 'CT62', 'Cafec Abaca'],
  ['Gabi Master A', 'Kalita Wave 155 filters', 'Gabi Master A', '155 (mixed)'],
  ['Graycano - Cafec Abaca', 'Cafec Abaca filters', 'Graycano', 'Cafec Abaca'],
  ['Graycano - Sibarist Fast', 'Sibarist Fast filters', 'Graycano', 'Sibarist Fast'],
  ['MK PRO V - Cafec Abaca', 'Cafec Abaca filters', 'MK PRO V', 'Cafec Abaca'],
  ['MK PRO V - Cafec T90', 'Cafec T90 filters', 'MK PRO V', 'Cafec T90'],
  ['MK PRO V - Sibarist Fast', 'Sibarist Fast filters', 'MK PRO V', 'Sibarist Fast'],
  ['OXO Rapid Brewer - Long Soup', '', 'OXO Rapid Brewer', 'Long Soup'],
  ['Origami - Cafec Abaca', 'Cafec Abaca filters', 'Origami', 'Cafec Abaca'],
  ['Origami - XBloom 155', 'XBloom 155 filters', 'Origami', 'XBloom 155'],
  ['V60 - Cafec Abaca', 'Cafec Abaca', 'V60', 'Cafec Abaca'],
  ['V60 - Cafec T90', 'Cafec T90 filters', 'V60', 'Cafec T90'],
  ['V60 - Sibarist Fast', 'Sibarist Fast filters', 'V60', 'Sibarist Fast'],
  ['V60 Kasuya - Cafec Abaca', 'Cafec Abaca filters', 'V60 Kasuya', 'Cafec Abaca'],
  ['V60 Kasuya - Sibarist Fast', 'Sibarist Fast filters', 'V60 Kasuya', 'Sibarist Fast'],
  ['V60 Neo - Cafec Abaca', 'Cafec Abaca filters', 'V60 Neo', 'Cafec Abaca'],
  ['V60 Neo - Cafec T90', 'Cafec T90 filters', 'V60 Neo', 'Cafec T90'],
  ['V60 Neo - Sibarist Fast', 'Sibarist Fast filters', 'V60 Neo', 'Sibarist Fast']
];

describe('parseMethod', () => {
  it('covers all 22 prod methods', () => expect(METHODS).toHaveLength(22));
  it.each(METHODS)('%s', (name, tools, dripper, filter) => expect(parseMethod(name, tools)).toEqual({ dripper, filter }));
  it('Gabi Master A is the mixed 155 filter', () => expect(parseMethod('Gabi Master A', null).filter).toBe(MIXED_FILTER));
  it('no " - ": filter from the tools, minus " filters"', () =>
    expect(parseMethod('Kalita Wave', 'Kalita Wave 185 filters')).toEqual({ dripper: 'Kalita Wave', filter: 'Kalita Wave 185' }));
  it('no " - " and no tools: no filter', () => expect(parseMethod('Aeropress', null)).toEqual({ dripper: 'Aeropress', filter: null }));
  it('no method', () => expect(parseMethod(null, null)).toEqual({ dripper: null, filter: null }));
});

describe('normalizeRoastLevel', () => {
  it('maps the short spellings', () => {
    expect(normalizeRoastLevel('Light/Med')).toBe('Light/Medium');
    expect(normalizeRoastLevel('Med/Light')).toBe('Medium/Light');
  });
  it('keeps the rest', () => {
    expect(normalizeRoastLevel('Nordic Light')).toBe('Nordic Light');
    expect(normalizeRoastLevel(null)).toBeNull();
  });
});

describe('restDays', () => {
  it('roast date to brew', () => expect(restDays('2026-09-01', null, null, '2026-09-21')).toBe(20));
  it('minus a finished freeze', () => expect(restDays('2026-09-01', '2026-09-05', '2026-09-15', '2026-09-21')).toBe(10));
  it('an open freeze runs to the brew', () => expect(restDays('2026-09-01', '2026-09-10', null, '2026-09-21')).toBe(9));
  it('a freeze ending after the brew counts up to the brew', () =>
    expect(restDays('2026-09-01', '2026-09-10', '2026-09-30', '2026-09-21')).toBe(9));
  it('a freeze after the brew is ignored', () => expect(restDays('2026-09-01', '2026-09-25', null, '2026-09-21')).toBe(20));
  it('no roast date', () => expect(restDays(null, null, null, '2026-09-21')).toBeNull());
});

describe('costPerBrew', () => {
  it('dose × cost per gram', () => expect(costPerBrew(15, 30, 250)).toBeCloseTo(1.8));
  it('null without a usable cost, amount or dose', () => {
    expect(costPerBrew(15, 0, 250)).toBeNull();
    expect(costPerBrew(15, null, 250)).toBeNull();
    expect(costPerBrew(15, 30, null)).toBeNull();
    expect(costPerBrew(15, 30, 0)).toBeNull();
    expect(costPerBrew(null, 30, 250)).toBeNull();
  });
});

describe('seconds', () => {
  it('reads Bean Conqueror text seconds; 0 means not entered', () => {
    expect(seconds('100')).toBe(100);
    expect(seconds('0')).toBeNull();
    expect(seconds('')).toBeNull();
    expect(seconds(null)).toBeNull();
    expect(seconds('abc')).toBeNull();
  });
});

describe('brewerType', () => {
  it('maps Bean Conqueror styles', () => {
    expect(brewerType('V60 - Cafec Abaca', 'POUR OVER')).toBe('pourover');
    expect(brewerType('Decent', 'ESPRESSO')).toBe('espresso');
    expect(brewerType('Clever', 'FULL IMMERSION')).toBe('immersion');
    expect(brewerType('Mystery', null)).toBe('other');
  });
  it('OXO Rapid Brewer (and ORB) is soup, whatever its style', () => {
    expect(brewerType('OXO Rapid Brewer - Long Soup', 'ESPRESSO')).toBe('soup');
    expect(brewerType('OXO Rapid Brewer - Zuppa Lunga', 'ESPRESSO')).toBe('soup'); // its old name
    expect(brewerType('My ORB', 'ESPRESSO')).toBe('soup');
    expect(brewerType('Orbit dripper', 'POUR OVER')).toBe('pourover');
  });
});

describe('grindKey', () => {
  it('parses dotted settings, rejects malformed ones', () => {
    expect(grindKey('2.4.1')).toEqual([2, 4, 1]);
    expect(grindKey('5.5')).toEqual([5, 5]);
    expect(grindKey('1..5.0')).toBeNull();
    expect(grindKey('')).toBeNull();
    expect(grindKey(null)).toBeNull();
  });
  it('grindValue orders like the setting', () => {
    expect(grindValue('2.4.1')).toBeCloseTo(2.004001, 9);
    expect(grindValue('1.10')!).toBeGreaterThan(grindValue('1.5')!);
    expect(grindValue('1..5')).toBeNull();
  });
});

describe('loadFacts', () => {
  it('loads a bag\'s subscription link, null when unlinked', () => {
    const db = createDb(':memory:');
    setBrewingZone('America/Denver'); // createDb pins UTC for an empty db
    const planId = createSubscription(db, {
      roaster_service: 'S', subscription_name: null, price: 20, bag_count: 1, amount_per_bag_g: 250, renewal_day: 1
    });
    const ins = db.prepare(`INSERT INTO coffees (roaster, coffee_name, slug, subscription_id, created_at, updated_at) VALUES ('R', ?, ?, ?, '2026-01-01', '2026-01-01')`);
    ins.run('A', 'r-a', planId);
    ins.run('B', 'r-b', null);
    expect(loadFacts(db).bags.map((b) => b.subscriptionId)).toEqual([planId, null]);
  });

  it('carries producer, variety and region on a brew and its bag', () => {
    const { db, coffeeId } = seed();
    db.prepare(`UPDATE coffees SET producer = 'Ture Waji', variety = 'Gesha, SL28', region = 'Guji' WHERE id = ?`).run(coffeeId);
    const { brews, bags } = loadFacts(db);
    const want = { producer: 'Ture Waji', variety: 'Gesha, SL28', region: 'Guji' };
    expect(brews[0]).toMatchObject(want);
    expect(bags[0]).toMatchObject(want);
  });

  function seed() {
    const db = createDb(':memory:');
    setBrewingZone('America/Denver'); // createDb pins UTC for an empty db
    const now = '2026-10-09T00:00:00.000Z';
    const { id: coffeeId } = createCoffee(db, {
      roaster: 'Sey', coffee_name: 'Kiambu', origin: 'Kenya', roast_level: 'Light/Med', processing: 'Double Ferment Washed',
      amount_g: 250, cost: 30, roast_date: '2026-06-10', frozen_start_date: null, frozen_end_date: null,
      rest_days_low: null, rest_days_high: null, image_url: null
    });
    db.prepare(`UPDATE coffees SET status = 'archive' WHERE id = ?`).run(coffeeId);
    db.prepare(`INSERT INTO beanconqueror_beans (id, name, imported_at, coffee_id) VALUES ('b1', 'Kiambu', ?, ?)`).run(now, coffeeId);
    db.prepare(`INSERT INTO beanconqueror_methods (id, name, preparation_style, preparation_tools, imported_at) VALUES ('m1', 'CT62 - Cafec Abaca', 'POUR OVER', 'Cafec Abaca filters', ?)`).run(now);
    db.prepare(
      `INSERT INTO beanconqueror_waters (id, name, calcium, magnesium, sodium, potassium, chloride, sulfate, imported_at)
       VALUES ('w1', 'Lotus - Mg/K 60/10', 0, 14.6, 0, 7.8, 42.5, 0, ?)`
    ).run(now);
    db.prepare(`INSERT INTO beanconqueror_grinders (id, name, imported_at) VALUES ('g1', 'ZP6 (1ZPresso)', ?)`).run(now);
    const brew = db.prepare(
      `INSERT INTO beanconqueror_brews (bc_created_at, bean_id, preparation_id, mill_id, water_id, water, ground_coffee_g, rating, brew_time, bloom_time, water_amount_g, grind_setting, brew_temperature, imported_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    // stored as local wall time: 23:30 on Jun 30 stays on Jun 30 (no shift)
    brew.run('2026-06-30T23:30:00.000Z', 'b1', 'm1', 'g1', 'w1', 'Lotus - Mg/K 60/10', 15, 8.5, '100', '0', 250, '2.4.1', 92, now);
    brew.run('2026-07-03T15:00:00.000Z', 'b1', 'm1', null, null, null, 16, null, null, null, 0, null, 0, now);
    // a brew of an unlinked bean (no bean row at all)
    brew.run('2026-07-02T15:00:00.000Z', null, null, null, null, null, 14, 7, null, null, null, null, null, now);
    return { db, coffeeId };
  }

  it('flags whole-hour brews as back-filled', () => {
    const { brews } = loadFacts(seed().db);
    expect(brews.map((b) => b.backfilled)).toEqual([false, true, true]);
  });

  it('derives every brew field', () => {
    const { db, coffeeId } = seed();
    const { brews } = loadFacts(db);
    expect(brews.map((b) => b.localDate)).toEqual(['2026-06-30', '2026-07-02', '2026-07-03']);
    expect(brews[0]).toMatchObject({
      coffeeId, localTime: '2026-06-30T23:30', dose: 15, rating: 8.5, roaster: 'Sey', origin: 'Kenya',
      processGroup: 'Extended Ferment Washed', roastLevel: 'Light/Medium', decaf: false, dripper: 'CT62',
      filter: 'Cafec Abaca', grinder: 'ZP6 (1ZPresso)', water: 'Lotus - Mg/K 60/10', restDays: 20, brewTimeSeconds: 100, bloomSeconds: null
    });
    expect(brews[0].costPerBrew).toBeCloseTo(1.8);
    expect(brews[0].waterProfile).toMatchObject({ magnesium: 14.6, potassium: 7.8 });
    expect(brews[0].waterProfile!.gh).toBeCloseTo(60, 0);
    expect(brews[0].waterProfile!.kh).toBeCloseTo(10, 0);
    expect(brews[2].waterProfile).toBeNull();
    expect(brews[2].grinder).toBeNull();
  });

  it('loads brewer, type, water, ratio and grind', () => {
    const [a, b] = loadFacts(seed().db).brews;
    expect(a).toMatchObject({ brewer: 'CT62 - Cafec Abaca', brewerType: 'pourover', waterG: 250, grind: '2.4.1' });
    expect(a.ratio).toBeCloseTo(250 / a.dose!);
    expect(b).toMatchObject({ waterG: null, ratio: null, grind: null });
  });

  it('keeps a brew with no linked coffee, with null coffee fields', () => {
    const { brews } = loadFacts(seed().db);
    expect(brews[1]).toMatchObject({
      coffeeId: null, dose: 14, rating: 7, roaster: null, processGroup: 'Other / Unknown', restDays: null, costPerBrew: null, dripper: null
    });
  });

  it('bags carry purchase date and first/last brew', () => {
    const { db, coffeeId } = seed();
    const bag = loadFacts(db).bags.find((b) => b.id === coffeeId);
    expect(bag).toMatchObject({
      status: 'archive', purchaseDate: '2026-06-10', cost: 30, amountG: 250, processGroup: 'Extended Ferment Washed',
      roastLevel: 'Light/Medium', firstBrew: '2026-06-30', lastBrew: '2026-07-03', name: 'Kiambu', processing: 'Double Ferment Washed'
    });
    expect(bag!.slug).toEqual(expect.any(String));
    expect(bag).toMatchObject({ restLow: null, restHigh: null });
  });

  it('bags carry the rest window', () => {
    const { db, coffeeId } = seed();
    db.prepare(`UPDATE coffees SET rest_days_low = 7, rest_days_high = 21 WHERE id = ?`).run(coffeeId);
    expect(loadFacts(db).bags.find((b) => b.id === coffeeId)).toMatchObject({ restLow: 7, restHigh: 21 });
  });

  it('tempC: brew_temperature, 0 = not entered', () => {
    const [a, b, c] = loadFacts(seed().db).brews;
    expect(a.tempC).toBe(92);
    expect([b.tempC, c.tempC]).toEqual([null, null]);
  });
  it('hasNote, brewIndex and bagRating', () => {
    const { db, coffeeId } = seed();
    db.prepare(`UPDATE beanconqueror_brews SET notes = '  ' WHERE bc_created_at LIKE '2026-06-30%'`).run();
    db.prepare(`UPDATE beanconqueror_brews SET notes = 'bright' WHERE bc_created_at LIKE '2026-07-03%'`).run();
    let { brews, bags } = loadFacts(db);
    expect(brews.map((b) => b.hasNote)).toEqual([false, false, true]);
    expect(brews.map((b) => b.brewIndex)).toEqual([1, 0, 2]); // the unlinked brew is 0
    expect(bags.find((b) => b.id === coffeeId)!.bagRating).toBeNull();
    db.prepare(`UPDATE beanconqueror_beans SET rating = 0`).run();
    expect(loadFacts(db).bags.find((b) => b.id === coffeeId)!.bagRating).toBeNull();
    db.prepare(`UPDATE beanconqueror_beans SET rating = 4.5`).run();
    ({ brews, bags } = loadFacts(db));
    expect(bags.find((b) => b.id === coffeeId)!.bagRating).toBe(4.5);
  });

  it('an empty database has no facts', () => expect(loadFacts(createDb(':memory:'))).toEqual({ brews: [], bags: [] }));
});

describe('waitBucket / windowState', () => {
  it('bucket edges', () => {
    expect([14, 15, 30, 31, 90, 91, 0].map(waitBucket)).toEqual([0, 1, 1, 2, 3, 4, 0]);
    expect([-2, null].map(waitBucket)).toEqual([null, null]);
  });
  it('window state', () => {
    expect([3, 7, 21, 22].map((d) => windowState(d, 7, 21))).toEqual(['before', 'in', 'in', 'past']);
    expect([windowState(null, 7, 21), windowState(5, null, 21), windowState(5, 7, undefined)]).toEqual(['none', 'none', 'none']);
  });
});
