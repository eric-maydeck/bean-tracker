import { describe, it, expect, beforeEach } from 'vitest';
import type { DatabaseSync } from 'node:sqlite';
import { createDb } from './db';
import { createCoffee, getCoffeeById, getRedirectSlug, type NewCoffeeInput } from './coffees';
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

  it('flags two batch entries staging the same brand-new slug against each other', () => {
    const first = createCoffee(db, sampleInput({ coffee_name: 'First' }));
    const second = createCoffee(db, sampleInput({ coffee_name: 'Second' }));
    const changes: CoffeeBatchChange[] = [
      { id: first.id, fields: fieldsFor(first.id, 'brand-new-shared-slug') },
      { id: second.id, fields: fieldsFor(second.id, 'brand-new-shared-slug') }
    ];
    const errors = validateCoffeeBatch(db, changes);
    expect(errors).toHaveLength(2);
    expect(errors.map((e) => e.id).sort()).toEqual([first.id, second.id].sort());
    for (const error of errors) {
      expect(error.error).toMatch(/same batch/i);
    }
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

  it('saves product_url from a staged field edit', () => {
    const { id, slug } = createCoffee(db, sampleInput());
    commitCoffeeBatch(db, [{ id, fields: fieldsFor(id, slug, { product_url: 'https://h.coffee/products/z' }) }]);
    expect(getCoffeeById(db, id)?.product_url).toBe('https://h.coffee/products/z');
  });
});

describe('commitCoffeeBatch: slug follows identity edits', () => {
  it('regenerates the slug on a name change, returns it, and redirects the old one', () => {
    const { id, slug } = createCoffee(db, sampleInput());
    expect(slug).toBe('2026-test-roasters-sample-blend');
    const slugs = commitCoffeeBatch(db, [{ id, fields: fieldsFor(id, slug, { coffee_name: 'Kenya Kiambu' }) }]);
    expect(slugs).toEqual({ [id]: '2026-test-roasters-kenya-kiambu' });
    expect(getCoffeeById(db, id)?.slug).toBe('2026-test-roasters-kenya-kiambu');
    expect(getRedirectSlug(db, slug)).toBe('2026-test-roasters-kenya-kiambu');
  });

  it('regenerates on a roaster or roast-year change, not on other or cosmetic-only edits', () => {
    const { id, slug } = createCoffee(db, sampleInput());
    commitCoffeeBatch(db, [{ id, fields: fieldsFor(id, slug, { origin: 'Kenya', roast_date: '2026-06-01', roaster: 'TEST ROASTERS' }) }]);
    expect(getCoffeeById(db, id)?.slug).toBe(slug);
    expect(getRedirectSlug(db, slug)).toBeUndefined();
    const byYear = commitCoffeeBatch(db, [{ id, fields: fieldsFor(id, slug, { roast_date: '2025-12-30' }) }]);
    expect(byYear[id]).toBe('2025-test-roasters-sample-blend');
    const byRoaster = commitCoffeeBatch(db, [{ id, fields: fieldsFor(id, byYear[id], { roast_date: '2025-12-30', roaster: 'Sey' }) }]);
    expect(byRoaster[id]).toBe('2025-sey-sample-blend');
  });

  it('keeps a slug the user typed in the same save (and still redirects the old one)', () => {
    const { id, slug } = createCoffee(db, sampleInput());
    commitCoffeeBatch(db, [{ id, fields: fieldsFor(id, 'my-kenya', { coffee_name: 'Kenya Kiambu' }) }]);
    expect(getCoffeeById(db, id)?.slug).toBe('my-kenya');
    expect(getRedirectSlug(db, slug)).toBe('my-kenya');
  });

  it('resolves a chain of renames to the current slug', () => {
    const { id, slug: a } = createCoffee(db, sampleInput());
    const b = commitCoffeeBatch(db, [{ id, fields: fieldsFor(id, a, { coffee_name: 'B' }) }])[id];
    const c = commitCoffeeBatch(db, [{ id, fields: fieldsFor(id, b, { coffee_name: 'C' }) }])[id];
    expect(getRedirectSlug(db, a)).toBe(c);
    expect(getRedirectSlug(db, b)).toBe(c);
  });

  it("counts old slugs as taken: an identical new coffee gets -2, and staging another coffee's old slug is rejected", () => {
    const { id, slug } = createCoffee(db, sampleInput());
    commitCoffeeBatch(db, [{ id, fields: fieldsFor(id, slug, { coffee_name: 'Renamed' }) }]);
    expect(createCoffee(db, sampleInput()).slug).toBe(`${slug}-2`);
    const other = createCoffee(db, sampleInput({ coffee_name: 'Other' }));
    expect(validateCoffeeBatch(db, [{ id: other.id, fields: fieldsFor(other.id, slug, { coffee_name: 'Other' }) }])).toEqual([
      { id: other.id, error: 'That URL is already in use by another coffee' }
    ]);
  });

  it('lets a coffee rename back to its own old slug, dropping that redirect', () => {
    const { id, slug } = createCoffee(db, sampleInput());
    const renamed = commitCoffeeBatch(db, [{ id, fields: fieldsFor(id, slug, { coffee_name: 'Renamed' }) }])[id];
    commitCoffeeBatch(db, [{ id, fields: fieldsFor(id, renamed) }]); // name back to 'Sample Blend'
    expect(getCoffeeById(db, id)?.slug).toBe(slug);
    expect(getRedirectSlug(db, slug)).toBeUndefined();
    expect(getRedirectSlug(db, renamed)).toBe(slug);
  });

  it("drops a deleted coffee's redirects", () => {
    const { id, slug } = createCoffee(db, sampleInput());
    commitCoffeeBatch(db, [{ id, fields: fieldsFor(id, slug, { coffee_name: 'Renamed' }) }]);
    commitCoffeeBatch(db, [{ id, statusAction: 'delete' }]);
    expect((db.prepare('SELECT COUNT(*) AS n FROM slug_redirects').get() as { n: number }).n).toBe(0);
    expect(getRedirectSlug(db, slug)).toBeUndefined();
  });

  // Controller ruling: auto-regeneration only ever replaces a slug that is
  // itself auto-generated. A slug the user set earlier survives an identity
  // edit that would otherwise change the base slug.
  it('preserves a custom slug across an identity edit that would otherwise regenerate it', () => {
    const { id, slug } = createCoffee(db, sampleInput());
    commitCoffeeBatch(db, [{ id, fields: fieldsFor(id, 'my-custom-slug') }]);
    expect(getCoffeeById(db, id)?.slug).toBe('my-custom-slug');

    const slugs = commitCoffeeBatch(db, [{ id, fields: fieldsFor(id, 'my-custom-slug', { coffee_name: 'Kenya Kiambu' }) }]);

    expect(slugs).toEqual({ [id]: 'my-custom-slug' });
    expect(getCoffeeById(db, id)?.slug).toBe('my-custom-slug');
    expect(getRedirectSlug(db, slug)).toBe('my-custom-slug');
  });
});
