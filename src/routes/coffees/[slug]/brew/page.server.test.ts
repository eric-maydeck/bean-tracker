import { describe, it, expect } from 'vitest';
import { isHttpError } from '@sveltejs/kit';

process.env.DB_PATH = ':memory:';

import { getDb } from '$lib/server/db';
import { createCoffee } from '$lib/server/coffees';
import { actions, load } from './+page.server';

const db = getDb();
const mk = (roaster: string, name: string) => {
  const c = createCoffee(db, { roaster, coffee_name: name, origin: 'Kenya', roast_level: 'Light', processing: 'Washed', amount_g: 250, cost: 20,
    roast_date: '2026-09-01', frozen_start_date: null, frozen_end_date: null, rest_days_low: null, rest_days_high: null, image_url: null });
  db.prepare(`INSERT INTO beanconqueror_beans (id, name, roaster, imported_at, coffee_id) VALUES (?, ?, ?, 'x', ?)`).run(`bean${c.id}`, name, roaster, c.id);
  return c;
};
db.exec(`INSERT INTO beanconqueror_grinders (id, name, imported_at) VALUES ('g1', 'ZP6', 'x'), ('g2', 'A4Z', 'x');
  INSERT INTO beanconqueror_methods (id, name, imported_at) VALUES ('m1', 'V60 - Cafec Abaca', 'x');`);
const brewed = mk('Sey', 'Kiambu');
const fresh = mk('Nobody Yet', 'Fresh Lot');
const today = new Date().toISOString().slice(0, 10);
for (const [i, mill] of ['g1', 'g1', 'g2'].entries())
  db.prepare(`INSERT INTO beanconqueror_brews (bc_created_at, bean_id, preparation_id, mill_id, grind_setting, rating, ground_coffee_g, brew_temperature,
    water_amount_g, best_brew, imported_at) VALUES (?, ?, 'm1', ?, '5.5', 8, 15, 94, 250, ?, 'x')`).run(`${today}T08:00:0${i}.000Z`, `bean${brewed.id}`, mill, i === 0 ? 1 : 0);

db.prepare(`UPDATE beanconqueror_brews SET notes = 'try finer next' WHERE best_brew = 1`).run();
const run = (slug: string, qs = '', isAdmin = false) =>
  load({ params: { slug }, url: new URL(`http://x/coffees/${slug}/brew${qs}`), setHeaders: () => {}, locals: { isAdmin } } as never) as Promise<any>;

describe('brew now load', () => {
  it('404 for an unknown slug', async () => {
    try { await run('nope'); expect.unreachable(); } catch (e) { expect(isHttpError(e, 404)).toBe(true); }
  });
  it('falls back to the default grinder for an unknown one, and passes ?why through', async () => {
    const d = await run(brewed.slug, '?grinder=nope&why=grind');
    expect(d.gear.grinder).toBe('ZP6');
    expect(d.why).toBe('grind');
    expect((await run(brewed.slug, '?grinder=a4z')).gear.grinder).toBe('A4Z');
  });
  it('lists this coffee newest first with the Best brew pinned, roaster recipe stubbed', async () => {
    const d = await run(brewed.slug);
    expect(d.thisCoffee.map((r: { best: boolean }) => r.best)).toEqual([true, false, false]);
    expect(d.neverBrewedRoaster).toBe(false);
    expect(d.roasterRecipe).toBeNull();
  });
  it('keeps notes private: stripped for anonymous, kept for admin', async () => {
    const anon = await run(brewed.slug);
    expect(JSON.stringify(anon)).not.toContain('try finer');
    expect(anon.suggestion.lastNote).toBeNull();
    expect(anon.thisCoffee.every((b: { notes: string | null }) => b.notes === null)).toBe(true);
    const admin = await run(brewed.slug, '', true);
    expect(admin.thisCoffee[0].notes).toBe('try finer next');
    expect(admin.suggestion.lastNote).toContain('try finer');
  });
  it('flags a roaster with no brews', async () => {
    const d = await run(fresh.slug);
    expect(d.neverBrewedRoaster).toBe(true);
    expect(d.thisCoffee).toEqual([]);
  });
});

describe('dripper-aware filter default', () => {
  it('picking another dripper switches to its own most used filter', async () => {
    db.exec(`INSERT INTO beanconqueror_methods (id, name, imported_at) VALUES ('m2', 'Graycano - Sibarist Fast', 'x')`);
    for (const i of [3, 4]) db.prepare(`INSERT INTO beanconqueror_brews (bc_created_at, bean_id, preparation_id, mill_id, grind_setting, rating, imported_at)
      VALUES (?, ?, 'm2', 'g1', '5.5', 8, 'x')`).run(`${today}T08:00:0${i}.000Z`, `bean${brewed.id}`);
    const d = await run(brewed.slug, '?dripper=graycano');
    expect(d.gear).toMatchObject({ dripper: 'Graycano', filter: 'Sibarist Fast' });
    expect(d.defaults.filter).toBe('Sibarist Fast');
    db.prepare(`DELETE FROM beanconqueror_brews WHERE preparation_id = 'm2'`).run();
    db.exec(`DELETE FROM beanconqueror_methods WHERE id = 'm2'`);
  });
});

describe('?/brewThis', () => {
  const post = (slug: string, isAdmin: boolean, fields: Record<string, string> = {}) =>
    actions.brewThis({ params: { slug }, locals: { isAdmin }, request: new Request('http://x', { method: 'POST', body: new URLSearchParams(fields) }) } as never);
  it('401s without admin and stores nothing', async () => {
    await expect(post(brewed.slug, false)).rejects.toMatchObject({ status: 401 });
    expect((await run(brewed.slug)).marks).toEqual([]);
  });
  it('re-derives the suggestion from the posted gear, ignoring posted values', async () => {
    expect(await post(brewed.slug, true, { grinder: 'A4Z', grind: '99', suggestion: 'x' })).toEqual({ marked: true });
    const d = await run(brewed.slug);
    expect(d.marks).toHaveLength(1);
    expect(d.marks[0]).toMatchObject({ status: 'pending', gear: { grinder: 'A4Z' } });
    expect(JSON.stringify(d.marks)).not.toContain('99');
    expect(JSON.stringify(d.marks)).not.toContain('try finer');
  });
});
