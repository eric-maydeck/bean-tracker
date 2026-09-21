import { describe, it, expect } from 'vitest';
import { isActionFailure } from '@sveltejs/kit';
import { createDb } from './db';
import { handleCoffeeCreate } from './coffeeFormActions';

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
    expect(result).toEqual({ success: true });
    const rows = db.prepare(`SELECT * FROM coffees`).all();
    expect(rows).toHaveLength(1);
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
