import { describe, it, expect } from 'vitest';
import { isActionFailure } from '@sveltejs/kit';
import { createDb } from './db';
import { getCoffeeById, createCoffee } from './coffees';
import { handleCoffeeCreate, handleCoffeeSave } from './coffeeFormActions';

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

describe('handleCoffeeSave', () => {
  it('updates an existing coffee and returns its slug', async () => {
    const db = createDb(':memory:');
    const { id, slug } = createCoffee(db, {
      roaster: 'Original Roaster',
      coffee_name: 'Original Name',
      origin: null,
      roast_level: null,
      processing: null,
      amount_g: null,
      cost: null,
      roast_date: null,
      frozen_start_date: null,
      frozen_end_date: null,
      rest_days_low: null,
      rest_days_high: null,
      image_url: null
    });
    const result = await handleCoffeeSave(
      db,
      formData({ ...validFields, coffee_name: 'Updated Name', id: String(id), slug })
    );
    expect(result).toEqual({ success: true, slug });
    expect(getCoffeeById(db, id)?.coffee_name).toBe('Updated Name');
  });

  it('fails when the slug is missing', async () => {
    const db = createDb(':memory:');
    const { id } = createCoffee(db, {
      roaster: 'R',
      coffee_name: 'C',
      origin: null,
      roast_level: null,
      processing: null,
      amount_g: null,
      cost: null,
      roast_date: null,
      frozen_start_date: null,
      frozen_end_date: null,
      rest_days_low: null,
      rest_days_high: null,
      image_url: null
    });
    const result = await handleCoffeeSave(db, formData({ ...validFields, id: String(id), slug: '' }));
    expect(isActionFailure(result)).toBe(true);
    if (isActionFailure(result)) expect(result.status).toBe(400);
  });

  it('fails when the requested slug is already used by another coffee', async () => {
    const db = createDb(':memory:');
    // Capture the actual generated slug rather than guessing it — createCoffee
    // prefixes it with the current year (see generateBaseSlug), so a literal
    // guess like 'other-other-coffee' would silently not collide and this
    // test would pass for the wrong reason.
    const { slug: otherSlug } = createCoffee(db, {
      roaster: 'Other',
      coffee_name: 'Other Coffee',
      origin: null,
      roast_level: null,
      processing: null,
      amount_g: null,
      cost: null,
      roast_date: null,
      frozen_start_date: null,
      frozen_end_date: null,
      rest_days_low: null,
      rest_days_high: null,
      image_url: null
    });
    const { id } = createCoffee(db, {
      roaster: 'R',
      coffee_name: 'C',
      origin: null,
      roast_level: null,
      processing: null,
      amount_g: null,
      cost: null,
      roast_date: null,
      frozen_start_date: null,
      frozen_end_date: null,
      rest_days_low: null,
      rest_days_high: null,
      image_url: null
    });
    const result = await handleCoffeeSave(db, formData({ ...validFields, id: String(id), slug: otherSlug }));
    expect(isActionFailure(result)).toBe(true);
    if (isActionFailure(result)) expect(result.data?.error).toMatch(/already in use/i);
  });
});
