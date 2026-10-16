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
      seed([['2026-10-04', 140], ['2026-10-10', 70]]); // 1w = Oct 4–10: 210 g / 7 days; 250 g bag less the 210 logged = 40 g on hand
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
    expect(Object.keys(d.boards)).toHaveLength(9);
    expect(d.boards.roasters).toEqual([expect.objectContaining({ label: 'R', value: 15, bags: 1, brews: 1 })]);
  });

  it('movement against the compare window', () => {
    seed([[today, 15]]);
    expect(run('?tab=leaderboards&avg=raw&compare=1').boards.roasters[0].move).toBe('new');
    expect(run('?tab=leaderboards&avg=raw').boards.roasters[0].move).toBeUndefined();
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
    expect(dose('')).toEqual(['< 16 g', '16–18 g']);
    expect(dose('&dosing=exact')).toEqual(['15 g', '17 g']);
    expect(dose('&temp=exact&ratio=exact')).toEqual(['< 16 g', '16–18 g']);
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
  it('default skips the dial-in brews; dial=all keeps them', () => {
    seed(days(5));
    rate([5, 6, 8, 8, 8]); // 5 rated → skip the first 2
    expect(run('?range=all').tiles.avgRating).toBe(8);
    expect(run('?range=all&dial=all').tiles.avgRating).toBe(7);
    expect(run('?range=all').tiles.brews).toBe(5); // counts stay whole
  });
  it('position is bag-intrinsic: a period starting mid-bag still skips by whole-history position', () => {
    seed(days(5));
    rate([5, 6, 8, 8, 8]);
    const mid = `?range=${addDays(today, -3)}..${today}`; // brews 2–5
    expect(run(mid).tiles.avgRating).toBe(8);
    expect(run(`${mid}&dial=all`).tiles.avgRating).toBe(7.5);
  });
  it('only dial-in brews in the period: no rating, no NaN', () => {
    seed(days(5));
    rate([5, 6, 8, 8, 8]);
    const d = run(`?range=${addDays(today, -4)}..${addDays(today, -3)}`);
    expect(d.tiles).toMatchObject({ avgRating: null, rated: 0, brews: 2 });
    expect(JSON.stringify(d)).not.toMatch(/NaN/);
  });
  it('dial-in views keep every brew', () => {
    seed(days(5));
    rate([5, 6, 8, 8, 8]);
    const b = run('?tab=brewing&range=all').brewing;
    // Whole-history brews #1 and #2 are dial-in (unrated when scored): the chart still has them.
    expect(b.dialIn.map((x: { label: string }) => x.label)).toEqual(expect.arrayContaining(['#1', '#2']));
  });
});

describe('page-wide coffees filter', () => {
  // Two bags: Washed (2 brews) and Natural (3 brews), both rated 8; `decaf` makes the second a decaf bag.
  function seedTwo(decaf = false) {
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
      for (let i = 0; i < 2 + k; i++) ins.run(`${today}T1${k}:00:0${i}.000Z`, `b${k}`, today);
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
    for (const t of ['brewing', 'water', 'gear', 'consumption', 'milestones', 'insights']) expect(run(`${q}&tab=${t}`)).toBeTruthy();
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
  it('Records with caffeine=decaf sees only the decaf bag', () => {
    seedTwo(true);
    const top = (q: string) => run(`?range=all&ratings=all&dial=all&tab=records${q}`).records.topBrews;
    expect(top('&caffeine=decaf')).toHaveLength(3);
    expect(top('&caffeine=decaf').map((b: { holder: { label: string } }) => b.holder.label)).not.toContain('Washed');
    expect(top('')).toHaveLength(2); // the default skips decaf ratings
  });
});
