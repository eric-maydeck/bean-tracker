import { describe, it, expect } from 'vitest';
import { createDb } from './db';
import { applyDataStandards, roundCents, splitProducerFarm, standardizeCoffee, standardizeField, type StdField } from './standards';

const OK: [StdField, string, string | null][] = [
  ['elevation', '1850 masl', '1,850 masl'],
  ['elevation', '1,700-1,900 masl', '1,700 - 1,900 masl'],
  ['elevation', '>2000', '>2,000 masl'],
  ['elevation', '60-250 masl', '60 - 250 masl'],
  ['elevation', '~1,850 masl', '~1,850 masl'],
  ['harvest_time', 'January-April 2026', 'January 2026 - April 2026'],
  ['harvest_time', '2026 New Crop', '2026'],
  ['harvest_time', 'December 2025-January 2026', 'December 2025 - January 2026'],
  ['harvest_time', '2025/26', '2025/26'],
  ['harvest_time', 'Q3 2025', 'Q3 2025'],
  ['harvest_time', 'late 2025', 'Late 2025'],
  ['harvest_time', 'January 2026', 'January 2026'],
  ['processing', 'Fully Washed', 'Washed'],
  ['processing', 'Tyoxidator Washed', 'Tyoxy Washed'],
  ['processing', 'Red fruits co-ferment', 'Red Fruits Co-Ferment'],
  ['processing', 'Washed Decaf', 'EA Decaf Washed'],
  ['processing', 'Natural EA Decaf', 'EA Decaf Natural'],
  ['processing', 'N/A', null],
  ['processing', '????????', null],
  ['processing', 'Anaerobic Natural', 'Anaerobic Natural'],
  ['roast_level', 'Medium/Light', 'Light/Medium'],
  ['roast_level', 'nordic light', 'Nordic Light'],
  ['origin', 'N/A', null],
  ['origin', 'Colombia', 'Colombia'],
  ['producer', 'Ana and Luis Example', 'Ana & Luis Example'],
  ['producer', 'Ana And Luis Example', 'Ana & Luis Example'],
  ['producer', 'Ana Example, Example Co', 'Ana Example (Example Co)'],
  ['producer', 'Ana Example // Example Co', 'Ana Example (Example Co)'],
  ['producer', 'Ana Example / Example Co', 'Ana Example (Example Co)'],
  ['producer', 'Example Co by Ana Example', 'Ana Example (Example Co)'],
  ['producer', 'Marcelo Assis And Flavio Silva // Bioma Cafe', 'Marcelo Assis & Flavio Silva (Bioma Cafe)'],
  ['region', 'Huila, Colombia', 'Huila, Colombia'], // country stripping needs the row's origin: see standardizeCoffee
  ['region', 'Gedeb / Yirgacheffe', 'Gedeb, Yirgacheffe'],
  ['tasting_notes', 'peach, white tea', 'Peach, White Tea'],
  ['tasting_notes', 'Peach, peach', 'Peach'],
  ['certification', 'Organic And Rainforest Alliance', 'Organic, Rainforest Alliance'],
  ['variety', 'SL-28', 'SL28'],
  ['variety', 'SL34, SL28, Batian', 'Batian, SL28, SL34'],
  ['variety', 'SL28, SL34, Ruiru 11, Batian', 'Batian, Ruiru 11, SL28, SL34'],
  ['variety', '74112, 74110, 74158', '74110, 74112, 74158'],
  ['variety', 'Landraces', 'Landrace'],
  ['variety', 'Ethiopian Landraces', 'Landrace'],
  ['variety', 'Landrace Varieties', 'Landrace'],
  ['variety', 'JARC 74158', '74158'],
  ['variety', 'Primarily JARC 74158', '74158'],
  ['variety', 'JARC 74158 (Walega)', '74158'],
  ['variety', 'Selectdion 9', 'Selection 9'],
  ['variety', 'SL9, Gesha Inca', 'SL9 (Inca Gesha)'],
  ['variety', 'Gesha Inca, SL9', 'SL9 (Inca Gesha)'],
  ['variety', 'Inca Gesha', 'SL9 (Inca Gesha)'],
  ['variety', 'SL9 (Inca Gesha), SL9', 'SL9 (Inca Gesha)'],
  ['variety', 'H10 (Milenio)', 'H10 (Milenio)']
];

describe('standardizeField', () => {
  it.each(OK)('%s: %s -> %s', (field, from, to) => {
    expect(standardizeField(field, from)).toEqual({ value: to });
  });

  it('is idempotent: every expected output standardizes to itself', () => {
    for (const [field, , to] of OK) expect(standardizeField(field, to)).toEqual({ value: to });
  });

  it.each<[StdField, string]>([
    ['elevation', '2,300-2,500+ masl'],
    ['elevation', 'high'],
    ['harvest_time', 'March - July'],
    ['harvest_time', 'Spring'],
    ['processing', 'Sugarcane (EA) Decaffeinated, Thermal Shock Washed Anaerobic'],
    ['processing', 'Red Fruits Co-Ferment Decaf'],
    ['producer', 'A, B, C'],
    ['roast_level', 'Burnt'],
    ['origin', 'Colombia/Peru']
  ])('%s: "%s" goes to review, value unchanged', (field, v) => {
    expect(standardizeField(field, v)).toEqual({ value: v, review: expect.any(String) });
  });

  it('G1: the site spelling wins on a case/accent-only difference', () => {
    expect(standardizeField('producer', 'Marlon Bolanos', 'Marlon Bolaños').value).toBe('Marlon Bolaños');
    expect(standardizeField('variety', 'SL34, sl28', 'SL28, SL34').value).toBe('SL28, SL34');
    expect(standardizeField('variety', 'Gesha', 'Pink Bourbon').value).toBe('Gesha');
  });
});

describe('splitProducerFarm', () => {
  const farms = ['Finca El Paraíso', 'La Fortuna'];
  it.each([
    ['Ana & Luis Example - Finca Example', null, { producer: 'Ana & Luis Example', farm: 'Finca Example' }],
    ['Ana Example, Hacienda Sol', null, { producer: 'Ana Example', farm: 'Hacienda Sol' }],
    ['Ana Example / Granja Sol', null, { producer: 'Ana Example', farm: 'Granja Sol' }],
    ['Ana Example, Sol Farm', null, { producer: 'Ana Example', farm: 'Sol Farm' }],
    ['Ana Example, finca el paraiso', null, { producer: 'Ana Example', farm: 'Finca El Paraíso' }],
    ['Ana Example, Estate Sol', null, { producer: 'Ana Example', farm: 'Estate Sol' }],
    ['Ana Example, Example Co', null, null],
    ['Ana Example', null, null],
    ['Ana Example - Finca Example', 'Other', null],
    ['Ana Example - Example Co', null, { review: expect.any(String) }]
  ])('%s (farm %s)', (producer, farm, want) => {
    expect(splitProducerFarm(producer, farm, farms)).toEqual(want);
  });
});

describe('standardizeCoffee', () => {
  it('rounds cost, strips the origin from region and splits producer/farm', () => {
    const row = { id: 1, cost: 20.9900000000016, origin: 'Colombia', region: 'Huila, Colombia', producer: 'Ana - Finca Sol', farm: null, processing: 'Fully Washed' };
    const r = standardizeCoffee(row, []);
    expect(r.review).toEqual([]);
    expect(Object.fromEntries(r.changes.map((c) => [c.field, c.to]))).toEqual({
      cost: 20.99, region: 'Huila', farm: 'Finca Sol', producer: 'Ana', processing: 'Washed'
    });
  });

  it('is a no-op on standard rows and collects review items', () => {
    expect(standardizeCoffee({ cost: 20.99, origin: 'Peru', elevation: '1,850 masl', farm: 'X', producer: 'A & B' }, [])).toEqual({ changes: [], review: [] });
    const r = standardizeCoffee({ harvest_time: 'March - July', elevation: '1,000 masl' }, []);
    expect(r.review).toEqual([{ field: 'harvest_time', value: 'March - July', reason: expect.any(String) }]);
    expect(r.changes).toEqual([]);
  });

  it('roundCents', () => expect(roundCents(25.9900000000016)).toBe(25.99));
});

describe('applyDataStandards', () => {
  const seed = () => {
    const db = createDb(':memory:');
    const ins = db.prepare(
      `INSERT INTO coffees (roaster, coffee_name, origin, processing, cost, elevation, harvest_time, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, 'x', 'x')`
    );
    ins.run('R', 'A', 'Colombia', 'Fully Washed', 20.9900000000016, '1700-1900', 'March - July');
    ins.run('R', 'B', 'Peru', 'Washed', 10, '1,850 masl', '2026');
    return db;
  };

  it('converts once, leaves review values alone, and records the marker', () => {
    const db = seed();
    expect(applyDataStandards(db, 'data_standards_test')).toEqual({ changes: 3, review: 1 });
    const a = db.prepare(`SELECT processing, cost, elevation, harvest_time FROM coffees WHERE coffee_name = 'A'`).get();
    expect({ ...a }).toEqual({ processing: 'Washed', cost: 20.99, elevation: '1,700 - 1,900 masl', harvest_time: 'March - July' });
    expect(applyDataStandards(db, 'data_standards_test')).toBeNull();
  });
});
