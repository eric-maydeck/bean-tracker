import { describe, it, expect, beforeEach } from 'vitest';
import type { DatabaseSync } from 'node:sqlite';
import { createDb } from './db';
import {
  createCoffee,
  getActiveCoffees,
  getFinishedCoffees,
  getCoffeeById,
  updateCoffee,
  markAsDrank,
  restoreCoffee,
  type NewCoffeeInput
} from './coffees';

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

describe('createCoffee / getActiveCoffees / getFinishedCoffees', () => {
  it('creates a coffee as active by default', () => {
    createCoffee(db, sampleInput());
    expect(getActiveCoffees(db)).toHaveLength(1);
    expect(getFinishedCoffees(db)).toHaveLength(0);
    expect(getActiveCoffees(db)[0].coffee_name).toBe('Sample Blend');
  });

  it('creates a coffee directly as finished when status is passed', () => {
    createCoffee(db, { ...sampleInput(), status: 'finished' });
    expect(getActiveCoffees(db)).toHaveLength(0);
    expect(getFinishedCoffees(db)).toHaveLength(1);
    expect(getFinishedCoffees(db)[0].drank).toBe(1);
  });
});

describe('getCoffeeById', () => {
  it('returns the created row by id', () => {
    const id = createCoffee(db, sampleInput());
    const found = getCoffeeById(db, id);
    expect(found?.roaster).toBe('Test Roasters');
  });

  it('returns undefined for an unknown id', () => {
    expect(getCoffeeById(db, 9999)).toBeUndefined();
  });
});

describe('updateCoffee', () => {
  it('overwrites the editable fields', () => {
    const id = createCoffee(db, sampleInput());
    updateCoffee(db, id, sampleInput({ coffee_name: 'Renamed Blend', cost: 22 }));
    const found = getCoffeeById(db, id);
    expect(found?.coffee_name).toBe('Renamed Blend');
    expect(found?.cost).toBe(22);
  });
});

describe('markAsDrank / restoreCoffee', () => {
  it('moves a coffee from active to finished and back', () => {
    const id = createCoffee(db, sampleInput());
    markAsDrank(db, id);
    expect(getActiveCoffees(db)).toHaveLength(0);
    expect(getFinishedCoffees(db)).toHaveLength(1);
    expect(getCoffeeById(db, id)?.moved_date).not.toBeNull();

    restoreCoffee(db, id);
    expect(getActiveCoffees(db)).toHaveLength(1);
    expect(getFinishedCoffees(db)).toHaveLength(0);
    expect(getCoffeeById(db, id)?.moved_date).toBeNull();
  });
});
