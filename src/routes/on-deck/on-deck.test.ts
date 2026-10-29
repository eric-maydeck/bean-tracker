import { describe, it, expect, beforeEach } from 'vitest';
import type { DatabaseSync } from 'node:sqlite';
import { createDb } from '$lib/server/db';
import { createCoffee, getBacklogCoffees, getOpenCoffees, openCoffee, type NewCoffeeInput } from '$lib/server/coffees';
import { buildOnDeckData } from './onDeckData';

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

describe('buildOnDeckData', () => {
  it('ranks the open list by urgency, descending', () => {
    // Roasted 12 days ago, into its resting window -> positive urgency.
    const { id: readyId } = createCoffee(db, sampleInput({ coffee_name: 'Ready', roast_date: '2026-09-05' }));
    openCoffee(db, readyId);
    // Roasted 2 days ago, still resting (before rest_days_low) -> negative urgency.
    const { id: restingId } = createCoffee(db, sampleInput({ coffee_name: 'Resting', roast_date: '2026-09-15' }));
    openCoffee(db, restingId);

    const today = new Date('2026-09-17T00:00:00Z');
    const { all } = buildOnDeckData(getOpenCoffees(db), [], today);

    expect(all.open).toHaveLength(2);
    expect(all.open[0].coffee_name).toBe('Ready');
    expect(all.open[1].coffee_name).toBe('Resting');
    expect(all.open[0].urgency_rating).toBeGreaterThan(all.open[1].urgency_rating as number);
  });

  it('slices the backlog candidates list to the top 10 by urgency', () => {
    for (let i = 0; i < 12; i++) {
      // Stagger roast dates so each coffee has a distinct urgency rank.
      createCoffee(
        db,
        sampleInput({ coffee_name: `Backlog ${i}`, roast_date: `2026-0${(i % 9) + 1}-01` })
      );
    }

    const today = new Date('2026-09-17T00:00:00Z');
    const { all } = buildOnDeckData([], getBacklogCoffees(db), today);

    expect(all.nextUp).toHaveLength(10);
    // Sorted descending by urgency.
    for (let i = 1; i < all.nextUp.length; i++) {
      expect(all.nextUp[i - 1].urgency_rating as number).toBeGreaterThanOrEqual(
        all.nextUp[i].urgency_rating as number
      );
    }
  });

  it('returns an empty open array when there are zero open coffees', () => {
    createCoffee(db, sampleInput());

    const today = new Date('2026-09-17T00:00:00Z');
    const { all } = buildOnDeckData(getOpenCoffees(db), getBacklogCoffees(db), today);

    expect(all.open).toEqual([]);
    expect(all.nextUp).toHaveLength(1);
  });

  it('splits caffeinated vs decaf independently, each with its own top-10 slice', () => {
    // 12 caffeinated backlog coffees (more than 10, to prove the "all" top-10
    // doesn't starve the decaf slice) plus 2 decaf ones.
    for (let i = 0; i < 12; i++) {
      createCoffee(db, sampleInput({ coffee_name: `Caff ${i}`, roast_date: `2026-0${(i % 9) + 1}-01` }));
    }
    createCoffee(db, sampleInput({ coffee_name: 'Decaf A', roast_date: '2026-08-01', decaf: true }));
    createCoffee(db, sampleInput({ coffee_name: 'Decaf B', roast_date: '2026-07-01', decaf: true }));

    const today = new Date('2026-09-17T00:00:00Z');
    const { all, caffeinated, decaf } = buildOnDeckData([], getBacklogCoffees(db), today);

    expect(all.nextUp).toHaveLength(10);
    expect(caffeinated.nextUp).toHaveLength(10);
    expect(caffeinated.nextUp.every((c) => c.decaf === 0)).toBe(true);
    expect(decaf.nextUp).toHaveLength(2);
    expect(decaf.nextUp.every((c) => c.decaf === 1)).toBe(true);
  });
});

describe('on-deck ?/open action', () => {
  it('opens a backlog coffee for an admin and refuses others', async () => {
    process.env.DB_PATH = ':memory:';
    const { getDb } = await import('$lib/server/db');
    const { actions } = await import('./+page.server');
    const db = getDb();
    const { id } = createCoffee(db, sampleInput());
    const ev = (isAdmin: boolean) => {
      const body = new FormData();
      body.set('id', String(id));
      return { request: new Request('http://x/on-deck', { method: 'POST', body }), locals: { isAdmin } } as never;
    };
    await expect(actions.open(ev(false))).rejects.toMatchObject({ status: 401 });
    expect(getOpenCoffees(db).map((c) => c.id)).not.toContain(id);
    await actions.open(ev(true));
    expect(getOpenCoffees(db).map((c) => c.id)).toContain(id);
  });
});
