import { describe, it, expect } from 'vitest';
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
