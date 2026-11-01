import { describe, it, expect } from 'vitest';
import {
  importBeanConquerorData,
  getUnmatchedBeanConquerorBeans,
  countUnmatchedBeanConquerorBeans,
  dismissBeanConquerorBean
} from './beanconqueror';
import { createCoffee, getBacklogCoffees } from './coffees';
import { coffeeBeanUuid } from './bqBeanUuid';
import { createDb } from './db';

const BASE_BREW = { bcCreatedAt: '2026-06-01T12:00:00.000Z', beanId: null, preparationId: null, millId: null, grindSetting: null, groundCoffeeG: 20, brewTemperature: null, beanType: null, grindSpeedRpm: null, grindTime: null, profile: null, preparationTools: null, temperatureTime: null, brewTime: null, bloomTime: null, firstDripTime: null, waterAmountG: null, coffeeType: null, coffeeConcentration: null, rating: 7, notes: null, beverageQuantity: null, tdsPercent: null, extractionYieldPercent: null, brewRatio: null, beanAgeDays: null, bcArchived: false, water: null };
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
    const brew = BASE_BREW;
    importBeanConquerorData(db, { beans: [], beanOrigins: [], methods: [], grinders: [], brews: [brew] });
    importBeanConquerorData(db, { beans: [], beanOrigins: [], methods: [], grinders: [], brews: [{ ...brew, rating: 9 }] });
    const rows = db.prepare('SELECT rating FROM beanconqueror_brews').all() as { rating: number }[];
    expect(rows).toHaveLength(1);
    expect(rows[0].rating).toBe(9);
  });

  it('stores a 0 rating as unrated (Bean Conqueror\'s default, shown as no rating there)', () => {
    const db = createDb(':memory:');
    const bean = { id: 'b1', name: 'Bean', roaster: null, roastDate: null, roastType: null, degreeOfRoast: null, customDegreeOfRoast: null, blend: null, weightG: null, cost: null, aromatics: null, cuppingPoints: null, decaffeinated: false, url: null, eanArticleNumber: null, notes: null, rating: 0, bcCreatedAt: null, bcArchived: false };
    const brew = { ...BASE_BREW, beanId: 'b1', rating: 0 };
    importBeanConquerorData(db, { beans: [bean], beanOrigins: [], methods: [], grinders: [], brews: [brew] });
    expect(db.prepare('SELECT rating FROM beanconqueror_beans').get()).toEqual({ rating: null });
    expect(db.prepare('SELECT rating FROM beanconqueror_brews').get()).toEqual({ rating: null });
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
    expect(getUnmatchedBeanConquerorBeans(db, 20)).toHaveLength(0);
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
    const unmatched = getUnmatchedBeanConquerorBeans(db, 20);
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
    expect(getUnmatchedBeanConquerorBeans(db, 20).map((b) => b.name)).toEqual(['Newest', 'Middle', 'Oldest']);
  });

  it('caps results at the given limit while countUnmatchedBeanConquerorBeans reports the true total', () => {
    const db = createDb(':memory:');
    const base = { roaster: null, roastDate: null, roastType: null, degreeOfRoast: null, customDegreeOfRoast: null, blend: null, weightG: null, cost: null, aromatics: null, cuppingPoints: null, decaffeinated: false, url: null, eanArticleNumber: null, notes: null, rating: null, bcCreatedAt: null, bcArchived: false };
    importBeanConquerorData(db, {
      beans: [
        { ...base, id: 'b1', name: 'Bean 1' },
        { ...base, id: 'b2', name: 'Bean 2' },
        { ...base, id: 'b3', name: 'Bean 3' }
      ],
      beanOrigins: [],
      methods: [],
      grinders: [],
      brews: []
    });
    expect(getUnmatchedBeanConquerorBeans(db, 2)).toHaveLength(2);
    expect(countUnmatchedBeanConquerorBeans(db)).toBe(3);
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
    expect(getUnmatchedBeanConquerorBeans(db, 20)).toHaveLength(0);
  });

  // Real examples pulled from this user's own production data (2026-09-23),
  // used to calibrate the likely-match heuristic against actual failure
  // modes rather than invented ones.
  describe('likelyMatch', () => {
    function importBean(
      db: ReturnType<typeof createDb>,
      overrides: Partial<Parameters<typeof importBeanConquerorData>[1]['beans'][0]> & { id: string; name: string }
    ) {
      importBeanConquerorData(db, {
        beans: [
          {
            roaster: null,
            roastDate: null,
            roastType: null,
            degreeOfRoast: null,
            customDegreeOfRoast: null,
            blend: null,
            weightG: null,
            cost: null,
            aromatics: null,
            cuppingPoints: null,
            decaffeinated: false,
            url: null,
            eanArticleNumber: null,
            notes: null,
            rating: null,
            bcCreatedAt: null,
            bcArchived: false,
            ...overrides
          }
        ],
        beanOrigins: [],
        methods: [],
        grinders: [],
        brews: []
      });
    }

    it('flags an accent-only name difference on the same roast date', () => {
      const db = createDb(':memory:');
      createCoffee(db, {
        roaster: 'H&S',
        coffee_name: 'Yulisa Carhuallocllo: Corazon de Chirinos',
        origin: null,
        roast_level: null,
        processing: null,
        amount_g: null,
        cost: null,
        roast_date: '2026-03-22',
        frozen_start_date: null,
        frozen_end_date: null,
        rest_days_low: null,
        rest_days_high: null,
        image_url: null
      });
      importBean(db, {
        id: 'b1',
        name: 'Yulisa Carhuallocllo: Corazón de Chirinos',
        roaster: 'H&S',
        roastDate: '2026-03-22'
      });
      const [bean] = getUnmatchedBeanConquerorBeans(db, 20);
      expect(bean.likelyMatch).toMatchObject({ coffeeName: 'Yulisa Carhuallocllo: Corazon de Chirinos' });
    });

    it('flags a country-prefix-only name difference within the date window', () => {
      const db = createDb(':memory:');
      createCoffee(db, {
        roaster: 'Scenery',
        coffee_name: 'Ethiopia - Kebena Natural Decaf',
        origin: null,
        roast_level: null,
        processing: null,
        amount_g: null,
        cost: null,
        roast_date: '2026-06-11',
        frozen_start_date: null,
        frozen_end_date: null,
        rest_days_low: null,
        rest_days_high: null,
        image_url: null
      });
      importBean(db, { id: 'b1', name: 'Kebena Natural Decaf', roaster: 'Scenery', roastDate: '2026-06-11' });
      const [bean] = getUnmatchedBeanConquerorBeans(db, 20);
      expect(bean.likelyMatch).toMatchObject({ coffeeName: 'Ethiopia - Kebena Natural Decaf' });
    });

    it('flags a single-character typo within the date window', () => {
      const db = createDb(':memory:');
      createCoffee(db, {
        roaster: 'Ordinary',
        coffee_name: 'Burundi Gakenke Washing Station',
        origin: null,
        roast_level: null,
        processing: null,
        amount_g: null,
        cost: null,
        roast_date: '2026-07-11',
        frozen_start_date: null,
        frozen_end_date: null,
        rest_days_low: null,
        rest_days_high: null,
        image_url: null
      });
      importBean(db, {
        id: 'b1',
        name: 'Burundu Gakenke Washing Station',
        roaster: 'Ordinary',
        roastDate: '2026-07-11'
      });
      const [bean] = getUnmatchedBeanConquerorBeans(db, 20);
      expect(bean.likelyMatch).toMatchObject({ coffeeName: 'Burundi Gakenke Washing Station' });
    });

    it('flags a same-name match a couple of days off, not requiring an exact date', () => {
      const db = createDb(':memory:');
      createCoffee(db, {
        roaster: 'Aviary',
        coffee_name: '023 - Shibru Dube',
        origin: null,
        roast_level: null,
        processing: null,
        amount_g: null,
        cost: null,
        roast_date: '2026-02-10',
        frozen_start_date: null,
        frozen_end_date: null,
        rest_days_low: null,
        rest_days_high: null,
        image_url: null
      });
      importBean(db, { id: 'b1', name: '023 - Shibru Dube', roaster: 'Aviary', roastDate: '2026-02-09' });
      const [bean] = getUnmatchedBeanConquerorBeans(db, 20);
      expect(bean.likelyMatch).toMatchObject({ coffeeName: '023 - Shibru Dube' });
    });

    it('flags a matching name with no roast date on either side', () => {
      const db = createDb(':memory:');
      createCoffee(db, {
        roaster: 'H&S',
        coffee_name: 'Rwanda Gitega 861',
        origin: null,
        roast_level: null,
        processing: null,
        amount_g: null,
        cost: null,
        roast_date: '2026-03-01',
        frozen_start_date: null,
        frozen_end_date: null,
        rest_days_low: null,
        rest_days_high: null,
        image_url: null
      });
      importBean(db, { id: 'b1', name: 'Rwanda Gitega 861', roaster: 'H&S', roastDate: null });
      const [bean] = getUnmatchedBeanConquerorBeans(db, 20);
      expect(bean.likelyMatch).toMatchObject({ coffeeName: 'Rwanda Gitega 861' });
    });

    // The core safety case this whole feature is built around: this exact
    // coffee was genuinely repurchased 3 separate times, each tracked as
    // its own coffee entry — a repurchase months apart must never be
    // flagged as a likely duplicate of an earlier one.
    it('does NOT flag the same name+roaster when roast dates are months apart (a genuine repurchase)', () => {
      const db = createDb(':memory:');
      createCoffee(db, {
        roaster: 'The Picky Chemist',
        coffee_name: 'El Dorado Double Ferment Washed Gesha',
        origin: null,
        roast_level: null,
        processing: null,
        amount_g: null,
        cost: null,
        roast_date: '2026-04-04',
        frozen_start_date: null,
        frozen_end_date: null,
        rest_days_low: null,
        rest_days_high: null,
        image_url: null
      });
      importBean(db, {
        id: 'b1',
        name: 'El Dorado Double Ferment Washed Gesha',
        roaster: 'The Picky Chemist',
        roastDate: '2026-06-13'
      });
      const [bean] = getUnmatchedBeanConquerorBeans(db, 20);
      expect(bean.likelyMatch).toBeNull();
    });

    // The other real failure mode this heuristic must avoid: two genuinely
    // different processing lots of the same named coffee, bought weeks
    // apart, must not be flagged just because only one word differs.
    it('does NOT flag two different processing lots of the same coffee outside the date window', () => {
      const db = createDb(':memory:');
      createCoffee(db, {
        roaster: 'Shoebox',
        coffee_name: 'Colombia Marlon Bolaños Gesha Natural',
        origin: null,
        roast_level: null,
        processing: null,
        amount_g: null,
        cost: null,
        roast_date: '2026-05-05',
        frozen_start_date: null,
        frozen_end_date: null,
        rest_days_low: null,
        rest_days_high: null,
        image_url: null
      });
      importBean(db, {
        id: 'b1',
        name: 'Colombia Marlon Bolaños Gesha Washed',
        roaster: 'Shoebox',
        roastDate: '2026-06-08'
      });
      const [bean] = getUnmatchedBeanConquerorBeans(db, 20);
      expect(bean.likelyMatch).toBeNull();
    });

    it('does NOT flag a different roaster even with an identical name and roast date', () => {
      const db = createDb(':memory:');
      createCoffee(db, {
        roaster: 'Roaster A',
        coffee_name: 'Same Name',
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
      importBean(db, { id: 'b1', name: 'Same Name', roaster: 'Roaster B', roastDate: '2026-06-01' });
      const [bean] = getUnmatchedBeanConquerorBeans(db, 20);
      expect(bean.likelyMatch).toBeNull();
    });
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

const NOTHING = { beans: [], beanOrigins: [], methods: [], grinders: [], brews: [] };
type BrewRow = { id: number; bc_uuid: string | null; rating: number | null; water_id: string | null; water: string | null; best_brew: number; favourite: number; vessel_name: string | null; has_flow_profile: number; first_drip_time: string | null; bc_created_at: string };
const brewRows = (db: ReturnType<typeof createDb>) =>
  db.prepare(`SELECT id, bc_uuid, rating, water_id, water, best_brew, favourite, vessel_name, has_flow_profile, first_drip_time, bc_created_at FROM beanconqueror_brews ORDER BY id`).all() as BrewRow[];

describe('importBeanConquerorData: brew identity by bc_uuid', () => {
  it('a UUID brew claims the legacy (xlsx) row with the same key and backfills bc_uuid', () => {
    const db = createDb(':memory:');
    importBeanConquerorData(db, { ...NOTHING, brews: [BASE_BREW] });
    const [legacy] = brewRows(db);
    importBeanConquerorData(db, { ...NOTHING, brews: [{ ...BASE_BREW, bcUuid: 'u1', rating: 8 }] });
    expect(brewRows(db)).toMatchObject([{ id: legacy.id, bc_uuid: 'u1', rating: 8 }]);
  });

  it('keeps two brews with the same second and bean as two rows (one claims, one inserts)', () => {
    const db = createDb(':memory:');
    importBeanConquerorData(db, { ...NOTHING, brews: [BASE_BREW] }); // the xlsx merged them into one
    importBeanConquerorData(db, {
      ...NOTHING,
      brews: [{ ...BASE_BREW, bcUuid: 'u1' }, { ...BASE_BREW, bcUuid: 'u2', rating: 9 }]
    });
    expect(brewRows(db).map((r) => [r.bc_uuid, r.rating])).toEqual([['u1', 7], ['u2', 9]]);
  });

  it('identifies a brew by bc_uuid on re-import, even if its timestamp changed', () => {
    const db = createDb(':memory:');
    importBeanConquerorData(db, { ...NOTHING, brews: [{ ...BASE_BREW, bcUuid: 'u1' }] });
    importBeanConquerorData(db, { ...NOTHING, brews: [{ ...BASE_BREW, bcUuid: 'u1', bcCreatedAt: '2026-06-01T12:05:00.000Z' }] });
    expect(brewRows(db)).toMatchObject([{ bc_uuid: 'u1', bc_created_at: '2026-06-01T12:05:00.000Z' }]);
  });
});

describe('importBeanConquerorData: waters and new brew fields', () => {
  const water = { id: 'w1', name: 'Lotus - Mg/K 60/10', calcium: 0, magnesium: 14.6, sodium: 0, potassium: 7.8, chloride: 42.5, sulfate: 0, tds: 0, storedGh: 60, storedGhType: 'PPM', storedKh: 10, storedKhType: 'PPM', type: 'CUSTOM_WATER', note: 'Mg 6, K 2', bcArchived: false };

  it('upserts waters and stores water_id, best_brew, favourite, vessel, flow profile, first drip', () => {
    const db = createDb(':memory:');
    const brew = { ...BASE_BREW, bcUuid: 'u1', water: 'Lotus - Mg/K 60/10', waterId: 'w1', bestBrew: true, favourite: true, vesselName: 'Carafe', hasFlowProfile: true, firstDripTime: '12' };
    importBeanConquerorData(db, { ...NOTHING, waters: [water], brews: [brew] });
    importBeanConquerorData(db, { ...NOTHING, waters: [{ ...water, name: 'Renamed' }], brews: [{ ...brew, water: 'Renamed' }] });
    expect(db.prepare(`SELECT id, name, magnesium, stored_gh, stored_gh_type, stored_kh, bc_archived FROM beanconqueror_waters`).all()).toEqual([
      { id: 'w1', name: 'Renamed', magnesium: 14.6, stored_gh: 60, stored_gh_type: 'PPM', stored_kh: 10, bc_archived: 0 }
    ]);
    expect(brewRows(db)).toMatchObject([
      { bc_uuid: 'u1', water_id: 'w1', water: 'Renamed', best_brew: 1, favourite: 1, vessel_name: 'Carafe', has_flow_profile: 1, first_drip_time: '12' }
    ]);
  });
});

describe('derived bean uuid and blank filling', () => {
  const bean = (o: Record<string, unknown>) => ({ id: 'x', name: 'Bean', roaster: 'R', roastDate: '2026-06-01', roastType: null, degreeOfRoast: null, customDegreeOfRoast: null, blend: null, weightG: null, cost: null, aromatics: null, cuppingPoints: null, decaffeinated: false, url: null, eanArticleNumber: null, notes: null, rating: null, bcCreatedAt: null, bcArchived: false, ...o });
  const origin = (o: Record<string, unknown>) => ({ beanId: 'x', componentNumber: 0, country: null, region: null, farm: null, farmer: null, elevation: null, variety: null, processing: null, certification: null, harvested: null, percentage: null, ...o });
  const input = { roaster: 'R', coffee_name: 'Same', origin: null, roast_level: null, processing: null, amount_g: null, cost: null, roast_date: '2026-06-01', frozen_start_date: null, frozen_end_date: null, rest_days_low: null, rest_days_high: null, image_url: null };
  const empty = { methods: [], grinders: [], brews: [] };
  const linked = (db: ReturnType<typeof createDb>, id: string) => (db.prepare('SELECT coffee_id FROM beanconqueror_beans WHERE id = ?').get(id) as { coffee_id: number | null }).coffee_id;

  it('derived uuid links the right bag', () => {
    const db = createDb(':memory:');
    const a = createCoffee(db, input).id;
    const b = createCoffee(db, input).id;
    importBeanConquerorData(db, { ...empty, beanOrigins: [], beans: [bean({ id: coffeeBeanUuid(b) }), bean({ id: coffeeBeanUuid(a) })] });
    expect(linked(db, coffeeBeanUuid(a))).toBe(a);
    expect(linked(db, coffeeBeanUuid(b))).toBe(b);
  });

  it('derived link skips a coffee already linked', () => {
    const db = createDb(':memory:');
    const a = createCoffee(db, input).id;
    importBeanConquerorData(db, { ...empty, beanOrigins: [], beans: [bean({ id: 'other', name: 'Other' })] });
    db.prepare(`UPDATE beanconqueror_beans SET coffee_id = ? WHERE id = 'other'`).run(a);
    importBeanConquerorData(db, { ...empty, beanOrigins: [], beans: [bean({ id: coffeeBeanUuid(a) })] });
    expect(linked(db, coffeeBeanUuid(a))).toBeNull();
    expect(linked(db, 'other')).toBe(a);
  });

  it('import fills a blank and never replaces or blanks', () => {
    const db = createDb(':memory:');
    const a = createCoffee(db, { ...input, origin: 'Kenya', farm: 'Mine' }).id;
    const data = {
      ...empty,
      beans: [bean({ id: coffeeBeanUuid(a), url: 'https://r.example/p' })],
      beanOrigins: [origin({ beanId: coffeeBeanUuid(a), country: 'Peru', farm: 'Theirs', farmer: 'Ana', variety: '', processing: 'Washed, Anaerobic' })]
    };
    importBeanConquerorData(db, data);
    const row = db.prepare('SELECT * FROM coffees WHERE id = ?').get(a) as Record<string, unknown>;
    expect(row).toMatchObject({ origin: 'Kenya', farm: 'Mine', producer: 'Ana', product_url: 'https://r.example/p' });
    expect(row.processing).toBeTruthy();
    expect(row.variety ?? null).toBeNull();
    // second import changes nothing
    const slug = row.slug;
    importBeanConquerorData(db, data);
    expect(db.prepare('SELECT * FROM coffees WHERE id = ?').get(a)).toEqual(row);
    expect(slug).toBe(row.slug);
  });

  it('linked coffee no longer offers Import into BQ', () => {
    const db = createDb(':memory:');
    const a = createCoffee(db, input).id;
    importBeanConquerorData(db, { ...empty, beanOrigins: [], beans: [bean({ id: coffeeBeanUuid(a) })] });
    expect(getBacklogCoffees(db)[0].in_bean_conqueror).toBe(1);
  });
});
