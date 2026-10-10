import { describe, it, expect } from 'vitest';

// Own in-memory DB for this file (getDb is a DB_PATH-keyed singleton).
process.env.DB_PATH = ':memory:';

import { getDb } from '$lib/server/db';
import { createCoffee } from '$lib/server/coffees';
import { localToday, periodBounds, previousPeriod } from '$lib/server/insights/time';
import { load } from './+page.server';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const run = (q = '') => load({ url: new URL(`http://localhost/insights${q}`) } as never) as any;

// Dates come from today, so the tests never age out of their periods.
const today = localToday();

// Each test seeds its own rows: one bag, linked bean, then [date, grams] brews.
function seed(brews: [string, number][]) {
  const db = getDb();
  db.exec('DELETE FROM beanconqueror_brews; DELETE FROM beanconqueror_beans; DELETE FROM coffees;');
  const { id } = createCoffee(db, {
    roaster: 'R', coffee_name: 'C', origin: null, roast_level: null, processing: 'Washed', amount_g: 250, cost: 25,
    roast_date: today, frozen_start_date: null, frozen_end_date: null, rest_days_low: null, rest_days_high: null, image_url: null
  });
  db.prepare(`INSERT INTO beanconqueror_beans (id, name, imported_at, coffee_id) VALUES ('b1', 'C', ?, ?)`).run(today, id);
  const ins = db.prepare(
    `INSERT INTO beanconqueror_brews (bc_created_at, bean_id, ground_coffee_g, rating, imported_at)
     VALUES (?, 'b1', ?, 8, ?)`
  );
  brews.forEach(([d, g], i) => ins.run(`${d}T15:00:0${i}.000Z`, g, today));
}

describe('/insights load', () => {
  it('renders an empty database: zero tiles, this year on offer', () => {
    const d = run();
    expect(d.explicit).toEqual({});
    expect(d.tiles).toMatchObject({ brews: 0, grams: 0, spend: 0, avgRating: null, costPerBrew: null, brewsPerDay: null });
    expect(d.years).toEqual([Number(today.slice(0, 4))]);
    expect(d.deltas).toBeNull();
    expect(d.compareOptions).toHaveLength(2); // 12m: previous, 2 years ago
    expect(d.tileKinds.brews).toBe('total');
  });

  it('reads the URL and counts the period', () => {
    seed([[today, 15]]);
    const d = run('?range=ALL&ratings=all');
    expect(d.explicit).toMatchObject({ range: 'all', ratings: 'all' });
    expect(d.tiles).toMatchObject({ brews: 1, grams: 15, spend: 25, avgRating: 8, rated: 1, avgDose: 15, brewsPerDay: 1 });
    expect(d.period.start).toBeNull();
    expect(d.compareOptions).toEqual([]);
  });

  it('all time has nothing to compare to', () => {
    const d = run('?range=all&compare=1');
    expect(d.explicit.compare).toBeUndefined();
    expect(d.previousPeriod).toBeNull();
    expect(d.deltas).toBeNull();
  });

  const p12 = periodBounds('12m', today);
  const prev1 = previousPeriod('12m', p12, 1)!;
  const prev2 = previousPeriod('12m', p12, 2)!;

  it('compare=1 fills deltas against the previous 12 months', () => {
    // One 15 g brew now; two 10 g brews in the previous 12 months.
    seed([[today, 15], [prev1.end, 10], [prev1.start!, 10], [prev2.end, 20]]);
    const d = run('?range=12m&compare=1');
    expect(d.previousPeriod).toEqual(prev1);
    expect(d.deltas.brews).toEqual({ abs: -1, pct: -50 });
    expect(d.deltas.grams).toEqual({ abs: -5, pct: -25 });
  });

  it('compare=2 reaches two periods back', () => {
    seed([[today, 15], [prev1.end, 10], [prev2.end, 20], [prev2.start!, 20]]);
    const d = run('?range=12m&compare=2');
    expect(d.explicit.compare).toBe(2);
    expect(d.previousPeriod).toEqual(prev2);
    expect(d.deltas.brews).toEqual({ abs: -1, pct: -50 });
    expect(d.deltas.grams).toEqual({ abs: -25, pct: -62.5 });
  });

  it('ytd compare offers only earlier years that have brews', () => {
    const y = Number(today.slice(0, 4));
    seed([[today, 15], [`${y - 2}-01-01`, 10]]); // nothing in y - 1
    const d = run('?range=ytd');
    expect(d.compareOptions.map((o: { n: number }) => o.n)).toEqual([2]);
    expect(run('?range=ytd&compare=1').explicit.compare).toBeUndefined();
  });

  it('an out-of-range compare is ignored', () => {
    const d = run('?range=12m&compare=3');
    expect(d.explicit.compare).toBeUndefined();
    expect(d.deltas).toBeNull();
  });
});
