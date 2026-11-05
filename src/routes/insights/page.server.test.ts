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

  it('tab=recaps with no recap to show still loads (an empty state), and the tab flag is off', () => {
    expect(run().recapsTab).toBe(false);
    expect(run('?tab=recaps&range=all')).toMatchObject({ recapsTab: false, recaps: [], explicit: { tab: 'recaps' } });
  });

  it('public tab=recaps: an open year shows; a Period that misses it is an empty list with the tab still on', () => {
    seed([['2020-05-01', 15]]);
    expect(run('?tab=recaps&range=all')).toMatchObject({ recapsTab: true, recaps: [{ year: 2020, preview: false }] });
    expect(run('?tab=recaps&range=2024-01-01..2024-02-01')).toMatchObject({ recapsTab: true, recaps: [] });
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
      seed([['2026-10-04', 140], ['2026-10-10', 70]]); // 1w = Oct 4–10: 210g / 7 days; 250g bag less the 210 logged = 40g on hand
      expect(run('?range=1w&people=household').consumption).toEqual({
        perDay: 30, perWeek: 210, perMonth: 30 * 30.44, daysToClear: 2, clearBy: '2026-10-12'
      });
      expect(run('?range=1w&people=person').consumption).toMatchObject({ perDay: 15, daysToClear: 3, clearBy: '2026-10-13' });
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

  it('empty database: every board empty', () => {
    const db = getDb();
    db.exec('DELETE FROM beanconqueror_brews; DELETE FROM beanconqueror_beans; DELETE FROM coffees;');
    const d = run('?tab=leaderboards&rank=spend&compare=1');
    expect(Object.values(d.boards).every((rows) => (rows as unknown[]).length === 0)).toBe(true);
  });

  it('computes boards only on the leaderboards tab', () => {
    seed([[today, 15]]);
    expect(run().boards).toBeNull();
    const d = run('?tab=leaderboards&rank=grams');
    expect(d.explicit).toMatchObject({ tab: 'leaderboards', rank: 'grams' });
    expect(Object.keys(d.boards)).toHaveLength(12);
    expect(d.boards.roasters).toEqual([expect.objectContaining({ label: 'R', value: 15, bags: 1, brews: 1 })]);
  });

  it('movement against the compare window', () => {
    seed([[today, 15]]);
    expect(run('?tab=leaderboards&rank=brews&range=12m&compare=1').boards.roasters[0].move).toBe('new');
    expect(run('?tab=leaderboards&rank=brews&compare=1').previousPeriod).toBeNull(); // All time: no compare
    expect(run('?tab=leaderboards&rank=brews').boards.roasters[0].move).toBeUndefined();
  });
});

describe('/insights habits and consumption', () => {
  it('computes each tab only when open', () => {
    seed([[today, 15]]);
    expect(run().habits).toBeNull();
    expect(run().consumptionTab).toBeNull();
    expect(run('?tab=habits').habits.tiles.brewDays).toBe(1);
    expect(run('?tab=consumption').consumptionTab.tiles.brewed).toBe(15);
  });
  it('right now on every tab; on hand is remaining grams', () => {
    seed([[today, 15], [addDays(today, -1), 20]]);
    expect(run('?tab=habits').rightNow).toMatchObject({ onHandG: 250 - 35, onHand: 1 });
  });
  it('offers by per range and drops one that does not fit', () => {
    seed([[today, 15]]);
    const d = run('?tab=consumption&range=1w&by=month');
    expect(d.explicit.by).toBeUndefined();
    expect(d.byMenus['1w']).toEqual(['day']);
    expect(d.consumptionTab.by).toBe('day');
  });
});

describe('/insights custom Period', () => {
  const from = addDays(today, -9);
  const to = addDays(today, -3);
  const r = `${from}..${to}`;
  it('returns the span\'s figures and its compare window', () => {
    seed([[addDays(today, -4), 15], [addDays(today, -12), 20], [today, 30]]);
    const d = run(`?range=${r}&compare=1`);
    expect(d.period).toEqual({ start: from, end: to });
    expect(d.tiles.brews).toBe(1);
    expect(d.previousPeriod).toEqual({ start: addDays(from, -7), end: addDays(from, -1) });
    expect(d.deltas).not.toBeNull();
    expect(d.compareMenus[r][0].options).toEqual([{ value: '1', label: 'Previous period' }]);
    expect(d.byMenus[r]).toEqual(['day']);
  });
  it('works on every tab', () => {
    seed([[addDays(today, -4), 15]]);
    for (const tab of ['leaderboards', 'habits', 'consumption'])
      expect(run(`?range=${r}&tab=${tab}`).period.start).toBe(from);
    expect(run(`?range=${r}&tab=consumption`).consumptionTab.by).toBe('day');
  });
  it('a span entirely before the first brew gives empty figures, no crash', () => {
    seed([[today, 15]]);
    const old = '2019-01-01..2019-01-31';
    for (const tab of ['overview', 'leaderboards', 'habits', 'consumption']) {
      const d = run(`?range=${old}&tab=${tab}`);
      expect(d.tiles.brews).toBe(0);
    }
  });
  it('a one-day span', () => {
    seed([[to, 15]]);
    const d = run(`?range=${to}..${to}`);
    expect(d.tiles.brews).toBe(1);
    expect(d.byMenus[`${to}..${to}`]).toEqual(['day']);
  });
  it('ignores a reversed or future-only span', () => {
    seed([[today, 15]]);
    expect(run(`?range=${to}..${from}`).explicit.range).toBeUndefined();
    expect(run(`?range=${addDays(today, 5)}..${addDays(today, 9)}`).explicit.range).toBeUndefined();
  });

  it('loads insights only on its tab, what-if defaults from household size', () => {
    seed(Array.from({ length: 12 }, (_, i) => [addDays(today, -i), 15] as [string, number]));
    const d = run('?tab=insights&range=all&drinkers=3&theme=money');
    expect(d.insights.whatIf.defaults.drinkers).toBe(d.householdSize);
    expect(run().insights).toBeNull();
    expect(run('?tab=records').insights).toBeNull();
  });

  it('loads records or milestones only on their tab', () => {
    seed(Array.from({ length: 12 }, (_, i) => [addDays(today, -i), 15] as [string, number]));
    const r = run('?tab=records&range=all');
    expect(r.records.sections.map((x: { key: string }) => x.key)).toContain('taste');
    expect(r.milestones).toBeNull();
    const m = run('?tab=milestones');
    expect(m.milestones.months).toBeDefined();
    expect(m.records).toBeNull();
    expect(run().records).toBeNull();
  });

  it('drops a brewer with no brews', () => {
    seed([[today, 15]]);
    expect(run('?tab=records&brewer=soup').explicit.brewer).toBeUndefined();
  });
});

describe('brewing lab tabs', () => {
  it('computes only the open lab tab', () => {
    seed([[today, 15]]);
    for (const t of ['sweetspots', 'brewing', 'water', 'gear'] as const) {
      const d = run(`?tab=${t}`);
      const keys = { sweetspots: 'sweetSpots', brewing: 'brewing', water: 'water', gear: 'gear' } as const;
      for (const [tab, key] of Object.entries(keys)) expect(d[key] === null).toBe(tab !== t);
      expect(d.lab).not.toBeNull();
    }
    expect(run('?tab=overview').lab).toBeNull();
  });
  it('each Band/Exact toggle reaches its own Brewing chart (dosing=exact → dose exact)', () => {
    seed([[today, 15], [today, 15], [today, 17], [today, 17]]);
    const dose = (q: string) => run(`?tab=brewing&dial=all${q}`).brewing.vars.find((v: { key: string }) => v.key === 'dose').bands.map((b: { label: string }) => b.label);
    expect(dose('')).toEqual(['< 16g', '16–18g']);
    expect(dose('&dosing=exact')).toEqual(['15g', '17g']);
    expect(dose('&temp=exact&ratio=exact')).toEqual(['< 16g', '16–18g']);
  });
  it('lab values come from the data: a real bag slug stays, junk drops', () => {
    seed([[today, 15]]);
    const { slug } = getDb().prepare('SELECT slug FROM coffees').get() as { slug: string };
    expect(run(`?tab=sweetspots&bag=${slug}&grinder=nope&roast=Light`).explicit).toMatchObject({ bag: slug, grinder: undefined, roast: undefined });
  });
  it('lab picks survive a non-lab tab (Sweet spots → Insights → back keeps them)', () => {
    seed([]);
    const db = getDb();
    db.exec('DELETE FROM beanconqueror_grinders;');
    db.prepare(`INSERT INTO beanconqueror_grinders (id, name, imported_at) VALUES ('g1', 'A4Z', ?)`).run(today);
    for (const i of [1, 2, 3]) {
      const { id } = createCoffee(db, {
        roaster: 'R', coffee_name: `L${i}`, origin: null, roast_level: 'Light', processing: 'Washed', amount_g: 250, cost: 25,
        roast_date: today, frozen_start_date: null, frozen_end_date: null, rest_days_low: null, rest_days_high: null, image_url: null
      });
      db.prepare(`INSERT INTO beanconqueror_beans (id, name, imported_at, coffee_id) VALUES (?, 'C', ?, ?)`).run(`l${i}`, today, id);
      db.prepare(`INSERT INTO beanconqueror_brews (bc_created_at, bean_id, mill_id, ground_coffee_g, rating, imported_at) VALUES (?, ?, 'g1', 15, 8, ?)`)
        .run(`${today}T15:00:0${i}.000Z`, `l${i}`, today);
    }
    const { slug } = db.prepare(`SELECT slug FROM coffees WHERE coffee_name = 'L1'`).get() as { slug: string };
    const d = run(`?tab=insights&bag=${slug}&roast=Light&grinder=a4z`);
    expect(d.explicit).toMatchObject({ tab: 'insights', bag: slug, roast: 'Light', grinder: 'a4z' });
    expect(d.lab).toBeNull();
  });
});

describe('once dialed', () => {
  const rate = (rs: number[]) => {
    const db = getDb();
    const ids = db.prepare('SELECT id FROM beanconqueror_brews ORDER BY bc_created_at').all() as { id: number }[];
    ids.forEach(({ id }, i) => db.prepare('UPDATE beanconqueror_brews SET rating = ? WHERE id = ?').run(rs[i], id));
  };
  const days = (k: number) => Array.from({ length: k }, (_, i) => [addDays(today, i - k + 1), 15] as [string, number]);
  // 8 rated brews → skip the first 2.
  const R = [5, 6, 8, 8, 8, 8, 8, 8];
  it('default skips the dial-in brews; dial=all keeps them', () => {
    seed(days(8));
    rate(R);
    expect(run('?range=all').tiles.avgRating).toBe(8);
    expect(run('?range=all&dial=all').tiles.avgRating).toBeCloseTo(59 / 8, 1);
    expect(run('?range=all').tiles.brews).toBe(8); // counts stay whole
  });
  it('position is bag-intrinsic: a period starting mid-bag still skips by whole-history position', () => {
    seed(days(8));
    rate(R);
    const mid = `?range=${addDays(today, -6)}..${today}`; // brews 2–8
    expect(run(mid).tiles.avgRating).toBe(8);
    expect(run(`${mid}&dial=all`).tiles.avgRating).toBeCloseTo(54 / 7, 1);
  });
  it('only dial-in brews in the period: no rating, no NaN', () => {
    seed(days(8));
    rate(R);
    const d = run(`?range=${addDays(today, -7)}..${addDays(today, -6)}`);
    expect(d.tiles).toMatchObject({ avgRating: null, rated: 0, brews: 2 });
    expect(JSON.stringify(d)).not.toMatch(/NaN/);
  });
  it('dial-in views keep every brew', () => {
    seed(days(8));
    rate(R);
    const b = run('?tab=brewing&range=all').brewing;
    // Whole-history brews #1 and #2 are dial-in (unrated when scored): the chart still has them.
    expect(b.dialIn.map((x: { label: string }) => x.label)).toEqual(expect.arrayContaining(['#1', '#2']));
  });
});

describe('page-wide coffees filter', () => {
  // Two bags: Washed (2 brews) and Natural (3 brews), both rated 8; `decaf` makes the second a decaf bag.
  // `base`: the Washed bag's brews (Natural gets one more); 4 makes both full bags for the group boards.
  function seedTwo(decaf = false, base = 2) {
    const db = getDb();
    db.exec('DELETE FROM beanconqueror_brews; DELETE FROM beanconqueror_beans; DELETE FROM coffees;');
    const ins = db.prepare(`INSERT INTO beanconqueror_brews (bc_created_at, bean_id, ground_coffee_g, rating, imported_at) VALUES (?, ?, 15, 8, ?)`);
    (['Washed', 'Natural'] as const).forEach((processing, k) => {
      const { id } = createCoffee(db, {
        roaster: `R${k}`, coffee_name: processing, origin: k ? 'Kenya' : 'Ethiopia', roast_level: 'Light', processing, amount_g: 250, cost: 25,
        roast_date: today, frozen_start_date: null, frozen_end_date: null, rest_days_low: null, rest_days_high: null, image_url: null
      });
      if (decaf && k) db.prepare('UPDATE coffees SET decaf = 1 WHERE id = ?').run(id);
      db.prepare(`INSERT INTO beanconqueror_beans (id, name, imported_at, coffee_id) VALUES (?, ?, ?, ?)`).run(`b${k}`, processing, today, id);
      for (let i = 0; i < base + k; i++) ins.run(`${today}T1${k}:00:0${i}.000Z`, `b${k}`, today);
    });
  }
  it('every tab loader sees only the matching coffees', () => {
    seedTwo();
    const q = '?range=all&process=washed';
    expect(run(q).explicit.process).toBe('Washed');
    expect(run(q).tiles.brews).toBe(2);
    expect(run(`${q}&tab=leaderboards&rank=brews`).boards.coffees).toHaveLength(1);
    expect(run(`${q}&tab=habits`).habits.tiles.brewDays).toBe(1);
    expect(run(`${q}&tab=records`).records).not.toBeNull();
    expect(run(`${q}&tab=sweetspots`).sweetSpots.matching).toEqual({ bags: 1, brews: 2 });
    // One filtered figure per remaining tab: each loader got the payload, built from the Washed bag's 2 brews only.
    for (const t of ['brewing', 'water', 'gear', 'insights'] as const) expect(run(`${q}&tab=${t}`)[t]).not.toBeNull();
    expect(run(`${q}&tab=milestones`).milestones.totals.find((x: { key: string }) => x.key === 'brews').value).toBe(2);
    expect(run(`${q}&tab=consumption`).consumptionTab).not.toBeNull();
  });
  it('picker options come from the unfiltered data', () => {
    seedTwo();
    expect(run('?process=Washed').coffeeOptions.processes).toEqual(['Natural', 'Washed']);
  });
  it('unknown coffee values drop', () => {
    seedTwo();
    expect(run('?origin=Mars&roaster=Nobody').explicit).toMatchObject({ origin: undefined, roaster: undefined });
  });
  it('filter that empties the period: zeros and nulls, no NaN', () => {
    seedTwo();
    const d = run('?roaster=R0&range=1w&tab=leaderboards');
    const e = run(`?roaster=R0&range=${addDays(today, -30)}..${addDays(today, -20)}`);
    expect(e.tiles).toMatchObject({ brews: 0, avgRating: null });
    expect(JSON.stringify([d, e])).not.toMatch(/NaN/);
  });
  it('caffeine: default counts decaf but skips its ratings; decaf keeps only it; all rates both', () => {
    seedTwo(true);
    const t = (q: string) => run(`?range=all&ratings=all${q}`).tiles;
    expect(t('')).toMatchObject({ brews: 5, rated: 2, avgRating: 8 });
    expect(t('&caffeine=decaf')).toMatchObject({ brews: 3, rated: 3, avgRating: 8 });
    expect(t('&caffeine=all')).toMatchObject({ brews: 5, rated: 5 });
    const boards = (q: string) => run(`?range=all&tab=leaderboards&rank=brews${q}`).boards.coffees;
    expect(boards('')).toHaveLength(2); // counts keep the decaf bag
    expect(boards('&caffeine=decaf')).toHaveLength(1);
    expect(run('?caffeine=CAF').explicit.caffeine).toBeUndefined();
  });
  it('Caffeine board ignores the Caffeine filter: both kinds under the default, Decaf and All', () => {
    seedTwo(true);
    const kinds = (q: string) => run(`?range=all&tab=leaderboards&rank=rating&ratings=all&dial=all${q}`).boards.caffeine.map((r: { label: string }) => r.label).sort();
    for (const q of ['', '&caffeine=decaf', '&caffeine=all', '&caffeine=caffeinated']) expect(kinds(q), q).toEqual(['Caffeinated', 'Decaf']);
    // The other boards still follow it.
    expect(run('?range=all&tab=leaderboards&rank=brews&caffeine=decaf').boards.coffees).toHaveLength(1);
  });
  it('See all shows every bag: a roaster of one 1-brew decaf bag (the seed\'s Onyx) is on the rating board (user, 2026-10-17)', () => {
    seedTwo(true, 0); // R1: one decaf bag, one rated brew
    const roasters = (q: string) => run(`?range=all&tab=leaderboards&caffeine=all${q}`).boards.roasters.map((r: { label: string }) => r.label);
    expect(roasters('&avg=raw&ratings=all&dial=all')).toContain('R1');
    // k2 has no cutoff and every bag counts (weighted by its brews): R1 shows; min3 drops the 1-bag group.
    expect(roasters('&avg=k2&ratings=all&dial=all')).toContain('R1');
    // The note offers it: Score hid the row.
    expect(run('?range=all&tab=leaderboards&caffeine=all&ratings=all&dial=all').hidden.rowsBy.roasters).toEqual(['avg']);
  });
  it('Leaderboards: boards the confident cutoff emptied are named; truly empty ones are not', () => {
    seedTwo(false, 4);
    const d = run('?range=all&ratings=all&dial=all&tab=leaderboards&process=Washed');
    expect(d.boards.roasters).toEqual([]);
    expect(d.boardsCut).toEqual(expect.arrayContaining(['roasters', 'origins']));
    expect(d.boardsCut).not.toContain('coffees'); // one bag of 4 rated brews passes the one-bag rule
    expect(d.boardsCut).not.toContain('dripper'); // no dripper recorded: no rated group at all
    expect(run('?range=all&ratings=all&dial=all&tab=leaderboards&process=Washed&avg=raw').boardsCut).toEqual([]);
    expect(run('?tab=leaderboards&roaster=R0&range=' + addDays(today, -30) + '..' + addDays(today, -20)).boardsCut).toEqual([]);
  });
  it('See all: rows the boards gain and rated brews left out, vs avg=raw, ratings=all, dial=all', () => {
    seedTwo(false, 4);
    // One calibration-period brew on the Washed bag: left out by Calibrated ratings.
    getDb().prepare(`INSERT INTO beanconqueror_brews (bc_created_at, bean_id, ground_coffee_g, rating, imported_at) VALUES (?, 'b0', 15, 6, ?)`)
      .run('2026-05-01T10:00:00.000Z', today);
    const h = (q: string) => run(`?range=all${q}`).hidden;
    // dial=all: a 4–5-brew bag once dialed is under the 4-brew full-bag rule, which See all's Raw step relaxes (Score).
    expect(h('&tab=leaderboards&process=Washed&dial=all')).toEqual({ rows: expect.objectContaining({ roasters: 1, origins: 1 }), brews: 1, rowsBy: expect.objectContaining({ roasters: ['avg'] }), why: ['ratings'] });
    expect(h('&tab=leaderboards&process=Washed&avg=raw&dial=all')).toEqual({ rows: {}, rowsBy: {}, brews: 1, why: ['ratings'] });
    expect(h('&tab=records&ratings=all&dial=all')).toEqual({ rows: {}, rowsBy: {}, brews: 0, why: [] });
    expect(h('&tab=leaderboards&avg=raw&ratings=all&dial=all')).toEqual({ rows: {}, rowsBy: {}, brews: 0, why: [] });
    expect(h('&tab=consumption')).toBeNull();
    // An unlinked brew (no bag) never shows in rating views, so it isn't "left out".
    getDb().prepare(`INSERT INTO beanconqueror_brews (bc_created_at, bean_id, ground_coffee_g, rating, imported_at) VALUES (?, NULL, 15, 6, ?)`)
      .run('2026-05-02T10:00:00.000Z', today);
    expect(h('&tab=records&dial=all')).toMatchObject({ brews: 1, why: ['ratings'] });
  });
  it('Records with caffeine=decaf sees only the decaf bag', () => {
    seedTwo(true);
    const top = (q: string) => run(`?range=all&ratings=all&dial=all&tab=records${q}`).records.topBrews;
    expect(top('&caffeine=decaf')).toHaveLength(3);
    expect(top('&caffeine=decaf').map((b: { holder: { label: string } }) => b.holder.label)).not.toContain('Washed');
    expect(top('')).toHaveLength(2); // the default skips decaf ratings
  });
});

describe('the mixed-roast nudge', () => {
  // Two roast levels, 5 bags × 4 rated brews each, bag means 1 point apart: past the pooled rule both sides and the t test.
  function seedRoasts() {
    const db = getDb();
    db.exec('DELETE FROM beanconqueror_brews; DELETE FROM beanconqueror_beans; DELETE FROM coffees;');
    const ins = db.prepare(`INSERT INTO beanconqueror_brews (bc_created_at, bean_id, ground_coffee_g, rating, imported_at) VALUES (?, ?, 15, ?, ?)`);
    [['Light', 8.5], ['Dark', 7.5]].forEach(([roast, r], k) => [0, 1, 2, 3, 4].forEach((j) => {
      const bean = `b${k}${j}`;
      const { id } = createCoffee(db, {
        roaster: 'R', coffee_name: bean, origin: null, roast_level: roast as string, processing: 'Washed', amount_g: 250, cost: 25,
        roast_date: today, frozen_start_date: null, frozen_end_date: null, rest_days_low: null, rest_days_high: null, image_url: null
      });
      db.prepare(`INSERT INTO beanconqueror_beans (id, name, imported_at, coffee_id) VALUES (?, ?, ?, ?)`).run(bean, bean, today, id);
      for (let i = 0; i < 4; i++) ins.run(`${today}T1${k}:${j}0:0${i}.000Z`, bean, (r as number) + (j - 2) * 0.1, today);
    }));
  }
  it('shows on mixed roasts; a Roast filter or rank=like turns it off', () => {
    seedRoasts();
    const q = '?range=all&ratings=all&dial=all&tab=leaderboards';
    expect(run(q).roastMix?.map((x: { roast: string }) => x.roast)).toEqual(['Light', 'Dark']);
    expect(run(`${q}&roast=Light`).roastMix).toBeNull();
    expect(run(`${q}&rank=like`).roastMix).toBeNull();
  });
});

describe('brew filters', () => {
  // Bag A: 8 rated brews, the first 2 Origami then V60 (water W1). Bag B: 6 rated Origami brews (W2). All 15 g.
  // Once dialed (dialed.ts) skips A's first 2 and B's first 1, by position over each bag's whole history.
  const A = (i: number) => addDays(today, -20 + i);
  const B = (i: number) => addDays(today, -10 + i);
  function seedBrews() {
    const db = getDb();
    db.exec('DELETE FROM beanconqueror_brews; DELETE FROM beanconqueror_beans; DELETE FROM coffees; DELETE FROM beanconqueror_methods;');
    for (const m of ['V60', 'Origami']) db.prepare(`INSERT INTO beanconqueror_methods (id, name, imported_at) VALUES (?, ?, ?)`).run(m, m, today);
    const ins = db.prepare(
      `INSERT INTO beanconqueror_brews (bc_created_at, bean_id, preparation_id, water, ground_coffee_g, rating, imported_at)
       VALUES (?, ?, ?, ?, 15, 8, ?)`
    );
    ['A', 'B'].forEach((n) => {
      const { id } = createCoffee(db, {
        roaster: 'R', coffee_name: n, origin: null, roast_level: null, processing: 'Washed', amount_g: 250, cost: 25,
        roast_date: today, frozen_start_date: null, frozen_end_date: null, rest_days_low: null, rest_days_high: null, image_url: null
      });
      db.prepare(`INSERT INTO beanconqueror_beans (id, name, imported_at, coffee_id) VALUES (?, ?, ?, ?)`).run(`bean${n}`, n, today, id);
    });
    for (let i = 0; i < 8; i++) ins.run(`${A(i)}T15:00:00.000Z`, 'beanA', i < 2 ? 'Origami' : 'V60', 'W1', today);
    for (let i = 0; i < 6; i++) ins.run(`${B(i)}T15:00:00.000Z`, 'beanB', 'Origami', 'W2', today);
  }

  it('brews narrow on Overview', () => {
    seedBrews();
    const d = run('?range=all&dripper=V60');
    expect(d.tiles.brews).toBe(6);
    expect(d.brewFilters).toEqual({ dripper: 'V60' });
  });
  it('whole-bag figures ignore brew filters', () => {
    seedBrews();
    const [u, f] = [run('?range=all'), run('?range=all&dripper=V60')];
    expect(f.rightNow).toEqual(u.rightNow);
    expect(f.consumption.daysToClear).toBe(u.consumption.daysToClear);
    expect(f.consumption.daysToClear).not.toBeNull();
    expect(f.tiles.spend).toBe(u.tiles.spend);
    expect(f.tiles.bagsFinished).toBe(u.tiles.bagsFinished);
    expect(f.consumption.perDay).toBeLessThan(u.consumption.perDay);
    const [cu, cf] = [run('?range=all&tab=consumption'), run('?range=all&tab=consumption&dripper=V60')];
    for (const k of ['onHand', 'net', 'daysToClear'] as const) expect(cf.consumptionTab.tiles[k]).toBe(cu.consumptionTab.tiles[k]);
    expect(cf.consumptionTab.backlog).toEqual(cu.consumptionTab.backlog);
    expect(cf.consumptionTab.tiles.brewed).toBeLessThan(cu.consumptionTab.tiles.brewed);
  });
  it('dial-in status is positional under a brew filter', () => {
    seedBrews();
    const hidden = (q: string) => run(`?range=all&ratings=all&tab=leaderboards${q}`);
    // Unfiltered: A's first 2 and B's first 1 are dial-in.
    expect(hidden('').hidden.brews).toBe(3);
    // V60 is A's brews 3-8: none is a dial-in brew, so none is hidden (not re-numbered from 1 on the subset).
    expect(hidden('&dripper=V60').hidden.brews).toBe(0);
    expect(hidden('&dripper=V60').tiles.rated).toBe(6);
    // Origami keeps A's first 2 and B's first as dial-in.
    expect(hidden('&dripper=Origami').hidden.brews).toBe(3);
    expect(hidden('&dripper=Origami').tiles.rated).toBe(5);
  });
  it('every leaderboard applies every brew filter, its own dimension included', () => {
    seedBrews();
    const d = run('?range=all&tab=leaderboards&rank=brews&dripper=V60&water=W1');
    const counts = (rows: { label: string; value: number }[]) => Object.fromEntries(rows.map((r) => [r.label, r.value]));
    expect(counts(d.boards.dripper)).toEqual({ V60: 6 });
    expect(counts(d.boards.water)).toEqual({ W1: 6 });
    expect(counts(run('?range=all&tab=leaderboards&rank=brews').boards.dripper)).toEqual({ V60: 6, Origami: 8 });
  });
  it('filters not offered on this tab do nothing', () => {
    seedBrews();
    expect(run('?tab=sweetspots&dripper=V60').sweetSpots.matching).toEqual(run('?tab=sweetspots').sweetSpots.matching);
    const g = run('?tab=gear&dripper=V60');
    expect(g.brewFilters).toEqual({});
    expect(g.explicit.dripper).toBe('V60');
  });
  it('a brew filter that empties the period', () => {
    seedBrews();
    expect(run('?dripper=Nope').explicit.dripper).toBeUndefined();
    const w = `?range=${A(0)}..${A(1)}&dripper=V60`; // only A's two Origami brews
    const d = run(w);
    expect(d.tiles).toMatchObject({ brews: 0, avgRating: null });
    for (const tab of ['overview', 'consumption', 'records', 'insights']) expect(JSON.stringify(run(`${w}&tab=${tab}`))).not.toMatch(/NaN/);
  });
  it('brew options come from unfiltered data', () => {
    seedBrews();
    expect(run('?dripper=V60').brewOptions.drippers).toEqual(['Origami', 'V60']);
  });

  it('trophies only on the gear tab: Period-scoped, the Coffees and other filters ignored', () => {
    seed([[addDays(today, -400), 15], [today, 15]]);
    const db = getDb();
    db.exec(`INSERT OR REPLACE INTO beanconqueror_methods (id, name, imported_at) VALUES ('m1', 'V60', '${today}');
      UPDATE beanconqueror_brews SET preparation_id = 'm1'`);
    expect(run('?tab=overview').trophies).toBeNull();
    const t = run('?tab=gear&range=all&dripper=V60&ratings=current&dial=dialed&caffeine=decaf').trophies;
    expect(t.find((x: { key: string }) => x.key === 'dripper-v60').brews).toBe(2);
    // A short Period drops the brew 400 days back; first used stays lifetime.
    const w = run('?tab=gear&range=1w').trophies.find((x: { key: string }) => x.key === 'dripper-v60');
    expect(w.brews).toBe(1);
    expect(w.firstUsed).toBe(addDays(today, -400));
  });
  it('pours: only on tab=pours; Calibrated names the recipe it hides, ratings=all does not', () => {
    seed([[today, 15]]);
    const db = getDb();
    db.exec('DELETE FROM beanconqueror_brews; DELETE FROM beanconqueror_beans; DELETE FROM coffees; DELETE FROM recipes;');
    db.prepare(`INSERT INTO recipes (id, name, definition, created_at, updated_at) VALUES (1, 'Rcp', '{"v":1,"pours":[],"pourCount":{"min":1,"max":9},"drippers":[]}', 'x', 'x')`).run();
    const reading = JSON.stringify({ v: 1, pours: [0, 1, 2].map((i) => ({ startS: i * 30, durationS: 10, grams: 50, avgGps: 5, peakGps: 8, speed: 'slow', bloom: i === 0, contactS: 30 })), swirls: [], tares: [], bloomCount: 1, bloomHoldS: 30, immersion: false, totalS: 140, drawdownS: 40 });
    let n = 0;
    for (const bag of [1, 2, 3]) {
      const { id } = createCoffee(db, { roaster: 'R', coffee_name: `C${bag}`, origin: null, roast_level: null, processing: 'Washed', amount_g: 250, cost: 25, roast_date: today, frozen_start_date: null, frozen_end_date: null, rest_days_low: null, rest_days_high: null, image_url: null });
      db.prepare(`INSERT INTO beanconqueror_beans (id, name, imported_at, coffee_id) VALUES (?, ?, ?, ?)`).run(`b${bag}`, `C${bag}`, today, id);
      // Four recipe brews before the Calibrated date, two unmatched ones after it.
      for (const [date, rating, match] of [['2026-03-01', 8, 1], ['2026-03-02', 8, 1], ['2026-03-03', 8, 1], ['2026-03-04', 8, 1], [today, 7, 0], [today, 6, 0]] as const) {
        const brewId = ++n, uuid = `00000000-0000-4000-8000-${String(brewId).padStart(12, '0')}`;
        db.prepare(`INSERT INTO beanconqueror_brews (id, bc_created_at, bc_uuid, bean_id, ground_coffee_g, rating, imported_at) VALUES (?, ?, ?, ?, 15, ?, ?)`).run(brewId, `${date}T15:00:${String(brewId).padStart(2, '0')}.000Z`, uuid, `b${bag}`, rating, today);
        db.prepare(`INSERT INTO brew_pour_readings (bc_uuid, detector_version, flow_uploaded_at, pattern, pour_count, bloom_count, swirl_count, low_confidence, immersion, reading, read_at) VALUES (?, 3, 'x', 'p', 3, 1, 0, 0, 0, ?, 'x')`).run(uuid, reading);
        if (match) db.prepare(`INSERT INTO brew_recipe_matches (brew_id, recipe_id, how) VALUES (?, 1, 'match')`).run(brewId);
      }
    }
    expect(run('?tab=brewing&range=all').pours).toBeNull();
    const d = run('?tab=pours&range=all&dial=all');
    expect(d.pours).not.toBeNull();
    expect(d.pours.hiddenByRatings).toEqual(['Rcp']);
    expect(run('?tab=pours&range=all&dial=all&ratings=all').pours.hiddenByRatings).toEqual([]);
    // Calibrated hides every recipe: the tab keeps the note's data (the page shows the empty line plus the note).
    db.exec(`UPDATE beanconqueror_brews SET rating = NULL WHERE bc_created_at >= '2026-06-01'`);
    const none = run('?tab=pours&range=all&dial=all').pours;
    expect(none).toMatchObject({ recipes: [], technique: [], hiddenByRatings: ['Rcp'] });
  });
});
