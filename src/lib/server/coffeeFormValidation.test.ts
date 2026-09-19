import { describe, it, expect } from 'vitest';
import { parseCoffeeForm, parseSlugField, CoffeeFormError } from './coffeeFormValidation';

function formData(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    fd.set(key, value);
  }
  return fd;
}

describe('parseCoffeeForm', () => {
  it('parses a fully filled-out form', () => {
    const result = parseCoffeeForm(
      formData({
        roaster: 'Test Roasters',
        coffee_name: 'Sample',
        origin: 'Kenya',
        roast_level: 'Light',
        processing: 'Washed',
        amount_g: '200',
        cost: '18.5',
        roast_date: '2026-01-01',
        frozen_start_date: '',
        frozen_end_date: '',
        rest_days_low: '10',
        rest_days_high: '20'
      })
    );
    expect(result.roaster).toBe('Test Roasters');
    expect(result.amount_g).toBe(200);
    expect(result.cost).toBe(18.5);
    expect(result.frozen_start_date).toBeNull();
  });

  it('rejects a missing roaster', () => {
    expect(() => parseCoffeeForm(formData({ roaster: '', coffee_name: 'Sample' }))).toThrow(
      CoffeeFormError
    );
  });

  it('rejects a missing coffee name', () => {
    expect(() => parseCoffeeForm(formData({ roaster: 'Test', coffee_name: '' }))).toThrow(
      CoffeeFormError
    );
  });

  it('rejects a negative amount', () => {
    expect(() =>
      parseCoffeeForm(formData({ roaster: 'Test', coffee_name: 'Sample', amount_g: '-5' }))
    ).toThrow(CoffeeFormError);
  });

  it('rejects a negative cost', () => {
    expect(() =>
      parseCoffeeForm(formData({ roaster: 'Test', coffee_name: 'Sample', cost: '-5' }))
    ).toThrow(CoffeeFormError);
  });

  it('rejects a malformed date', () => {
    expect(() =>
      parseCoffeeForm(formData({ roaster: 'Test', coffee_name: 'Sample', roast_date: 'not-a-date' }))
    ).toThrow(CoffeeFormError);
  });

  it('rejects a non-numeric amount', () => {
    expect(() =>
      parseCoffeeForm(formData({ roaster: 'Test', coffee_name: 'Sample', amount_g: 'lots' }))
    ).toThrow(CoffeeFormError);
  });

  it('treats a checked decaf checkbox as true', () => {
    const result = parseCoffeeForm(formData({ roaster: 'Test', coffee_name: 'Sample', decaf: 'on' }));
    expect(result.decaf).toBe(true);
  });

  it('treats a missing decaf field (unchecked checkbox) as false', () => {
    const result = parseCoffeeForm(formData({ roaster: 'Test', coffee_name: 'Sample' }));
    expect(result.decaf).toBe(false);
  });
});

describe('parseSlugField', () => {
  it('passes through a valid slug unchanged', () => {
    expect(parseSlugField(formData({ slug: 'custom-slug' }))).toBe('custom-slug');
  });

  it('trims surrounding whitespace', () => {
    expect(parseSlugField(formData({ slug: '  custom-slug  ' }))).toBe('custom-slug');
  });

  it('returns null for an empty or whitespace-only slug', () => {
    expect(parseSlugField(formData({ slug: '' }))).toBeNull();
    expect(parseSlugField(formData({ slug: '   ' }))).toBeNull();
  });

  it('returns null when the slug field is missing entirely', () => {
    expect(parseSlugField(formData({}))).toBeNull();
  });
});
