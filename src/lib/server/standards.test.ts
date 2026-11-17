import { describe, it, expect } from 'vitest';
import { createDb } from './db';
import { accentsFrom, applyDataStandards, buildVocab, useVocab,roundCents, splitProducerFarm, standardizeCoffee, standardizeField, proposeStandards, formatLocked, type StdField } from './standards';

const OK: [StdField, string, string | null][] = [
  ['elevation', '1850 masl', '1,850 masl'],
  ['elevation', '1,700-1,900 masl', '1,700 - 1,900 masl'],
  ['elevation', 'null', null],
  ['elevation', '>2000', '2,000+ masl'],
  ['elevation', 'above 2000m', '2,000+ masl'],
  ['elevation', 'Over 1,800 meters', '1,800+ masl'],
  ['variety', 'Geisha', 'Gesha'],
  ['variety', 'Geisha & SL-28', 'Gesha, SL28'],
  ['variety', 'Heirloom', 'Landrace'],
  ['variety', 'Rosado/Pink Bourbon', 'Pink Bourbon'],
  ['variety', 'Bourbon Aji', 'Ají'],
  ['elevation', '2,000+ masl', '2,000+ masl'],
  ['elevation', '2,300-2,500+ masl', '2,300 - 2,500+ masl'],
  ['processing', 'Sugarcane (EA) Decaffeinated, Thermal Shock Washed Anaerobic', 'EA Decaf Thermal Shock Anaerobic Washed'],
  ['processing', 'Red Fruits Co-Ferment Decaf', 'EA Decaf Red Fruits Co-Ferment'],
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
  ['producer', 'Mr. Tadese Teko', 'Tadese Teko'],
  ['producer', 'Gikirima Fcs', 'Gikirima FCS'],
  ['producer', 'James Kariuki Aka Bob', 'James Kariuki aka Bob'],
  ['producer', "Jorge 'pikudo' Andrade", "Jorge 'Pikudo' Andrade"],
  ['tasting_notes', 'canteloupe, Naval Orange, lemon-lime', 'Cantaloupe, Navel Orange, Lemon Lime'],
  ['region', 'Huila, Colombia', 'Huila, Colombia'], // country stripping needs the row's origin: see standardizeCoffee
  ['region', 'Gedeb / Yirgacheffe', 'Gedeb, Yirgacheffe'],
  ['tasting_notes', 'peach, white tea', 'Peach, White Tea'],
  ['tasting_notes', 'Peach, peach', 'Peach'],
  ['certification', 'Organic And Rainforest Alliance', 'Organic, Rainforest Alliance'],
  ['variety', 'SL-28', 'SL28'],
  ['variety', 'Bourbon & Typica', 'Bourbon, Typica'],
  ['region', 'Bench Maji – Oma', 'Bench Maji, Oma'],
  ['region', 'Bench Maji - Oma', 'Bench Maji, Oma'],
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
    ['elevation', 'high'],
    ['harvest_time', 'March - July'],
    ['harvest_time', 'Spring'],
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

describe('site vocabulary (G1 across the site)', () => {
  const vocab = buildVocab([{ region: 'Narino, Colombia' }, { region: 'Nariño' }, { producer: 'Marlon Bolaños' }]);
  it('takes the accented site spelling', () => {
    expect(useVocab('region', 'La Union, Narino', vocab)).toBe('La Union, Nariño');
    expect(useVocab('producer', 'marlon bolanos', vocab)).toBe('Marlon Bolaños');
  });
  it('leaves unknown values and other fields alone', () => {
    expect(useVocab('region', 'Huila', vocab)).toBe('Huila');
    expect(useVocab('producer', 'Ana aka Bob', buildVocab([{ producer: 'Ana Aka Bob' }]))).toBe('Ana aka Bob');
    expect(useVocab('processing', 'Narino', vocab)).toBe('Narino');
  });
});

describe('proposeStandards', () => {
  const dbWith = (...roasters: string[]) => {
    const db = createDb(':memory:');
    for (const r of roasters) db.prepare(`INSERT INTO coffees (roaster, coffee_name, created_at, updated_at) VALUES (?, 'x', 'x', 'x')`).run(r);
    return db;
  };
  const save = (values: Record<string, string>, fields: string[], db = dbWith()) => proposeStandards(db, { mode: 'save', values, fields });
  const fill = (values: Record<string, string>, incoming: Record<string, string>) => proposeStandards(dbWith(), { mode: 'fill', values, incoming });
  const KEYS = { roast_date: 'x', cost: '1', amount_g: '1' };

  it('save: a placeholder in a locked field is a Leave blank row, never the text "null"', () => {
    expect(save({ ...KEYS, elevation: 'n/a' }, ['elevation'])).toEqual([
      { field: 'elevation', label: 'Elevation', now: 'n/a', proposed: null, kind: 'missing' }]);
  });
  it('fill: a placeholder on either side never becomes the text "null"', () => {
    for (const rows of [fill({ elevation: 'n/a' }, { elevation: '1800m' }), fill({ elevation: '1,800 masl' }, { elevation: 'n/a' }), fill({ elevation: '-' }, { elevation: '1,900 masl' })]) {
      expect(JSON.stringify(rows)).not.toContain('"null"');
    }
  });

  it('save: locked format change', () => {
    expect(save({ ...KEYS, elevation: '1800m' }, ['elevation'])).toEqual([
      { field: 'elevation', label: 'Elevation', now: '1800m', proposed: '1,800 masl', kind: 'locked' }]);
  });
  it('save: unformattable locked value blocks', () => {
    expect(save({ ...KEYS, harvest_time: 'new crop' }, ['harvest_time'])).toMatchObject([{ field: 'harvest_time', proposed: null, kind: 'blocked' }]);
  });
  it('save: choice, unconverted, cost format', () => {
    expect(save({ ...KEYS, variety: 'SL34 / SL28' }, ['variety'])).toMatchObject([{ kind: 'choice', proposed: 'SL28, SL34' }]);
    expect(save({ ...KEYS, roast_level: 'Weird' }, ['roast_level'])).toMatchObject([{ kind: 'unconverted', proposed: null }]);
    expect(save({ ...KEYS, cost: '$20.999' }, ['cost'])).toMatchObject([{ kind: 'locked', proposed: '21' }]);
  });
  it('save: blank key fields are missing rows regardless of fields; cost blank is missing only', () => {
    const r = save({ roast_date: '', cost: '', amount_g: '', variety: 'A' }, ['variety', 'cost']);
    expect(r.map((x) => [x.field, x.kind])).toEqual([['roast_date', 'missing'], ['cost', 'missing'], ['amount_g', 'missing']]);
  });
  it('save: fields not listed, coffee_name: no row', () => {
    expect(save({ ...KEYS, elevation: '1800m' }, ['variety'])).toEqual([]);
    expect(save({ ...KEYS, coffee_name: 'Whatever' }, ['coffee_name'])).toEqual([]);
  });
  it('save: roaster takes the site spelling and counts coffees', () => {
    expect(save({ ...KEYS, roaster: 'STILL' }, ['roaster'], dbWith('Still'))).toEqual([
      { field: 'roaster', label: 'Roaster', now: 'STILL', proposed: 'Still', kind: 'choice', roasterCount: 1 }]);
    expect(save({ ...KEYS, roaster: 'New' }, ['roaster'], dbWith('Still'))).toEqual([]);
  });
  it('save: producer split shows producer and farm rows', () => {
    const r = save({ ...KEYS, producer: 'Ana - Finca Rosa' }, ['producer']);
    expect(r.map((x) => [x.field, x.proposed])).toEqual([['farm', 'Finca Rosa'], ['producer', 'Ana']]);
  });
  it('save: region drops the country Origin holds (#87)', () => {
    expect(save({ ...KEYS, origin: 'Colombia', region: 'Huila, Colombia' }, ['region'])).toMatchObject([
      { field: 'region', now: 'Huila, Colombia', proposed: 'Huila', kind: 'choice' }]);
    expect(save({ ...KEYS, origin: '', region: 'Huila, Colombia' }, ['region'])).toEqual([]);
  });
  it('fill: a region choice drops the country, from the incoming or the form origin (#87)', () => {
    expect(fill({ region: 'Cauca' }, { region: 'Huila, Colombia', origin: 'Colombia' })).toMatchObject([
      { field: 'region', now: 'Cauca', proposed: 'Huila', kind: 'choice' }]);
    expect(fill({ region: 'Cauca', origin: 'Colombia' }, { region: 'Huila, Colombia' })).toMatchObject([{ proposed: 'Huila' }]);
    expect(fill({ region: 'Huila', origin: 'Colombia' }, { region: 'Huila, Colombia' })).toEqual([]);
  });
  it('fill: locked sides compare formatted', () => {
    expect(fill({ elevation: '1800m' }, { elevation: '1,800 - 2,200+ masl' })).toMatchObject([
      { kind: 'choice', now: '1,800 masl', proposed: '1,800 - 2,200+ masl' }]);
    expect(fill({ elevation: '1800m' }, { elevation: '1,800 masl' })).toMatchObject([{ kind: 'locked' }]);
    expect(fill({ harvest_time: 'new crop' }, { harvest_time: '2025/26' })).toMatchObject([{ kind: 'forced', proposed: '2025/26' }]);
  });
  it('fill: blank current or equal gives no row; name differs is a choice', () => {
    expect(fill({ variety: '' }, { variety: 'Gesha' })).toEqual([]);
    expect(fill({ variety: 'Gesha' }, { variety: 'Gesha' })).toEqual([]);
    expect(fill({ coffee_name: 'A' }, { coffee_name: 'B' })).toMatchObject([{ kind: 'choice', now: 'A', proposed: 'B' }]);
  });
  it('fill: roaster proposes the site spelling', () => {
    expect(proposeStandards(dbWith('Still'), { mode: 'fill', values: { roaster: 'norml' }, incoming: { roaster: 'STILL' } }))
      .toMatchObject([{ field: 'roaster', proposed: 'Still', roasterCount: 1 }]);
  });
  it('fill: only standard fields produce rows', () => {
    expect(fill({ image_url: 'a', amount_g: '100' }, { image_url: 'b', amount_g: '200' })).toEqual([]);
  });
  it('fill: unformattable incoming locked value is never proposed', () => {
    expect(fill({ harvest_time: '2025' }, { harvest_time: 'new crop' })).toEqual([]);
  });
  it('fill: cost compares both sides formatted', () => {
    expect(fill({ cost: '20.989' }, { cost: '21' })).toMatchObject([{ kind: 'choice', now: '20.99', proposed: '21' }]);
  });
  it('save: a typed placeholder is a choice to blank (G3)', () => {
    expect(save({ ...KEYS, variety: 'n/a' }, ['variety'])).toMatchObject([{ kind: 'choice', now: 'n/a', proposed: null }]);
  });
  it('save: malformed cost is blocked, proper thousands commas pass', () => {
    for (const c of ['1,0', '12abc']) expect(save({ ...KEYS, cost: c }, ['cost'])).toMatchObject([{ kind: 'blocked', proposed: null }]);
    expect(save({ ...KEYS, cost: '1,234.5' }, ['cost'])).toMatchObject([{ kind: 'locked', proposed: '1234.5' }]);
  });
  it('save: fields outside the standard set are ignored', () => {
    expect(save({ ...KEYS, image_url: 'x' }, ['image_url', 'amount_g'])).toEqual([]);
  });
});

describe('accentsFrom', () => {
  it('takes the page spelling for each item', () => {
    expect(accentsFrom('Narino, Huila', 'grown in Nariño by…')).toBe('Nariño, Huila');
  });
  it('leaves a value the page does not spell with accents', () => {
    expect(accentsFrom('Narino', 'grown in Narino')).toBe('Narino');
  });
  it('matches multi-word values', () => {
    expect(accentsFrom('Finca La Esperanza', 'Finca La Esperanza')).toBe('Finca La Esperanza');
    expect(accentsFrom('Jose Perez', 'by José Pérez today')).toBe('José Pérez');
  });
});

describe('formatLocked placeholders', () => {
  it('proposes blank for n/a or a dash instead of blocking', () => {
    expect(formatLocked('elevation', 'n/a')).toEqual({ value: null, ok: true });
    expect(formatLocked('harvest_time', '-')).toEqual({ value: null, ok: true });
  });
});
