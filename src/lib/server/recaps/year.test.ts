import { describe, it, expect } from 'vitest';
import { setBrewingZone } from '$lib/localDate';
import { createDb, setHouseholdSize } from '$lib/server/db';
import { dialInIds, onceDialed } from '$lib/server/insights/dialed';
import { loadYear, toGenCtx, dataStamp } from './year';

function seed() {
  const db = createDb(':memory:');
  setBrewingZone('America/Denver'); // createDb pins UTC for an empty db
  const now = '2026-10-09T00:00:00.000Z';
  const coffee = db.prepare(`INSERT INTO coffees (roaster, coffee_name, slug, decaf, created_at, updated_at) VALUES ('R', ?, ?, ?, '2025-01-01', '2025-01-01')`);
  const reg = coffee.run('Reg', 'r-reg', 0).lastInsertRowid;
  const dec = coffee.run('Dec', 'r-dec', 1).lastInsertRowid;
  const bean = db.prepare(`INSERT INTO beanconqueror_beans (id, name, imported_at, coffee_id) VALUES (?, ?, ?, ?)`);
  bean.run('b1', 'Reg', now, reg);
  bean.run('b2', 'Dec', now, dec);
  const brew = db.prepare(`INSERT INTO beanconqueror_brews (bc_created_at, bean_id, ground_coffee_g, rating, imported_at) VALUES (?, ?, 15, 8, ?)`);
  const add = (at: string, bean: string) => brew.run(at, bean, now);
  add('2025-12-31T23:30:00.000Z', 'b1');
  add('2026-01-01T00:10:00.000Z', 'b1');
  add('2026-07-01T09:00:00.000Z', 'b2');
  add('2027-01-01T00:05:00.000Z', 'b1');
  return { db, add };
}

describe('loadYear', () => {
  it('the calendar year by local wall date, decaf included', () => {
    const y = loadYear(seed().db, 2026, '2027-02-01', false)!;
    expect(y.brews.map((b) => b.localDate)).toEqual(['2026-01-01', '2026-07-01']);
    expect(y.brews.some((b) => b.decaf)).toBe(true);
    expect(y.period).toEqual({ start: '2026-01-01', end: '2026-12-31' });
    expect(y.prevBrews.map((b) => b.localDate)).toEqual(['2025-12-31']);
  });
  it('23:30 Dec 31 brew counts in its own year', () => {
    expect(loadYear(seed().db, 2025, '2027-02-01', false)!.brews).toHaveLength(1);
  });
  it('preview year ends today; no brews = null', () => {
    const { db } = seed();
    expect(loadYear(db, 2027, '2027-01-01', true)!.period).toEqual({ start: '2027-01-01', end: '2027-01-01' });
    expect(loadYear(db, 2024, '2027-02-01', false)).toBeNull();
  });
  it('toGenCtx: scored brews, every-rating allBrews, history-wide dial-in and dataStart', () => {
    const y = loadYear(seed().db, 2026, '2027-02-01', false)!;
    const g = toGenCtx(y);
    expect(g.brews).toBe(y.scored);
    expect(g.allBrews).toBe(y.brews);
    expect(g.wholeBrews).toBe(y.brews);
    expect(g.prevBrews).toEqual(onceDialed(y.prevBrews, dialInIds(y.everyBrew)));
    expect(g.dataStart).toBe('2025-12-31');
    expect(g.period).toEqual({ from: '2026-01-01', to: '2026-12-31' });
    expect(g.ratings).toBe('current');
  });
});

describe('dataStamp', () => {
  it('changes on a brew insert, a coffee edit and a household size change', () => {
    const { db, add } = seed();
    const seen = [dataStamp(db)];
    add('2026-08-01T09:00:00.000Z', 'b1');
    seen.push(dataStamp(db));
    db.prepare(`UPDATE coffees SET updated_at = '2026-11-01' WHERE slug = 'r-reg'`).run();
    seen.push(dataStamp(db));
    setHouseholdSize(db, 3);
    seen.push(dataStamp(db));
    expect(new Set(seen).size).toBe(4);
  });
});
