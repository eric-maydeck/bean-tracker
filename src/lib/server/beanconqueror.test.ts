import { describe, it, expect } from 'vitest';
import ExcelJS from 'exceljs';
import { parseBeanConquerorWorkbook, importBeanConquerorData, getUnmatchedBeanConquerorBeans, dismissBeanConquerorBean } from './beanconqueror';
import { createCoffee } from './coffees';
import { createDb } from './db';

async function buildWorkbook(sheets: Record<string, { headers: string[]; rows: unknown[][] }>): Promise<ExcelJS.Workbook> {
  const wb = new ExcelJS.Workbook();
  for (const [name, { headers, rows }] of Object.entries(sheets)) {
    const ws = wb.addWorksheet(name);
    ws.addRow(headers);
    for (const row of rows) ws.addRow(row);
  }
  return wb;
}

const BEANS_HEADERS = [
  'Name', 'Roaster', 'Roast date', 'Roast type', 'Degree of Roast', 'Roast type',
  'Custom degree of Roast', 'Blend', 'Weight', 'Cost', 'Flavour profile',
  'Cupping points', 'Decaffeinated', 'Website', 'EAN / Articlenumber', 'Notes',
  'Rating', 'Creation date', 'Bean Id', 'Archived',
  '1. Country', '1. Region', '1. Farm', '1. Farmer', '1. Elevation', '1. Variety',
  '1. Processing', '1. Harvested', '1. Percentage', '1. Bean certification',
  '2. Country', '2. Region', '2. Farm', '2. Farmer', '2. Elevation', '2. Variety',
  '2. Processing', '2. Harvested', '2. Percentage', '2. Bean certification'
];

const BREWS_HEADERS = [
  'Grind Setting', 'Ground Coffee (gr)', 'Brew Temperature', 'Preparation method',
  'Bean Type', 'Grinder', 'Grind Speed (rpm)', 'Grind Time', 'Profile',
  'Preparation tools', 'Temperature Time', 'Time', 'Bloom Time / Pre-infusion',
  'First drip time', 'Amount of water', 'Coffee Type', 'Coffee Concentration',
  'Rating', 'Notes', 'Beverage quantity', 'Total dissolved solids %',
  'Extraction Yield %', 'Creation Date', 'Brew Ratio', 'Bean Age', 'Archived',
  'Bean Id', 'Preparation Id', 'Mill Id', 'Water'
];

const METHODS_HEADERS = [
  'Preparation method', 'Name', 'Preparation style', 'Preparation tools', 'Notes', 'Archived', 'Creation date', 'Preparation Id'
];

const GRINDERS_HEADERS = ['Name', 'Notes', 'Archived', 'Creation date', 'Mill Id'];

const roastDate = new Date(Date.UTC(2026, 5, 1));
const createdAt = new Date(Date.UTC(2026, 5, 1, 12, 30, 0));

describe('parseBeanConquerorWorkbook', () => {
  it('parses a single-origin bean, including the "Degree of Roast" numeric field', async () => {
    const wb = await buildWorkbook({
      Beans: {
        headers: BEANS_HEADERS,
        rows: [[
          'Test Bean', 'Test Roaster', roastDate, 'Filter', 2.5, null, null, 'Single Origin',
          200, 18, null, null, false, null, null, null, 7, createdAt, 'bean-1', false,
          'Ethiopia', null, null, null, null, null, 'Washed', null, null, null,
          null, null, null, null, null, null, null, null, null, null
        ]]
      },
      Brews: { headers: [], rows: [] },
      Methods: { headers: [], rows: [] },
      Grinders: { headers: [], rows: [] }
    });
    const parsed = parseBeanConquerorWorkbook(wb);
    expect(parsed.beans).toHaveLength(1);
    expect(parsed.beans[0]).toMatchObject({
      id: 'bean-1',
      name: 'Test Bean',
      roaster: 'Test Roaster',
      roastDate: '2026-06-01',
      degreeOfRoast: 2.5,
      decaffeinated: false,
      bcArchived: false
    });
    expect(parsed.beanOrigins).toHaveLength(1);
    expect(parsed.beanOrigins[0]).toMatchObject({
      beanId: 'bean-1',
      componentNumber: 1,
      country: 'Ethiopia',
      processing: 'Washed'
    });
  });

  it('parses a variable number of blend components, stopping where a component is entirely empty', async () => {
    const wb = await buildWorkbook({
      Beans: {
        headers: BEANS_HEADERS,
        rows: [[
          'Blend Bean', 'Roaster', roastDate, 'Filter', 3, null, null, 'Blend',
          250, 20, null, null, false, null, null, null, null, createdAt, 'bean-2', false,
          'Brazil', null, null, null, null, null, null, null, null, null,
          'Colombia', null, null, null, null, null, null, null, null, null
        ]]
      },
      Brews: { headers: [], rows: [] },
      Methods: { headers: [], rows: [] },
      Grinders: { headers: [], rows: [] }
    });
    const parsed = parseBeanConquerorWorkbook(wb);
    expect(parsed.beanOrigins).toHaveLength(2);
    expect(parsed.beanOrigins.map((o) => o.country)).toEqual(['Brazil', 'Colombia']);
  });

  it('parses brews, methods, and grinders with their own identity columns', async () => {
    const wb = await buildWorkbook({
      Beans: { headers: BEANS_HEADERS, rows: [] },
      Brews: {
        headers: BREWS_HEADERS,
        rows: [[
          '1.7.0', 20.1, 91, 'Gabi Master A', 'Type A', 'A4Z', 0, '0', null, null, '0',
          '260', '0', '0', 333.7, null, null, 7.5, null, 0, 0, '0', createdAt,
          '1 / 16.60', 43, false, 'bean-1', 'prep-1', 'mill-1', 'Lotus'
        ]]
      },
      Methods: {
        headers: METHODS_HEADERS,
        rows: [['Gabi Master A', 'V60', 'Pourover', null, null, false, createdAt, 'prep-1']]
      },
      Grinders: {
        headers: GRINDERS_HEADERS,
        rows: [['A4Z', null, false, createdAt, 'mill-1']]
      }
    });
    const parsed = parseBeanConquerorWorkbook(wb);
    expect(parsed.brews).toHaveLength(1);
    expect(parsed.brews[0]).toMatchObject({ beanId: 'bean-1', preparationId: 'prep-1', millId: 'mill-1', rating: 7.5 });
    expect(parsed.methods).toHaveLength(1);
    expect(parsed.methods[0]).toMatchObject({ id: 'prep-1', name: 'V60' });
    expect(parsed.grinders).toHaveLength(1);
    expect(parsed.grinders[0]).toMatchObject({ id: 'mill-1', name: 'A4Z' });
  });
});

describe('parseBeanConquerorWorkbook header validation', () => {
  const beanRow = [
    'Test Bean', 'Test Roaster', roastDate, 'Filter', 2.5, null, null, 'Single Origin',
    200, 18, null, null, false, null, null, null, 7, createdAt, 'bean-1', false
  ];

  it('throws a clear error when a fixed Beans column is renamed', async () => {
    const headers = [...BEANS_HEADERS];
    headers[18] = 'Bean UUID'; // column 19, where the parser reads the bean id
    const wb = await buildWorkbook({
      Beans: { headers, rows: [beanRow] },
      Brews: { headers: [], rows: [] },
      Methods: { headers: [], rows: [] },
      Grinders: { headers: [], rows: [] }
    });
    expect(() => parseBeanConquerorWorkbook(wb)).toThrow(
      /expected column 19 of the Beans sheet to be 'Bean Id', found 'Bean UUID'/
    );
  });

  it('throws rather than silently shifting every field when a column is inserted upstream', async () => {
    // The actual failure mode this guards against: Bean Conqueror adds a
    // column mid-sheet, so every later column slides one to the right and a
    // positional parser writes each value into the wrong field.
    const headers = [...BEANS_HEADERS];
    headers.splice(2, 0, 'Roast Profile');
    const row = [...beanRow];
    row.splice(2, 0, 'some profile');
    const wb = await buildWorkbook({
      Beans: { headers, rows: [row] },
      Brews: { headers: [], rows: [] },
      Methods: { headers: [], rows: [] },
      Grinders: { headers: [], rows: [] }
    });
    expect(() => parseBeanConquerorWorkbook(wb)).toThrow(/Bean Conqueror export format has changed/);
  });

  it('validates the Brews, Methods, and Grinders sheets too', async () => {
    const brewsHeaders = [...BREWS_HEADERS];
    brewsHeaders[26] = 'Bean UUID'; // column 27, the brew's bean id
    const wb = await buildWorkbook({
      Beans: { headers: BEANS_HEADERS, rows: [] },
      Brews: {
        headers: brewsHeaders,
        rows: [[
          '1.7.0', 20.1, 91, 'Gabi Master A', 'Type A', 'A4Z', 0, '0', null, null, '0',
          '260', '0', '0', 333.7, null, null, 7.5, null, 0, 0, '0', createdAt,
          '1 / 16.60', 43, false, 'bean-1', 'prep-1', 'mill-1', 'Lotus'
        ]]
      },
      Methods: { headers: METHODS_HEADERS, rows: [] },
      Grinders: { headers: GRINDERS_HEADERS, rows: [] }
    });
    expect(() => parseBeanConquerorWorkbook(wb)).toThrow(/column 27 of the Brews sheet to be 'Bean Id'/);

    const grindersHeaders = [...GRINDERS_HEADERS];
    grindersHeaders[4] = 'Grinder Id';
    const wb2 = await buildWorkbook({
      Beans: { headers: BEANS_HEADERS, rows: [] },
      Brews: { headers: BREWS_HEADERS, rows: [] },
      Methods: { headers: METHODS_HEADERS, rows: [] },
      Grinders: { headers: grindersHeaders, rows: [['A4Z', null, false, createdAt, 'mill-1']] }
    });
    expect(() => parseBeanConquerorWorkbook(wb2)).toThrow(/column 5 of the Grinders sheet to be 'Mill Id'/);
  });

  it('accepts headers that differ only in capitalization or surrounding whitespace', async () => {
    const headers = BEANS_HEADERS.map((h, i) => (i === 18 ? '  bean id  ' : h));
    const wb = await buildWorkbook({
      Beans: { headers, rows: [beanRow] },
      Brews: { headers: [], rows: [] },
      Methods: { headers: [], rows: [] },
      Grinders: { headers: [], rows: [] }
    });
    expect(parseBeanConquerorWorkbook(wb).beans).toHaveLength(1);
  });

  it('skips validation for a sheet with no data rows, since nothing can be mis-parsed', async () => {
    const wb = await buildWorkbook({
      Beans: { headers: BEANS_HEADERS, rows: [beanRow] },
      Brews: { headers: ['Totally', 'Different'], rows: [] },
      Methods: { headers: [], rows: [] },
      Grinders: { headers: [], rows: [] }
    });
    expect(parseBeanConquerorWorkbook(wb).beans).toHaveLength(1);
    expect(parseBeanConquerorWorkbook(wb).brews).toHaveLength(0);
  });
});

describe('importBeanConquerorData', () => {
  it('inserts new rows across all 5 tables in one call', () => {
    const db = createDb(':memory:');
    importBeanConquerorData(db, {
      beans: [{ id: 'b1', name: 'Bean', roaster: 'R', roastDate: '2026-06-01', roastType: 'Filter', degreeOfRoast: 2, customDegreeOfRoast: null, blend: 'Single Origin', weightG: 200, cost: 18, aromatics: null, cuppingPoints: null, decaffeinated: false, url: null, eanArticleNumber: null, notes: null, rating: 7, bcCreatedAt: '2026-06-01T00:00:00.000Z', bcArchived: false }],
      beanOrigins: [{ beanId: 'b1', componentNumber: 1, country: 'Ethiopia', region: null, farm: null, farmer: null, elevation: null, variety: null, processing: 'Washed', certification: null, harvested: null, percentage: null }],
      methods: [{ id: 'm1', preparationMethod: 'V60', name: 'V60', preparationStyle: null, preparationTools: null, notes: null, bcArchived: false, bcCreatedAt: null }],
      grinders: [{ id: 'g1', name: 'Grinder', notes: null, bcArchived: false, bcCreatedAt: null }],
      brews: [{ bcCreatedAt: '2026-06-01T12:00:00.000Z', beanId: 'b1', preparationId: 'm1', millId: 'g1', grindSetting: null, groundCoffeeG: 20, brewTemperature: 91, beanType: null, grindSpeedRpm: null, grindTime: null, profile: null, preparationTools: null, temperatureTime: null, brewTime: null, bloomTime: null, firstDripTime: null, waterAmountG: 300, coffeeType: null, coffeeConcentration: null, rating: 8, notes: null, beverageQuantity: null, tdsPercent: null, extractionYieldPercent: null, brewRatio: null, beanAgeDays: null, bcArchived: false, water: null }]
    });
    expect((db.prepare('SELECT COUNT(*) c FROM beanconqueror_beans').get() as { c: number }).c).toBe(1);
    expect((db.prepare('SELECT COUNT(*) c FROM beanconqueror_bean_origins').get() as { c: number }).c).toBe(1);
    expect((db.prepare('SELECT COUNT(*) c FROM beanconqueror_methods').get() as { c: number }).c).toBe(1);
    expect((db.prepare('SELECT COUNT(*) c FROM beanconqueror_grinders').get() as { c: number }).c).toBe(1);
    expect((db.prepare('SELECT COUNT(*) c FROM beanconqueror_brews').get() as { c: number }).c).toBe(1);
    const beanRow = db.prepare('SELECT * FROM beanconqueror_beans WHERE id = ?').get('b1') as { imported_at: string };
    expect(beanRow.imported_at).toBeTruthy();
  });

  it('updates a changed bean on re-import (same id) rather than duplicating it, without touching dismissed_at', () => {
    const db = createDb(':memory:');
    const bean = { id: 'b1', name: 'Bean v1', roaster: 'R', roastDate: '2026-06-01', roastType: null, degreeOfRoast: null, customDegreeOfRoast: null, blend: null, weightG: 200, cost: 18, aromatics: null, cuppingPoints: null, decaffeinated: false, url: null, eanArticleNumber: null, notes: null, rating: null, bcCreatedAt: null, bcArchived: false };
    importBeanConquerorData(db, { beans: [bean], beanOrigins: [], methods: [], grinders: [], brews: [] });
    db.prepare(`UPDATE beanconqueror_beans SET dismissed_at = ? WHERE id = ?`).run('2026-06-05T00:00:00.000Z', 'b1');
    importBeanConquerorData(db, { beans: [{ ...bean, name: 'Bean v2', rating: 9 }], beanOrigins: [], methods: [], grinders: [], brews: [] });
    const rows = db.prepare('SELECT id, name, rating, dismissed_at FROM beanconqueror_beans').all() as { id: string; name: string; rating: number; dismissed_at: string }[];
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ id: 'b1', name: 'Bean v2', rating: 9, dismissed_at: '2026-06-05T00:00:00.000Z' });
  });

  it('never deletes a row that a later import omits', () => {
    const db = createDb(':memory:');
    const bean = { id: 'b1', name: 'Bean', roaster: null, roastDate: null, roastType: null, degreeOfRoast: null, customDegreeOfRoast: null, blend: null, weightG: null, cost: null, aromatics: null, cuppingPoints: null, decaffeinated: false, url: null, eanArticleNumber: null, notes: null, rating: null, bcCreatedAt: null, bcArchived: false };
    importBeanConquerorData(db, { beans: [bean], beanOrigins: [], methods: [], grinders: [], brews: [] });
    importBeanConquerorData(db, { beans: [], beanOrigins: [], methods: [], grinders: [], brews: [] });
    expect((db.prepare('SELECT COUNT(*) c FROM beanconqueror_beans').get() as { c: number }).c).toBe(1);
  });

  it('diffs brews by the synthetic (bc_created_at, bean_id) identity, updating in place on a repeat', () => {
    const db = createDb(':memory:');
    const brew = { bcCreatedAt: '2026-06-01T12:00:00.000Z', beanId: null, preparationId: null, millId: null, grindSetting: null, groundCoffeeG: 20, brewTemperature: null, beanType: null, grindSpeedRpm: null, grindTime: null, profile: null, preparationTools: null, temperatureTime: null, brewTime: null, bloomTime: null, firstDripTime: null, waterAmountG: null, coffeeType: null, coffeeConcentration: null, rating: 7, notes: null, beverageQuantity: null, tdsPercent: null, extractionYieldPercent: null, brewRatio: null, beanAgeDays: null, bcArchived: false, water: null };
    importBeanConquerorData(db, { beans: [], beanOrigins: [], methods: [], grinders: [], brews: [brew] });
    importBeanConquerorData(db, { beans: [], beanOrigins: [], methods: [], grinders: [], brews: [{ ...brew, rating: 9 }] });
    const rows = db.prepare('SELECT rating FROM beanconqueror_brews').all() as { rating: number }[];
    expect(rows).toHaveLength(1);
    expect(rows[0].rating).toBe(9);
  });
});

describe('getUnmatchedBeanConquerorBeans', () => {
  it('excludes a bean that matches an existing coffee by roaster, name, and roast date', () => {
    const db = createDb(':memory:');
    createCoffee(db, {
      roaster: 'Roaster A',
      coffee_name: 'Bean X',
      origin: null,
      roast_level: null,
      processing: null,
      amount_g: null,
      cost: null,
      roast_date: '2026-06-01',
      frozen_start_date: null,
      frozen_end_date: null,
      rest_days_low: null,
      rest_days_high: null,
      image_url: null
    });
    importBeanConquerorData(db, {
      beans: [{ id: 'b1', name: 'Bean X', roaster: 'Roaster A', roastDate: '2026-06-01', roastType: null, degreeOfRoast: null, customDegreeOfRoast: null, blend: null, weightG: null, cost: null, aromatics: null, cuppingPoints: null, decaffeinated: false, url: null, eanArticleNumber: null, notes: null, rating: null, bcCreatedAt: null, bcArchived: false }],
      beanOrigins: [],
      methods: [],
      grinders: [],
      brews: []
    });
    expect(getUnmatchedBeanConquerorBeans(db)).toHaveLength(0);
  });

  it('includes a bean with no matching coffee, with its first origin component attached', () => {
    const db = createDb(':memory:');
    importBeanConquerorData(db, {
      beans: [{ id: 'b1', name: 'New Bean', roaster: 'Roaster A', roastDate: '2026-06-01', roastType: null, degreeOfRoast: null, customDegreeOfRoast: null, blend: null, weightG: 200, cost: 18, aromatics: null, cuppingPoints: null, decaffeinated: false, url: null, eanArticleNumber: null, notes: null, rating: null, bcCreatedAt: null, bcArchived: false }],
      beanOrigins: [{ beanId: 'b1', componentNumber: 1, country: 'Ethiopia', region: null, farm: null, farmer: null, elevation: null, variety: null, processing: 'Washed', certification: null, harvested: null, percentage: null }],
      methods: [],
      grinders: [],
      brews: []
    });
    const unmatched = getUnmatchedBeanConquerorBeans(db);
    expect(unmatched).toHaveLength(1);
    expect(unmatched[0]).toMatchObject({ id: 'b1', name: 'New Bean', origin: 'Ethiopia', processing: 'Washed' });
  });

  it('orders candidates newest-bean-first by their Bean Conqueror creation date', () => {
    const db = createDb(':memory:');
    const base = { roaster: 'Roaster A', roastDate: null, roastType: null, degreeOfRoast: null, customDegreeOfRoast: null, blend: null, weightG: null, cost: null, aromatics: null, cuppingPoints: null, decaffeinated: false, url: null, eanArticleNumber: null, notes: null, rating: null, bcArchived: false };
    // All three arrive in one import, so they share an identical
    // imported_at — only bc_created_at can order them.
    importBeanConquerorData(db, {
      beans: [
        { ...base, id: 'b1', name: 'Oldest', bcCreatedAt: '2026-01-01T00:00:00.000Z' },
        { ...base, id: 'b2', name: 'Newest', bcCreatedAt: '2026-06-01T00:00:00.000Z' },
        { ...base, id: 'b3', name: 'Middle', bcCreatedAt: '2026-03-01T00:00:00.000Z' }
      ],
      beanOrigins: [],
      methods: [],
      grinders: [],
      brews: []
    });
    expect(getUnmatchedBeanConquerorBeans(db).map((b) => b.name)).toEqual(['Newest', 'Middle', 'Oldest']);
  });

  it('excludes a dismissed bean even though it has no matching coffee', () => {
    const db = createDb(':memory:');
    importBeanConquerorData(db, {
      beans: [{ id: 'b1', name: 'Dismissed Bean', roaster: null, roastDate: null, roastType: null, degreeOfRoast: null, customDegreeOfRoast: null, blend: null, weightG: null, cost: null, aromatics: null, cuppingPoints: null, decaffeinated: false, url: null, eanArticleNumber: null, notes: null, rating: null, bcCreatedAt: null, bcArchived: false }],
      beanOrigins: [],
      methods: [],
      grinders: [],
      brews: []
    });
    dismissBeanConquerorBean(db, 'b1');
    expect(getUnmatchedBeanConquerorBeans(db)).toHaveLength(0);
  });
});

describe('dismissBeanConquerorBean', () => {
  it('sets dismissed_at without touching other fields', () => {
    const db = createDb(':memory:');
    importBeanConquerorData(db, {
      beans: [{ id: 'b1', name: 'Bean', roaster: null, roastDate: null, roastType: null, degreeOfRoast: null, customDegreeOfRoast: null, blend: null, weightG: null, cost: null, aromatics: null, cuppingPoints: null, decaffeinated: false, url: null, eanArticleNumber: null, notes: null, rating: null, bcCreatedAt: null, bcArchived: false }],
      beanOrigins: [],
      methods: [],
      grinders: [],
      brews: []
    });
    dismissBeanConquerorBean(db, 'b1');
    const row = db.prepare('SELECT name, dismissed_at FROM beanconqueror_beans WHERE id = ?').get('b1') as { name: string; dismissed_at: string };
    expect(row.name).toBe('Bean');
    expect(row.dismissed_at).toBeTruthy();
  });
});
