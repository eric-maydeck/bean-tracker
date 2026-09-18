import { describe, it, expect, beforeEach } from 'vitest';
import type { DatabaseSync } from 'node:sqlite';
import { createDb } from './db';
import {
  createCoffee,
  updateCoffee,
  getBacklogCoffees,
  getOpenCoffees,
  getArchivedCoffees,
  getNonArchivedCoffees,
  getCoffeeById,
  getCoffeeBySlug,
  openCoffee,
  unopenCoffee,
  freezeCoffee,
  thawCoffee,
  archiveCoffee,
  restoreCoffee,
  deleteCoffee,
  getDistinctFieldValues,
  type NewCoffeeInput
} from './coffees';
import { withComputedFields } from './urgency';

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

let db: DatabaseSync;

beforeEach(() => {
  db = createDb(':memory:');
});

describe('createCoffee', () => {
  it('creates a coffee as backlog by default, with a generated slug', () => {
    const { id, slug } = createCoffee(db, sampleInput());
    expect(getBacklogCoffees(db)).toHaveLength(1);
    expect(slug).toBe('2026-test-roasters-sample-blend');
    expect(getCoffeeById(db, id)?.slug).toBe(slug);
  });

  it('creates a coffee directly as open or archive when status is passed', () => {
    const { id } = createCoffee(db, { ...sampleInput(), status: 'archive' });
    expect(getArchivedCoffees(db)).toHaveLength(1);
    expect(getCoffeeById(db, id)?.drank).toBe(1);
  });

  it('dedupes slugs for coffees with the same roaster/name/year', () => {
    const first = createCoffee(db, sampleInput());
    const second = createCoffee(db, sampleInput());
    expect(second.slug).toBe(`${first.slug}-2`);
  });
});

describe('getCoffeeBySlug', () => {
  it('returns the coffee with that slug', () => {
    const { slug } = createCoffee(db, sampleInput());
    expect(getCoffeeBySlug(db, slug)?.coffee_name).toBe('Sample Blend');
  });

  it('returns undefined for an unknown slug', () => {
    expect(getCoffeeBySlug(db, 'nope')).toBeUndefined();
  });
});

describe('updateCoffee', () => {
  it('overwrites the editable fields and the slug', () => {
    const { id } = createCoffee(db, sampleInput());
    updateCoffee(db, id, sampleInput({ coffee_name: 'Renamed Blend', cost: 22 }), 'custom-slug');
    const found = getCoffeeById(db, id);
    expect(found?.coffee_name).toBe('Renamed Blend');
    expect(found?.cost).toBe(22);
    expect(found?.slug).toBe('custom-slug');
  });
});

describe('status queries', () => {
  it('separates backlog, open, archive, and non-archived coffees', () => {
    createCoffee(db, sampleInput({ coffee_name: 'A' }));
    const { id: openId } = createCoffee(db, sampleInput({ coffee_name: 'B' }));
    openCoffee(db, openId);
    createCoffee(db, sampleInput({ coffee_name: 'C', status: 'archive' }));

    expect(getBacklogCoffees(db)).toHaveLength(1);
    expect(getOpenCoffees(db)).toHaveLength(1);
    expect(getArchivedCoffees(db)).toHaveLength(1);
    expect(getNonArchivedCoffees(db)).toHaveLength(2);
  });

  it('orders results by roaster then coffee name, case-insensitively', () => {
    createCoffee(db, sampleInput({ roaster: 'zeta roasters', coffee_name: 'Blend' }));
    createCoffee(db, sampleInput({ roaster: 'Alpha Roasters', coffee_name: 'Blend' }));
    createCoffee(db, sampleInput({ roaster: 'Alpha Roasters', coffee_name: 'apple' }));
    createCoffee(db, sampleInput({ roaster: 'Alpha Roasters', coffee_name: 'Banana' }));

    const names = getBacklogCoffees(db).map((c) => `${c.roaster}/${c.coffee_name}`);
    expect(names).toEqual([
      'Alpha Roasters/apple',
      'Alpha Roasters/Banana',
      'Alpha Roasters/Blend',
      'zeta roasters/Blend'
    ]);
  });
});

describe('deleteCoffee', () => {
  it('permanently removes the coffee', () => {
    const { id } = createCoffee(db, sampleInput());
    deleteCoffee(db, id);
    expect(getCoffeeById(db, id)).toBeUndefined();
    expect(getBacklogCoffees(db)).toHaveLength(0);
  });
});

describe('getDistinctFieldValues', () => {
  it('returns sorted, deduped, non-empty values for the given column', () => {
    createCoffee(db, sampleInput({ roaster: 'Shoebox' }));
    createCoffee(db, sampleInput({ roaster: 'Shoebox' }));
    createCoffee(db, sampleInput({ roaster: 'Lume' }));
    createCoffee(db, sampleInput({ roaster: 'Anchorhead', origin: null }));

    expect(getDistinctFieldValues(db, 'roaster')).toEqual(['Anchorhead', 'Lume', 'Shoebox']);
    expect(getDistinctFieldValues(db, 'origin')).toEqual(['Ethiopia']);
  });
});

describe('openCoffee', () => {
  it('moves backlog to open and sets opened_date', () => {
    const { id } = createCoffee(db, sampleInput());
    openCoffee(db, id);
    const found = getCoffeeById(db, id);
    expect(found?.status).toBe('open');
    expect(found?.opened_date).not.toBeNull();
  });

  it('clears frozen_end_date to today if the coffee was frozen and not yet thawed', () => {
    const { id } = createCoffee(db, sampleInput());
    freezeCoffee(db, id);
    expect(getCoffeeById(db, id)?.frozen_end_date).toBeNull();
    openCoffee(db, id);
    const found = getCoffeeById(db, id);
    expect(found?.frozen_start_date).not.toBeNull();
    expect(found?.frozen_end_date).not.toBeNull();
  });

  it('does not touch frozen_end_date if the coffee was never frozen', () => {
    const { id } = createCoffee(db, sampleInput());
    openCoffee(db, id);
    expect(getCoffeeById(db, id)?.frozen_end_date).toBeNull();
  });
});

describe('unopenCoffee', () => {
  it('moves an open coffee back to backlog and clears opened_date', () => {
    const { id } = createCoffee(db, sampleInput());
    openCoffee(db, id);
    unopenCoffee(db, id);
    const found = getCoffeeById(db, id);
    expect(found?.status).toBe('backlog');
    expect(found?.opened_date).toBeNull();
  });

  it('is a no-op on a coffee that is not open', () => {
    const { id } = createCoffee(db, sampleInput());
    unopenCoffee(db, id);
    expect(getCoffeeById(db, id)?.status).toBe('backlog');
  });
});

describe('freezeCoffee / thawCoffee', () => {
  it('sets frozen_start_date and frozen_end_date independently', () => {
    const { id } = createCoffee(db, sampleInput());
    freezeCoffee(db, id);
    expect(getCoffeeById(db, id)?.frozen_start_date).not.toBeNull();
    expect(getCoffeeById(db, id)?.frozen_end_date).toBeNull();
    thawCoffee(db, id);
    expect(getCoffeeById(db, id)?.frozen_end_date).not.toBeNull();
  });
});

describe('archiveCoffee / restoreCoffee', () => {
  it('moves a coffee to archive and back to backlog', () => {
    const { id } = createCoffee(db, sampleInput());
    archiveCoffee(db, id);
    expect(getArchivedCoffees(db)).toHaveLength(1);
    expect(getCoffeeById(db, id)?.moved_date).not.toBeNull();
    expect(getCoffeeById(db, id)?.drank).toBe(1);

    restoreCoffee(db, id);
    expect(getBacklogCoffees(db)).toHaveLength(1);
    expect(getCoffeeById(db, id)?.moved_date).toBeNull();
    expect(getCoffeeById(db, id)?.drank).toBe(0);
  });

  it('archives an open coffee directly', () => {
    const { id } = createCoffee(db, sampleInput());
    openCoffee(db, id);
    archiveCoffee(db, id);
    expect(getArchivedCoffees(db)).toHaveLength(1);
  });
});

describe('regression: frozen dates written by coffees.ts stay parseable by urgency.ts', () => {
  // urgency.ts's parseDate() splits on '-' expecting YYYY-MM-DD only; a full ISO
  // timestamp in frozen_start_date/frozen_end_date breaks it. These tests prove the
  // date format written by freeze/thaw/open round-trips through withComputedFields
  // without throwing.
  it('freezeCoffee writes a date-only frozen_start_date usable by withComputedFields', () => {
    const { id } = createCoffee(db, sampleInput());
    freezeCoffee(db, id);
    const row = getCoffeeById(db, id)!;
    expect(row.frozen_start_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);

    let computed;
    expect(() => {
      computed = withComputedFields(row, new Date());
    }).not.toThrow();
    expect(computed!.urgency_rating === 'Done' || Number.isFinite(computed!.urgency_rating)).toBe(true);
  });

  it('thawCoffee writes a date-only frozen_end_date usable by withComputedFields', () => {
    const { id } = createCoffee(db, sampleInput());
    freezeCoffee(db, id);
    thawCoffee(db, id);
    const row = getCoffeeById(db, id)!;
    expect(row.frozen_end_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);

    let computed;
    expect(() => {
      computed = withComputedFields(row, new Date());
    }).not.toThrow();
    expect(computed!.urgency_rating === 'Done' || Number.isFinite(computed!.urgency_rating)).toBe(true);
  });

  it('openCoffee auto-thaw writes a date-only frozen_end_date usable by withComputedFields', () => {
    const { id } = createCoffee(db, sampleInput());
    freezeCoffee(db, id);
    openCoffee(db, id);
    const row = getCoffeeById(db, id)!;
    expect(row.frozen_end_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);

    let computed;
    expect(() => {
      computed = withComputedFields(row, new Date());
    }).not.toThrow();
    expect(computed!.urgency_rating === 'Done' || Number.isFinite(computed!.urgency_rating)).toBe(true);
  });
});
