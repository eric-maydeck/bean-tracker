import { describe, it, expect, beforeEach } from 'vitest';
import type { DatabaseSync } from 'node:sqlite';
import { createDb } from './db';
import { createCoffee, getCoffeeById, type NewCoffeeInput } from './coffees';
import { validateCoffeeBatch, commitCoffeeBatch, type CoffeeBatchChange } from './coffeeBatchActions';

function sampleInput(overrides: Partial<NewCoffeeInput> = {}): NewCoffeeInput {
  return {
    roaster: 'Test Roasters',
    coffee_name: 'Sample Blend',
    origin: 'Ethiopia',
    roast_level: 'Light',
    processing: 'Washed',
    amount_g: 200,
    cost: 18,
    roast_date: '2026-01-01',
    frozen_start_date: null,
    frozen_end_date: null,
    rest_days_low: 10,
    rest_days_high: 20,
    image_url: null,
    ...overrides
  };
}

function fieldsFor(id: number, slug: string, overrides: Record<string, string> = {}): Record<string, string> {
  return {
    id: String(id),
    roaster: 'Test Roasters',
    coffee_name: 'Sample Blend',
    origin: 'Ethiopia',
    roast_level: 'Light',
    processing: 'Washed',
    amount_g: '200',
    cost: '18',
    roast_date: '2026-01-01',
    slug,
    ...overrides
  };
}

let db: DatabaseSync;

beforeEach(() => {
  db = createDb(':memory:');
});

describe('validateCoffeeBatch', () => {
  it('returns no errors for a batch of valid field edits', () => {
    const { id, slug } = createCoffee(db, sampleInput());
    const changes: CoffeeBatchChange[] = [{ id, fields: fieldsFor(id, slug, { roaster: 'Renamed' }) }];
    expect(validateCoffeeBatch(db, changes)).toEqual([]);
  });

  it('returns no errors for entries that only have a status action (no fields)', () => {
    const { id } = createCoffee(db, sampleInput());
    const changes: CoffeeBatchChange[] = [{ id, statusAction: 'archive' }];
    expect(validateCoffeeBatch(db, changes)).toEqual([]);
  });

  it('flags a missing required field', () => {
    const { id, slug } = createCoffee(db, sampleInput());
    const changes: CoffeeBatchChange[] = [{ id, fields: fieldsFor(id, slug, { roaster: '' }) }];
    const errors = validateCoffeeBatch(db, changes);
    expect(errors).toHaveLength(1);
    expect(errors[0].id).toBe(id);
    expect(errors[0].error).toMatch(/roaster/i);
  });

  it('flags a duplicate slug against another coffee', () => {
    const first = createCoffee(db, sampleInput({ coffee_name: 'First' }));
    const second = createCoffee(db, sampleInput({ coffee_name: 'Second' }));
    const changes: CoffeeBatchChange[] = [{ id: second.id, fields: fieldsFor(second.id, first.slug) }];
    const errors = validateCoffeeBatch(db, changes);
    expect(errors).toHaveLength(1);
    expect(errors[0].id).toBe(second.id);
    expect(errors[0].error).toMatch(/already in use/i);
  });

  it('does not write anything to the database', () => {
    const { id, slug } = createCoffee(db, sampleInput());
    validateCoffeeBatch(db, [{ id, fields: fieldsFor(id, slug, { roaster: 'Should Not Persist' }) }]);
    expect(getCoffeeById(db, id)?.roaster).toBe('Test Roasters');
  });

  it('collects errors from multiple entries independently', () => {
    const a = createCoffee(db, sampleInput({ coffee_name: 'A' }));
    const b = createCoffee(db, sampleInput({ coffee_name: 'B' }));
    const changes: CoffeeBatchChange[] = [
      { id: a.id, fields: fieldsFor(a.id, a.slug, { roaster: '' }) },
      { id: b.id, fields: fieldsFor(b.id, b.slug, { coffee_name: '' }) }
    ];
    const errors = validateCoffeeBatch(db, changes);
    expect(errors.map((e) => e.id).sort()).toEqual([a.id, b.id].sort());
  });
});

describe('commitCoffeeBatch', () => {
  it('applies a field edit', () => {
    const { id, slug } = createCoffee(db, sampleInput());
    commitCoffeeBatch(db, [{ id, fields: fieldsFor(id, slug, { roaster: 'Renamed' }) }]);
    expect(getCoffeeById(db, id)?.roaster).toBe('Renamed');
  });

  it('applies a status action', () => {
    const { id } = createCoffee(db, sampleInput());
    commitCoffeeBatch(db, [{ id, statusAction: 'archive' }]);
    expect(getCoffeeById(db, id)?.status).toBe('archive');
  });

  it('applies both a field edit and a status action on the same entry, fields first', () => {
    const { id, slug } = createCoffee(db, sampleInput());
    commitCoffeeBatch(db, [{ id, fields: fieldsFor(id, slug, { roaster: 'Renamed' }), statusAction: 'archive' }]);
    const row = getCoffeeById(db, id);
    expect(row?.roaster).toBe('Renamed');
    expect(row?.status).toBe('archive');
  });

  it('applies a delete', () => {
    const { id } = createCoffee(db, sampleInput());
    commitCoffeeBatch(db, [{ id, statusAction: 'delete' }]);
    expect(getCoffeeById(db, id)).toBeUndefined();
  });

  it('applies every entry in a multi-entry batch', () => {
    const a = createCoffee(db, sampleInput({ coffee_name: 'A' }));
    const b = createCoffee(db, sampleInput({ coffee_name: 'B' }));
    commitCoffeeBatch(db, [
      { id: a.id, statusAction: 'archive' },
      { id: b.id, statusAction: 'archive' }
    ]);
    expect(getCoffeeById(db, a.id)?.status).toBe('archive');
    expect(getCoffeeById(db, b.id)?.status).toBe('archive');
  });

  it('rolls back the entire batch if one entry fails — atomicity', () => {
    const good = createCoffee(db, sampleInput({ coffee_name: 'Good' }));
    const BAD_ID = 999999;
    expect(() =>
      commitCoffeeBatch(db, [
        { id: good.id, statusAction: 'archive' },
        { id: BAD_ID, fields: fieldsFor(BAD_ID, 'nonexistent-slug') }
      ])
    ).toThrow();
    // The first entry's change must NOT have landed, even though it would
    // have succeeded on its own — this is the whole point of wrapping the
    // batch in one transaction.
    expect(getCoffeeById(db, good.id)?.status).toBe('backlog');
  });
});
