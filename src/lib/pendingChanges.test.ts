import { describe, it, expect } from 'vitest';
import {
  stageFieldChange,
  stageStatusAction,
  clearPending,
  hasPending,
  mergeStagedCoffee,
  clonePrefill,
  stagedRoasterDefault,
  stagedRoasterWebsite,
  type PendingChange
} from './pendingChanges';
import type { CoffeeRow } from './types';

const baseCoffee: CoffeeRow = {
  id: 1,
  roaster: 'Sey',
  coffee_name: 'Ethiopia Guji',
  origin: 'Ethiopia',
  roast_level: 'Light',
  processing: 'Washed',
  amount_g: 250,
  cost: 20,
  roast_date: '2026-01-01',
  frozen_start_date: null,
  frozen_end_date: null,
  rest_days_low: 7,
  rest_days_high: 14,
  image_url: null,
  product_url: null,
  slug: 'sey-ethiopia-guji',
  opened_date: null,
  drank: 0,
  status: 'backlog',
  moved_date: null,
  decaf: 0,
  subscription_id: null,
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z'
};

describe('stageFieldChange', () => {
  it('adds a field change for a fresh id', () => {
    const pending = new Map<number, PendingChange>();
    stageFieldChange(pending, 1, { roaster: 'Sey' });
    expect(pending.get(1)).toEqual({ fields: { roaster: 'Sey' } });
  });

  it('preserves an existing pending status action when staging fields for the same id', () => {
    const pending = new Map<number, PendingChange>();
    stageStatusAction(pending, 1, 'archive');
    stageFieldChange(pending, 1, { roaster: 'Sey' });
    expect(pending.get(1)).toEqual({ statusAction: 'archive', fields: { roaster: 'Sey' } });
  });

  it('replaces a previous field change for the same id rather than merging keys', () => {
    const pending = new Map<number, PendingChange>();
    stageFieldChange(pending, 1, { roaster: 'Sey' });
    stageFieldChange(pending, 1, { roaster: 'Scenery' });
    expect(pending.get(1)).toEqual({ fields: { roaster: 'Scenery' } });
  });
});

describe('stageStatusAction', () => {
  it('adds a status action for a fresh id', () => {
    const pending = new Map<number, PendingChange>();
    stageStatusAction(pending, 2, 'open');
    expect(pending.get(2)).toEqual({ statusAction: 'open' });
  });

  it('preserves an existing pending field change when staging a status action for the same id', () => {
    const pending = new Map<number, PendingChange>();
    stageFieldChange(pending, 2, { roaster: 'Sey' });
    stageStatusAction(pending, 2, 'archive');
    expect(pending.get(2)).toEqual({ fields: { roaster: 'Sey' }, statusAction: 'archive' });
  });

  it('replaces a previous status action for the same id rather than accumulating', () => {
    const pending = new Map<number, PendingChange>();
    stageStatusAction(pending, 2, 'open');
    stageStatusAction(pending, 2, 'archive');
    expect(pending.get(2)).toEqual({ statusAction: 'archive' });
  });

  it('un-stages when the same status action is staged twice, removing the entry if no fields remain', () => {
    const pending = new Map<number, PendingChange>();
    stageStatusAction(pending, 2, 'archive');
    stageStatusAction(pending, 2, 'archive');
    expect(pending.has(2)).toBe(false);
  });

  it('un-stages just the status action when the same action is staged twice with fields also present, keeping the fields', () => {
    const pending = new Map<number, PendingChange>();
    stageFieldChange(pending, 2, { roaster: 'Sey' });
    stageStatusAction(pending, 2, 'archive');
    stageStatusAction(pending, 2, 'archive');
    expect(pending.get(2)).toEqual({ fields: { roaster: 'Sey' } });
  });

  it('staging delete clears any existing staged fields for that entry', () => {
    const pending = new Map<number, PendingChange>();
    stageFieldChange(pending, 2, { roaster: 'Sey' });
    stageStatusAction(pending, 2, 'delete');
    expect(pending.get(2)).toEqual({ statusAction: 'delete' });
  });

  it('staging a different (non-repeat) status action does not clear existing staged fields', () => {
    const pending = new Map<number, PendingChange>();
    stageFieldChange(pending, 2, { roaster: 'Sey' });
    stageStatusAction(pending, 2, 'open');
    stageStatusAction(pending, 2, 'archive');
    expect(pending.get(2)).toEqual({ fields: { roaster: 'Sey' }, statusAction: 'archive' });
  });
});

describe('clearPending', () => {
  it('removes the entry for the given id entirely', () => {
    const pending = new Map<number, PendingChange>();
    stageStatusAction(pending, 3, 'delete');
    clearPending(pending, 3);
    expect(pending.has(3)).toBe(false);
  });

  it('is a no-op for an id with no pending entry', () => {
    const pending = new Map<number, PendingChange>();
    expect(() => clearPending(pending, 999)).not.toThrow();
    expect(pending.size).toBe(0);
  });
});

describe('hasPending', () => {
  it('is false for an empty map', () => {
    expect(hasPending(new Map())).toBe(false);
  });

  it('is true once any entry exists', () => {
    const pending = new Map<number, PendingChange>();
    stageStatusAction(pending, 1, 'open');
    expect(hasPending(pending)).toBe(true);
  });
});

describe('mergeStagedCoffee', () => {
  it('returns the original coffee unchanged when there are no pending fields', () => {
    expect(mergeStagedCoffee(baseCoffee, undefined)).toEqual(baseCoffee);
  });

  // The form always sends image_source_url (empty = cleared): typing a new image clears it, and a
  // staged merge must not bring the stored coffee's old source back.
  it('a staged empty image_source_url overrides the stored one', () => {
    const stored = { ...baseCoffee, image_url: 'https://x/old.jpg', image_source_url: 'https://shop.com/p' };
    const merged = mergeStagedCoffee(stored, { image_url: 'https://x/new.jpg', image_source_url: '' });
    expect(merged.image_source_url).toBe('');
    expect(clonePrefill(merged).image_source_url).toBe('');
  });

  it('merges a staged non-checkbox field over the original', () => {
    const result = mergeStagedCoffee(baseCoffee, { roaster: 'Scenery' });
    expect(result.roaster).toBe('Scenery');
  });

  // The bug this guards against (8a0e889): FormData represents a checked
  // checkbox as the string "on" — decaf must come back as 1, not the
  // literal string, or CoffeeForm's `checked={coffee?.decaf === 1}` fails.
  it('normalizes a staged checked decaf checkbox ("on") to 1', () => {
    const result = mergeStagedCoffee(baseCoffee, { decaf: 'on' });
    expect(result.decaf).toBe(1);
  });

  // FormData omits an unchecked checkbox entirely — the staged fields
  // object won't have a decaf key at all in that case, and that absence
  // (not any particular value) must map to 0.
  it('normalizes a staged unchecked decaf checkbox (key absent) to 0', () => {
    const checkedCoffee: CoffeeRow = { ...baseCoffee, decaf: 1 };
    const result = mergeStagedCoffee(checkedCoffee, { roaster: 'Scenery' });
    expect(result.decaf).toBe(0);
  });
});

describe('clonePrefill', () => {
  const source: CoffeeRow = {
    ...baseCoffee,
    id: 42,
    image_url: 'https://example.com/label.png',
    product_url: 'https://sey.coffee/products/guji',
    decaf: 1,
    frozen_start_date: '2026-02-01',
    frozen_end_date: '2026-03-01',
    opened_date: '2026-03-02',
    drank: 1,
    status: 'archive',
    moved_date: '2026-03-10'
  };

  it('copies exactly the bag-describing fields', () => {
    expect(clonePrefill(source)).toEqual({
      roaster: 'Sey',
      coffee_name: 'Ethiopia Guji',
      origin: 'Ethiopia',
      roast_level: 'Light',
      processing: 'Washed',
      amount_g: 250,
      cost: 20,
      roast_date: '2026-01-01',
      rest_days_low: 7,
      rest_days_high: 14,
      image_url: 'https://example.com/label.png',
      product_url: 'https://sey.coffee/products/guji',
      decaf: 1
    });
  });

  it('never carries over frozen dates, status, lifecycle dates, slug, or id', () => {
    const prefill = clonePrefill(source);
    for (const key of ['id', 'slug', 'status', 'frozen_start_date', 'frozen_end_date', 'opened_date', 'moved_date', 'drank', 'created_at', 'updated_at']) {
      expect(prefill).not.toHaveProperty(key);
    }
  });
});

describe('set_roaster_default through staging', () => {
  const marked = { roaster: 'Sey', coffee_name: 'Guji', image_url: 'https://img.example/logo.png', set_roaster_default: '1' };

  it('survives staging: the staged merge carries the mark back into the form', () => {
    const pending = new Map<number, PendingChange>();
    stageFieldChange(pending, baseCoffee.id, marked);
    expect(stagedRoasterDefault(mergeStagedCoffee(baseCoffee, pending.get(baseCoffee.id)?.fields))).toBe(true);
  });

  it('Discard clears it: no pending entry, no mark', () => {
    const pending = new Map<number, PendingChange>();
    stageFieldChange(pending, baseCoffee.id, marked);
    clearPending(pending, baseCoffee.id);
    expect(stagedRoasterDefault(mergeStagedCoffee(baseCoffee, pending.get(baseCoffee.id)?.fields))).toBe(false);
  });

  it('is false for an unstaged coffee or no coffee, and never cloned', () => {
    expect(stagedRoasterDefault(baseCoffee)).toBe(false);
    expect(stagedRoasterDefault(null)).toBe(false);
    expect(clonePrefill(mergeStagedCoffee(baseCoffee, marked))).not.toHaveProperty('set_roaster_default');
  });
});

describe('stagedRoasterWebsite', () => {
  it('reads a staged roaster_website back from a merge', () => {
    expect(stagedRoasterWebsite(mergeStagedCoffee(baseCoffee, { roaster_website: 'https://lume.coffee' }))).toBe('https://lume.coffee');
  });
  it('is empty with nothing staged', () => {
    expect(stagedRoasterWebsite(baseCoffee)).toBe('');
    expect(stagedRoasterWebsite(null)).toBe('');
  });
});
