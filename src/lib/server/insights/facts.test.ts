import { describe, it, expect } from 'vitest';
import { parseMethod, normalizeRoastLevel, restDays, costPerBrew, seconds, loadFacts, MIXED_FILTER } from './facts';
import { createDb } from '$lib/server/db';
import { createCoffee } from '$lib/server/coffees';

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
  ['OXO Rapid Brewer - Zuppa Lunga', '', 'OXO Rapid Brewer', 'Zuppa Lunga'],
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

describe('loadFacts', () => {
  function seed() {
    const db = createDb(':memory:');
    const now = '2026-10-09T00:00:00.000Z';
    const { id: coffeeId } = createCoffee(db, {
      roaster: 'Sey', coffee_name: 'Kiambu', origin: 'Kenya', roast_level: 'Light/Med', processing: 'Double Ferment Washed',
      amount_g: 250, cost: 30, roast_date: '2026-06-10', frozen_start_date: null, frozen_end_date: null,
      rest_days_low: null, rest_days_high: null, image_url: null
    });
    db.prepare(`UPDATE coffees SET status = 'archive' WHERE id = ?`).run(coffeeId);
    db.prepare(`INSERT INTO beanconqueror_beans (id, name, imported_at, coffee_id) VALUES ('b1', 'Kiambu', ?, ?)`).run(now, coffeeId);
    db.prepare(`INSERT INTO beanconqueror_methods (id, name, preparation_tools, imported_at) VALUES ('m1', 'CT62 - Cafec Abaca', 'Cafec Abaca filters', ?)`).run(now);
    db.prepare(
      `INSERT INTO beanconqueror_waters (id, name, calcium, magnesium, sodium, potassium, chloride, sulfate, imported_at)
       VALUES ('w1', 'Lotus - Mg/K 60/10', 0, 14.6, 0, 7.8, 42.5, 0, ?)`
    ).run(now);
    const brew = db.prepare(
      `INSERT INTO beanconqueror_brews (bc_created_at, bean_id, preparation_id, water_id, water, ground_coffee_g, rating, brew_time, bloom_time, imported_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    // stored as local wall time: 23:30 on Jun 30 stays on Jun 30 (no shift)
    brew.run('2026-06-30T23:30:00.000Z', 'b1', 'm1', 'w1', 'Lotus - Mg/K 60/10', 15, 8.5, '100', '0', now);
    brew.run('2026-07-03T15:00:00.000Z', 'b1', 'm1', null, null, 16, null, null, null, now);
    // a brew of an unlinked bean (no bean row at all)
    brew.run('2026-07-02T15:00:00.000Z', null, null, null, null, 14, 7, null, null, now);
    return { db, coffeeId };
  }

  it('derives every brew field', () => {
    const { db, coffeeId } = seed();
    const { brews } = loadFacts(db);
    expect(brews.map((b) => b.localDate)).toEqual(['2026-06-30', '2026-07-02', '2026-07-03']);
    expect(brews[0]).toMatchObject({
      coffeeId, localTime: '2026-06-30T23:30', dose: 15, rating: 8.5, roaster: 'Sey', origin: 'Kenya',
      processGroup: 'Extended Ferment Washed', roastLevel: 'Light/Medium', decaf: false, dripper: 'CT62',
      filter: 'Cafec Abaca', water: 'Lotus - Mg/K 60/10', restDays: 20, brewTimeSeconds: 100, bloomSeconds: null
    });
    expect(brews[0].costPerBrew).toBeCloseTo(1.8);
    expect(brews[0].waterProfile).toMatchObject({ magnesium: 14.6, potassium: 7.8 });
    expect(brews[0].waterProfile!.gh).toBeCloseTo(60, 0);
    expect(brews[0].waterProfile!.kh).toBeCloseTo(10, 0);
    expect(brews[2].waterProfile).toBeNull();
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
      roastLevel: 'Light/Medium', firstBrew: '2026-06-30', lastBrew: '2026-07-03'
    });
  });

  it('an empty database has no facts', () => expect(loadFacts(createDb(':memory:'))).toEqual({ brews: [], bags: [] }));
});
