import { describe, it, expect } from 'vitest';

// Own in-memory DB for this file (getDb is a DB_PATH-keyed singleton).
process.env.DB_PATH = ':memory:';

import { getDb } from '$lib/server/db';
import { createCoffee } from '$lib/server/coffees';
import { localToday } from '$lib/server/insights/time';
import { load } from './+page.server';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const run = (q = '') => load({ url: new URL(`http://localhost/insights${q}`) } as never) as any;

describe('/insights load', () => {
  it('renders an empty database: zero tiles, this year on offer', () => {
    const d = run();
    expect(d.explicit).toEqual({});
    expect(d.tiles).toMatchObject({ brews: 0, grams: 0, spend: 0, avgRating: null, costPerBrew: null });
    expect(d.years).toEqual([Number(localToday().slice(0, 4))]);
    expect(d.deltas).toBeNull();
  });

  it('reads the URL and counts the period', () => {
    const db = getDb();
    const { id } = createCoffee(db, {
      roaster: 'R', coffee_name: 'C', origin: null, roast_level: null, processing: 'Washed', amount_g: 250, cost: 25,
      roast_date: '2026-06-01', frozen_start_date: null, frozen_end_date: null, rest_days_low: null, rest_days_high: null, image_url: null
    });
    db.prepare(`INSERT INTO beanconqueror_beans (id, name, imported_at, coffee_id) VALUES ('b1', 'C', '2026-10-01', ?)`).run(id);
    db.prepare(
      `INSERT INTO beanconqueror_brews (bc_created_at, bean_id, ground_coffee_g, rating, imported_at)
       VALUES ('2026-07-01T15:00:00.000Z', 'b1', 15, 8, '2026-10-01')`
    ).run();
    const d = run('?range=ALL&ratings=all');
    expect(d.explicit).toMatchObject({ range: 'all', ratings: 'all' });
    expect(d.tiles).toMatchObject({ brews: 1, grams: 15, spend: 25, avgRating: 8, rated: 1 });
    expect(d.period.start).toBeNull();
  });

  it('all time has nothing to compare to', () => {
    const d = run('?range=all&compare=1');
    expect(d.previousPeriod).toBeNull();
    expect(d.deltas).toBeNull();
  });

  it('compare fills deltas for a rolling range', () => {
    // Two 10 g brews in the previous 12 months against the one 15 g brew above.
    const ins = getDb().prepare(
      `INSERT INTO beanconqueror_brews (bc_created_at, bean_id, ground_coffee_g, rating, imported_at)
       VALUES (?, 'b1', 10, 6, '2026-10-01')`
    );
    ins.run('2025-07-01T15:00:00.000Z');
    ins.run('2025-07-02T15:00:00.000Z');
    const d = run('?range=12m&compare=1');
    expect(d.previousPeriod).not.toBeNull();
    expect(d.deltas.brews).toEqual({ abs: -1, pct: -50 });
    expect(d.deltas.grams).toEqual({ abs: -5, pct: -25 });
  });
});
