import { describe, it, expect } from 'vitest';
import type { DatabaseSync } from 'node:sqlite';
import { getRoasterImage } from './roasterImages';
import { isActionFailure } from '@sveltejs/kit';
import { createDb } from './db';
import { handleCoffeeCreate, handleCoffeeCreateAndLink } from './coffeeFormActions';
import { importBeanConquerorData } from './beanconqueror';

function formData(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    fd.set(key, value);
  }
  return fd;
}

const validFields = {
  roaster: 'Test Roasters',
  coffee_name: 'Sample Blend',
  origin: 'Ethiopia',
  roast_level: 'Light',
  processing: 'Washed',
  amount_g: '200',
  cost: '18',
  roast_date: '2026-01-01',
  rest_days_low: '10',
  rest_days_high: '20'
};

describe('handleCoffeeCreate', () => {
  it('creates a coffee row and returns success', async () => {
    const db = createDb(':memory:');
    const result = await handleCoffeeCreate(db, formData(validFields));
    const rows = db.prepare(`SELECT id, slug FROM coffees`).all() as { id: number; slug: string }[];
    expect(rows).toHaveLength(1);
    expect(result).toEqual({ success: true, id: rows[0].id, slug: rows[0].slug });
  });

  it('fails validation when roaster is missing', async () => {
    const db = createDb(':memory:');
    const { roaster: _roaster, ...rest } = validFields;
    const result = await handleCoffeeCreate(db, formData(rest));
    expect(isActionFailure(result)).toBe(true);
    if (isActionFailure(result)) {
      expect(result.status).toBe(400);
      expect(result.data?.error).toMatch(/roaster/i);
    }
  });
});

describe('handleCoffeeCreateAndLink', () => {
  const beanFields = {
    name: 'From BC', roaster: 'Elsewhere', roastDate: null, roastType: null, degreeOfRoast: null, customDegreeOfRoast: null,
    blend: null, weightG: null, cost: null, aromatics: null, cuppingPoints: null, decaffeinated: false, url: null,
    eanArticleNumber: null, notes: null, rating: null, bcCreatedAt: null, bcArchived: false
  };
  function dbWithBean() {
    const db = createDb(':memory:');
    importBeanConquerorData(db, { beans: [{ id: 'b1', ...beanFields }], beanOrigins: [], methods: [], grinders: [], brews: [] });
    return db;
  }
  const link = (db: ReturnType<typeof createDb>) =>
    (db.prepare(`SELECT coffee_id FROM beanconqueror_beans WHERE id = 'b1'`).get() as { coffee_id: number | null }).coffee_id;

  it('creates the coffee and links the bean', () => {
    const db = dbWithBean();
    const result = handleCoffeeCreateAndLink(db, formData({ ...validFields, beanconqueror_id: 'b1' }));
    expect(isActionFailure(result)).toBe(false);
    if ('id' in result) expect(link(db)).toBe(result.id);
  });

  it('creates nothing when the bean is already linked (one transaction)', () => {
    const db = dbWithBean();
    handleCoffeeCreateAndLink(db, formData({ ...validFields, beanconqueror_id: 'b1' }));
    const result = handleCoffeeCreateAndLink(db, formData({ ...validFields, coffee_name: 'Second', beanconqueror_id: 'b1' }));
    expect(result).toMatchObject({ status: 400, data: { error: expect.stringMatching(/already linked/) } });
    expect((db.prepare(`SELECT COUNT(*) c FROM coffees`).get() as { c: number }).c).toBe(1);
  });

  it('without a bean id it is a plain create', () => {
    const db = dbWithBean();
    handleCoffeeCreateAndLink(db, formData(validFields));
    expect(link(db)).toBeNull();
  });
});

describe('handleCoffeeCreate: set_roaster_default', () => {
  const LOGO = 'https://img.example/norml.png';
  const defaults = (db: DatabaseSync) => db.prepare(`SELECT roaster, image_url FROM roaster_images`).all();
  const coffeeImage = (db: DatabaseSync) => db.prepare(`SELECT image_url FROM coffees`).get();

  it("saves the default and stores the coffee's image as NULL", () => {
    const db = createDb(':memory:');
    const result = handleCoffeeCreate(db, formData({ ...validFields, roaster: 'Norml', image_url: LOGO, set_roaster_default: '1' }));
    expect(result).toMatchObject({ success: true });
    expect(getRoasterImage(db, 'Norml')).toBe(LOGO);
    expect(coffeeImage(db)).toEqual({ image_url: null });
  });

  it('leaves roaster_images alone without the flag', () => {
    const db = createDb(':memory:');
    handleCoffeeCreate(db, formData({ ...validFields, roaster: 'Norml', image_url: LOGO }));
    expect(defaults(db)).toEqual([]);
    expect(coffeeImage(db)).toEqual({ image_url: LOGO });
  });

  it('ignores the flag when the image is empty', () => {
    const db = createDb(':memory:');
    handleCoffeeCreate(db, formData({ ...validFields, roaster: 'Norml', image_url: '', set_roaster_default: '1' }));
    expect(defaults(db)).toEqual([]);
  });

  it('rolls the default back when the coffee insert fails', () => {
    const db = createDb(':memory:');
    db.exec(`CREATE TRIGGER no_insert BEFORE INSERT ON coffees BEGIN SELECT RAISE(ABORT, 'boom'); END`);
    expect(() =>
      handleCoffeeCreate(db, formData({ ...validFields, roaster: 'Norml', image_url: LOGO, set_roaster_default: '1' }))
    ).toThrow('boom');
    expect(defaults(db)).toEqual([]);
  });

  it("works inside handleCoffeeCreateAndLink's transaction", () => {
    const db = createDb(':memory:');
    db.prepare(`INSERT INTO beanconqueror_beans (id, name, imported_at) VALUES ('b1', 'x', 'x')`).run();
    const result = handleCoffeeCreateAndLink(
      db,
      formData({ ...validFields, roaster: 'Norml', image_url: LOGO, set_roaster_default: '1', beanconqueror_id: 'b1' })
    );
    expect(result).toMatchObject({ success: true });
    expect(getRoasterImage(db, 'Norml')).toBe(LOGO);
    expect(db.prepare(`SELECT coffee_id FROM beanconqueror_beans WHERE id = 'b1'`).get()).toEqual({
      coffee_id: (result as { id: number }).id
    });
  });
});
