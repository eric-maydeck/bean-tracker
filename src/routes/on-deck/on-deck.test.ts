import { describe, it, expect, beforeEach } from 'vitest';
import type { DatabaseSync } from 'node:sqlite';
import { createDb } from '#lib/server/db.ts';
import { createCoffee, getBacklogCoffees, getNonArchivedCoffees, getOpenCoffees, openCoffee, type NewCoffeeInput } from '#lib/server/coffees.ts';
import { buildOnDeckData, buildPickCoffees } from './onDeckData';

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

describe('buildPickCoffees', () => {
  const today = new Date('2026-09-17T00:00:00Z');

  it('maps category, decaf and image; frozen overrides backlog, a thawed one does not', () => {
    createCoffee(db, sampleInput({ coffee_name: 'Cold', frozen_start_date: '2026-09-01', decaf: true }));
    createCoffee(db, sampleInput({ coffee_name: 'Thawed', frozen_start_date: '2026-08-01', frozen_end_date: '2026-08-20' }));
    const { id } = createCoffee(db, sampleInput({ coffee_name: 'Warm', roast_date: '2026-09-05' }));
    openCoffee(db, id);
    const by = Object.fromEntries(buildPickCoffees(getNonArchivedCoffees(db), today).map((c) => [c.name, c]));
    expect(by.Cold).toMatchObject({ category: 'frozen', decaf: true, image: null, fill: null });
    expect(by.Thawed.category).toBe('backlog');
    expect(by.Warm).toMatchObject({ category: 'open', decaf: false });
    expect(typeof by.Warm.urgency).toBe('number');
  });

  it('carries the /coffees card fields in info, the roast degrees from the level map', () => {
    createCoffee(db, sampleInput({ coffee_name: 'Roasty', roast_date: '2026-09-05', roast_level: 'Light' }));
    const c = buildPickCoffees(getNonArchivedCoffees(db), today, new Map([['Light', 2.5]]))[0];
    expect(c.info).toMatchObject({ degrees: 2.5, roastDate: '2026-09-05', daysSinceRoast: 12, status: 'backlog' });
    expect(buildPickCoffees(getNonArchivedCoffees(db), today)[0].info?.degrees).toBe(0);
  });

  it('carries the coffee page origin details, null where blank', () => {
    createCoffee(db, sampleInput({ coffee_name: 'Rich', producer: 'Ana', farm: 'Finca X', variety: 'Gesha', region: 'Huila', elevation: '1900 m', harvest_time: '2026', certification: 'Organic', tasting_notes: 'Jasmine, peach' }));
    createCoffee(db, sampleInput({ coffee_name: 'Bare', producer: '' }));
    const by = Object.fromEntries(buildPickCoffees(getNonArchivedCoffees(db), today).map((c) => [c.name, c.info!]));
    expect(by.Rich).toMatchObject({ producer: 'Ana', farm: 'Finca X', variety: 'Gesha', region: 'Huila', elevation: '1,900 masl', harvestTime: '2026', certification: 'Organic', tastingNotes: 'Jasmine, peach' });
    expect(by.Bare).toMatchObject({ producer: null, farm: null, variety: null, region: null, elevation: null, harvestTime: null, certification: null, tastingNotes: null });
  });

  it('turns a Done urgency into null', () => {
    createCoffee(db, sampleInput());
    const row = { ...getNonArchivedCoffees(db)[0], drank: 1 } as ReturnType<typeof getNonArchivedCoffees>[number];
    expect(buildPickCoffees([row], today)[0].urgency).toBeNull();
  });
});
