import { describe, it, expect, beforeAll } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createDb, setHouseholdSize } from '$lib/server/db';
import { localToday } from '$lib/server/localToday';
import { recap, recapTiles } from './recap';
import { freezeIds, frozenIds } from './store';

function seed(db: ReturnType<typeof createDb>, years: number[]) {
  const now = '2026-10-09T00:00:00.000Z';
  const roasters = ['A', 'B'];
  roasters.forEach((r, k) => {
    const id = db.prepare(`INSERT INTO coffees (roaster, coffee_name, slug, origin, created_at, updated_at) VALUES (?, ?, ?, ?, '2020-01-01', '2020-01-01')`)
      .run(r, `Bag ${r}`, `bag-${r}`, k ? 'Colombia' : 'Ethiopia').lastInsertRowid;
    db.prepare(`INSERT INTO beanconqueror_beans (id, name, roaster, imported_at, coffee_id) VALUES (?, ?, ?, ?, ?)`).run(`b${k}`, `Bag ${r}`, r, now, id);
  });
  const brew = db.prepare(`INSERT INTO beanconqueror_brews (bc_created_at, bean_id, ground_coffee_g, brew_temperature, water_amount_g, rating, imported_at) VALUES (?, ?, 18, 93, 290, 8, ?)`);
  for (const y of years) for (let i = 0; i < 20; i++) brew.run(`${y}-06-${String(1 + (i % 8)).padStart(2, '0')}T${String(7 + (i % 14)).padStart(2, '0')}:10:00.000Z`, `b${i % 2}`, now);
}

describe('recap', () => {
  it('total first, personality last, no empty slides', () => {
    const db = createDb(':memory:');
    seed(db, [2025]);
    const r = recap(db, 2025, { today: '2026-02-01', preview: false })!;
    expect(r.slides[0].id).toBe('total');
    expect(r.slides.every((s) => s.big && s.context && s.tone)).toBe(true);
    expect(r.poster.title).toBe('2025 in coffee');
    expect(r.cover).toEqual({ title: '2025 in coffee', sub: 'Jun 1 to Jun 8' });
    expect(r.poster.footer).toBe('Picked from 20 brews across 2 bags and 2 roasters.');
    expect(r.slides.at(-1)!.id).toBe('you');
  });
  it('a 20-brew year gives a short recap', () => {
    const db = createDb(':memory:');
    seed(db, [2025]);
    const r = recap(db, 2025, { today: '2026-02-01', preview: false })!;
    expect(r.slides.length).toBeGreaterThanOrEqual(1);
    expect(r.slides.length).toBeLessThan(8);
  });
  it('null for a year without brews; people=person uses household size', () => {
    const db = createDb(':memory:');
    seed(db, [2025]);
    setHouseholdSize(db, 2);
    expect(recap(db, 2024, { today: '2026-02-01', preview: false })).toBeNull();
    const h = recap(db, 2025, { today: '2026-02-01', preview: false })!, p = recap(db, 2025, { today: '2026-02-01', preview: false, people: 'person' })!;
    expect(p.householdSize).toBe(2);
    expect(p.slides[0].big).not.toBe(h.slides[0].big);
  });
});

describe('recapTiles', () => {
  it('public sees open years only; admin also the current year as preview', () => {
    const db = createDb(':memory:');
    seed(db, [2026, 2027]);
    const pub = recapTiles(db, '2027-07-01', false);
    expect(pub.map((t) => [t.year, t.preview, t.href])).toEqual([[2026, false, '/recaps/2026']]);
    expect(frozenIds(db, 2027)).toBeNull();
    const adm = recapTiles(db, '2027-07-01', true);
    expect(adm.map((t) => [t.year, t.preview, t.href])).toEqual([[2027, true, '/recaps/2027?preview=1'], [2026, false, '/recaps/2026']]);
    expect(frozenIds(db, 2027)).toBeNull(); // a preview never freezes
    expect(adm[1].headlines.length).toBeGreaterThanOrEqual(2);
    expect(adm[1].headlines[0]).toEqual({ big: '20', label: 'brews' });
    expect(recapTiles(db, '2026-06-01', false)).toEqual([]);
  });
});

describe('freezing', () => {
  it('freezes on first public open; preview never freezes', () => {
    const db = createDb(':memory:');
    seed(db, [2026]);
    recap(db, 2026, { today: '2026-11-01', preview: true });
    expect(frozenIds(db, 2026)).toBeNull();
    const r = recap(db, 2026, { today: '2027-01-02', preview: false })!;
    expect(frozenIds(db, 2026)).toEqual(r.slides.filter((s) => s.id !== 'you').map((s) => s.id));
  });
  it('skips a frozen fact that is now null, keeping order', () => {
    const db = createDb(':memory:');
    seed(db, [2026]);
    freezeIds(db, 2026, ['total', 'decaf', 'streak']); // decaf now null: no decaf brews
    const r = recap(db, 2026, { today: '2027-01-02', preview: false })!;
    expect(r.slides.map((s) => s.id)).toEqual(['total', 'streak', 'you']);
  });
});

describe('route load', () => {
  const cur = Number(localToday().slice(0, 4));
  let load: (a: unknown) => unknown;
  beforeAll(async () => {
    process.env.DB_PATH = join(mkdtempSync(join(tmpdir(), 'recap-')), 't.db');
    const { getDb } = await import('$lib/server/db');
    seed(getDb(), [cur - 1, cur]);
    load = (await import('../../../routes/recaps/[year]/+page.server')).load as never;
  });
  const call = (year: string, q: string, isAdmin: boolean) => {
    try { return load({ params: { year }, url: new URL(`http://x/recaps/${year}${q}`), locals: { isAdmin } }); } catch (e) { return e as { status: number }; }
  };
  it('404 for a bad year, an unopened year, a public preview, a year without brews', () => {
    expect(call('abc', '', false)).toMatchObject({ status: 404 });
    expect(call(String(cur), '', true)).toMatchObject({ status: 404 });
    expect(call(String(cur), '?preview=1', false)).toMatchObject({ status: 404 });
    expect(call(String(cur - 5), '', true)).toMatchObject({ status: 404 });
  });
  it('opened year is public; admin previews the current year', () => {
    expect(call(String(cur - 1), '', false)).toMatchObject({ isAdmin: false, recap: { year: cur - 1, preview: false } });
    expect(call(String(cur), '?preview=1', true)).toMatchObject({ isAdmin: true, recap: { preview: true }, state: { preview: true } });
  });
});
