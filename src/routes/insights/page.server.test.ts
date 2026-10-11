import { describe, it, expect, vi } from 'vitest';

// Own in-memory DB for this file (getDb is a DB_PATH-keyed singleton).
process.env.DB_PATH = ':memory:';

import { getDb, setHouseholdSize } from '$lib/server/db';
import { createCoffee } from '$lib/server/coffees';
import { localToday, periodBounds, previousPeriod, addDays, daysBetween, trackedDays, comparePeriod, type Period } from '$lib/server/insights/time';
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
    expect(d.scaled).toBe(false);
    expect(d.compareMenus['12m']).toEqual([
      { label: 'Same length', options: [{ value: '1', label: 'Previous 12 months' }, { value: '2', label: '2 years ago' }] }
    ]);
    expect(d.customDefault).toEqual({ start: today, end: today });
    expect(d.tileKinds.brews).toBe('total');
  });

  it('reads the URL and counts the period', () => {
    seed([[today, 15]]);
    const d = run('?range=ALL&ratings=all');
    expect(d.explicit).toMatchObject({ range: 'all', ratings: 'all' });
    expect(d.tiles).toMatchObject({ brews: 1, grams: 15, spend: 25, avgRating: 8, rated: 1, avgDose: 15, brewsPerDay: 1 });
    expect(d.period.start).toBeNull();
    expect(d.compareMenus.all).toEqual([]);
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
    expect(d.deltas.brews.base).toBe(2);
    expect(d.deltas.brews.abs).toBe(1 - 2);
    expect(d.deltas.grams.abs).toBe(15 - 20);
  });

  it('compare=2 reaches two periods back', () => {
    seed([[today, 15], [prev1.end, 10], [prev2.end, 20], [prev2.start!, 20]]);
    const d = run('?range=12m&compare=2');
    expect(d.explicit.compare).toBe(2);
    expect(d.previousPeriod).toEqual(prev2);
    expect(d.deltas.brews.abs).toBe(1 - 2);
    expect(d.deltas.grams.abs).toBe(15 - 40);
  });

  it('people=person divides totals and brews per day by the household size, deltas too', () => {
    seed([[today, 15], [prev1.end, 10], [prev1.start!, 10], [prev2.end, 20]]);
    const h = run('?range=12m&compare=1');
    const p = run('?range=12m&compare=1&people=person');
    expect(p.explicit.people).toBe('person');
    expect(p.householdSize).toBe(2);
    expect(p.tiles).toMatchObject({
      brews: h.tiles.brews / 2, grams: h.tiles.grams / 2, spend: h.tiles.spend / 2, rated: h.tiles.rated / 2,
      brewsPerDay: h.tiles.brewsPerDay / 2, avgDose: h.tiles.avgDose, avgRating: h.tiles.avgRating
    });
    expect(p.deltas.brews).toEqual({ abs: h.deltas.brews.abs / 2, pct: h.deltas.brews.pct, base: h.deltas.brews.base / 2 });
    expect(p.deltas.avgDose).toEqual(h.deltas.avgDose);
  });

  it('a household of one ignores people=person', () => {
    setHouseholdSize(getDb(), 1);
    try {
      seed([[today, 15]]);
      const d = run('?people=person');
      expect(d.householdSize).toBe(1);
      expect(d.explicit.people).toBeUndefined();
      expect(d.tiles.brews).toBe(1);
    } finally {
      setHouseholdSize(getDb(), 2);
    }
  });

  it('a same-length window partly before tracking is paced', () => {
    seed([[today, 15], [prev1.end, 10]]); // tracking began on the previous window's last day
    const d = run('?range=12m&compare=1');
    expect(d.scaled).toBe(true);
    // 1 brew in 1 tracked day → that pace over the period's days.
    expect(d.deltas.brews.base).toBe(trackedDays(p12, prev1.end, today));
    expect(d.deltas.avgDose).toEqual({ abs: 5, pct: 50, base: 10 });
  });

  it('a fully tracked same-length compare keeps raw totals even when the calendar lengths differ', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    try {
      vi.setSystemTime(new Date('2026-10-10T18:00:00Z'));
      const now = localToday();
      const c = periodBounds('3m', now);
      const pv = previousPeriod('3m', c, 1)!;
      // 92 days (Jul 11-Oct 10) vs 91 (Apr 11-Jul 10): pinned so this can't pass vacuously.
      expect(daysBetween(c.start!, c.end)).not.toBe(daysBetween(pv.start!, pv.end));
      seed([[now, 15], [pv.start!, 10], [pv.end, 10]]);
      const d = run('?range=3m&compare=1');
      expect(d.scaled).toBe(false);
      expect(d.deltas.brews.base).toBe(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it('a calendar year still in progress is paced', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    try {
      vi.setSystemTime(new Date('2026-10-10T18:00:00Z'));
      const now = localToday();
      const y = Number(now.slice(0, 4));
      seed([[now, 15], [`${y - 1}-01-01`, 10], [`${y - 1}-12-31`, 10]]);
      const d = run(`?range=${y}&compare=1`);
      expect(d.explicit.compare).toBe(1);
      expect(d.scaled).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it('ytd compare offers only earlier years that have brews', () => {
    const y = Number(today.slice(0, 4));
    seed([[today, 15], [`${y - 2}-01-01`, 10]]); // nothing in y - 1
    const d = run('?range=ytd');
    expect(d.compareMenus.ytd[0].options.map((o: { value: string }) => o.value)).toEqual(['2']);
    expect(run('?range=ytd&compare=1').explicit.compare).toBeUndefined();
  });

  it('brews per day in 12m counts from the first brew, not the window start', () => {
    seed([[addDays(today, -9), 10], [today, 10]]);
    expect(run().tiles.brewsPerDay).toBe(2 / 10);
  });

  it('an out-of-range compare is ignored', () => {
    const d = run('?range=12m&compare=3');
    expect(d.explicit.compare).toBeUndefined();
    expect(d.deltas).toBeNull();
  });

  const p1w = periodBounds('1w', today);

  it('a longer compare paces totals against the previous 3 months', () => {
    const w3m = comparePeriod('1w', p1w, '3m', '2000-01-01', today)!;
    // dataStart = the day before the 3-month window, so the window is fully tracked.
    seed([[addDays(w3m.start!, -1), 10], [w3m.start!, 10], [w3m.end, 10], [today, 15]]);
    const d = run('?range=1w&compare=3m');
    expect(d.explicit.compare).toBe('3m');
    expect(d.previousPeriod).toEqual(w3m);
    expect(d.scaled).toBe(true);
    const k = 7 / trackedDays(w3m, '2000-01-01', today);
    expect(d.deltas.brews.base).toBeCloseTo(2 * k);
    expect(d.deltas.brews.abs).toBeCloseTo(1 - 2 * k);
    expect(d.deltas.avgDose).toEqual({ abs: 5, pct: 50, base: 10 });
  });

  it('drops a longer window that starts before the first brew', () => {
    seed([[today, 15]]);
    const d = run('?range=1w&compare=3m');
    expect(d.explicit.compare).toBeUndefined();
    expect(d.previousPeriod).toBeNull();
    expect(d.compareMenus['1w'].map((g: { label: string }) => g.label)).toEqual(['Same length']);
  });

  it('All before runs from the first brew to the day before the period', () => {
    const first = addDays(today, -40);
    seed([[first, 10], [today, 15]]);
    const d = run('?range=1w&compare=before');
    expect(d.previousPeriod).toEqual({ start: first, end: addDays(p1w.start!, -1) });
    expect(d.compareMenus['1w'][1]).toMatchObject({ label: 'Longer', options: [{ value: '1m' }, { value: 'before' }] });
  });

  it('a custom range compares against exactly those dates', () => {
    const a = addDays(today, -30);
    const b = addDays(today, -21); // 10 days
    seed([[addDays(today, -40), 10], [a, 10], [b, 10], [today, 15]]);
    const d = run(`?range=1w&compare=${a}..${b}`);
    expect(d.explicit.compare).toBe(`${a}..${b}`);
    expect(d.previousPeriod).toEqual({ start: a, end: b });
    expect(d.deltas.brews.base).toBeCloseTo(1.4); // 2 brews / 10 days × 7
    expect(d.deltas.brews.abs).toBeCloseTo(-0.4);
  });

  it('a custom range works on all time and ignores a future end', () => {
    seed([[addDays(today, -5), 10], [today, 15]]);
    expect(run(`?range=all&compare=${addDays(today, -5)}..${addDays(today, -1)}`).previousPeriod)
      .toEqual({ start: addDays(today, -5), end: addDays(today, -1) });
    expect(run(`?compare=${today}..${addDays(today, 1)}`).explicit.compare).toBeUndefined();
  });

  it('a custom range overlapping the period compares normally', () => {
    seed([[addDays(today, -40), 10], [addDays(today, -2), 10], [today, 15]]);
    const d = run(`?range=1w&compare=${addDays(today, -3)}..${today}`);
    expect(d.previousPeriod).toEqual({ start: addDays(today, -3), end: today });
    expect(d.deltas.brews.base).toBeCloseTo((2 * 7) / 4);
  });

  it('a custom range before the first brew shows no change on totals', () => {
    seed([[today, 15]]);
    const d = run('?range=1w&compare=2020-01-01..2020-01-31');
    expect(d.previousPeriod).toEqual({ start: '2020-01-01', end: '2020-01-31' });
    expect(d.deltas.brews).toBeNull();
    expect(d.deltas.grams).toBeNull();
  });

  it('custom on an empty database', () => {
    getDb().exec('DELETE FROM beanconqueror_brews; DELETE FROM beanconqueror_beans; DELETE FROM coffees;');
    const d = run(`?compare=${today}..${today}`);
    expect(d.previousPeriod).toEqual({ start: today, end: today });
    expect(d.deltas.brews).toBeNull();
    expect(d.customDefault).toEqual({ start: today, end: today });
  });

  it('Custom range… prefills the same-length previous window when it is tracked, else All before', () => {
    seed([[addDays(today, -40), 10], [today, 15]]);
    expect(run('?range=1w').customDefault).toEqual(previousPeriod('1w', p1w));
    seed([[addDays(today, -9), 10], [today, 15]]); // previous week starts before the first brew
    expect(run('?range=1w').customDefault).toEqual({ start: addDays(today, -9), end: addDays(p1w.start!, -1) });
  });

  it('Consumption: measured over the period, per person too', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    try {
      vi.setSystemTime(new Date('2026-10-10T18:00:00Z'));
      setHouseholdSize(getDb(), 2);
      seed([['2026-10-04', 140], ['2026-10-10', 70]]); // 1w = Oct 4–10: 210 g / 7 days; 250 g on hand
      expect(run('?range=1w&people=household').consumption).toEqual({
        perDay: 30, perWeek: 210, perMonth: 30 * 30.44, daysToClear: 9, clearBy: '2026-10-19'
      });
      expect(run('?range=1w&people=person').consumption).toMatchObject({ perDay: 15, daysToClear: 17, clearBy: '2026-10-27' });
      expect(run('?range=1w').consumptionDeltas).toBeNull();
    } finally {
      setHouseholdSize(getDb(), 2); // the default
      vi.useRealTimers();
    }
  });

  it('Consumption deltas on the three rates only', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    try {
      vi.setSystemTime(new Date('2026-10-10T18:00:00Z'));
      seed([['2026-09-27', 70], ['2026-10-04', 140]]); // previous week 10 g/day, this week 20
      const d = run('?range=1w&compare=1');
      expect(d.consumptionDeltas.perDay).toEqual({ abs: 10, pct: 100, base: 10 });
      expect(Object.keys(d.consumptionDeltas)).toEqual(['perDay', 'perWeek', 'perMonth']);
    } finally {
      vi.useRealTimers();
    }
  });

  it('Consumption with no brews in the period shows nothing', () => {
    seed([[addDays(today, -40), 10]]);
    expect(run('?range=1w').consumption).toEqual({ perDay: null, perWeek: null, perMonth: null, daysToClear: null, clearBy: null });
  });
});
