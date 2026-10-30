import { describe, it, expect } from 'vitest';
import { isHttpError } from '@sveltejs/kit';

process.env.DB_PATH = ':memory:';

import { getDb } from '$lib/server/db';
import { createCoffee } from '$lib/server/coffees';
import { setRoasterWebsite } from '$lib/server/roasterWebsites';
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
  it('treats www.x.com and x.com as one site, and survives a malformed stored recipe URL', async () => {
    setRoasterWebsite(db, 'Sey', 'https://www.sey.example');
    const put = (url: string) => db.prepare(`INSERT INTO roaster_recipes (roaster, url, title, snippet, searched_at) VALUES ('Sey', ?, 't', NULL, 'x')
      ON CONFLICT(roaster) DO UPDATE SET url = excluded.url`).run(url);
    put('https://sey.example/guide');
    expect(await run(brewed.slug)).toMatchObject({ recipeHost: 'sey.example', recipeOwn: true });
    put('not a url');
    expect(await run(brewed.slug)).toMatchObject({ recipeHost: null, recipeOwn: false });
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

describe('E9/E6 filters follow the dripper', () => {
  it('lists the dripper\'s filters, the rest as other; a bogus filter falls back', async () => {
    db.exec(`INSERT INTO beanconqueror_methods (id, name, imported_at) VALUES ('m3', 'Graycano - Sibarist Fast', 'x')`);
    db.prepare(`INSERT INTO beanconqueror_brews (bc_created_at, bean_id, preparation_id, mill_id, grind_setting, rating, imported_at)
      VALUES (?, ?, 'm3', 'g1', '5.5', 8, 'x')`).run(`${today}T08:00:09.000Z`, `bean${brewed.id}`);
    const gr = await run(brewed.slug, '?dripper=graycano');
    expect(gr.options.filters).toEqual(['Sibarist Fast']);
    expect(gr.options.otherFilters).toEqual([]); // Graycano stands alone: no same-class drippers, so no Other
    const v60 = await run(brewed.slug, '?dripper=v60&filter=sibarist+fast');
    expect(v60.options.filters).toEqual(['Cafec Abaca']);
    expect(v60.gear).toMatchObject({ dripper: 'V60', filter: 'Cafec Abaca' }); // a filter in neither list loads but falls back to the default
    expect((await run(brewed.slug, '?dripper=v60&filter=nope')).gear.filter).toBe('Cafec Abaca');
    expect(v60.options.drippers).toEqual(expect.arrayContaining(['V60', 'Graycano']));
    db.prepare(`DELETE FROM beanconqueror_brews WHERE preparation_id = 'm3'`).run();
    db.exec(`DELETE FROM beanconqueror_methods WHERE id = 'm3'`);
  });
});

describe('dose / ratio overrides (R19)', () => {
  it('validates against the saved lists, reports the suggestion as the default, and follows into the water', async () => {
    const base = await run(brewed.slug);
    expect(base.defaults).toMatchObject({ dose: base.suggestion.suggestedDose, ratio: base.suggestion.suggestedRatio });
    const { doses, ratios } = base.options, dose = doses[doses.length - 1], ratio = ratios[0];
    const ok = await run(brewed.slug, `?dose=${dose}&ratio=${ratio}`);
    expect(ok.suggestion).toMatchObject({ dose, ratio });
    expect(ok.suggestion.rows.find((r: { setting: string }) => r.setting === 'dose').value).toBe(`${dose}g · ${Math.round(dose * ratio)}g water`);
    expect((await run(brewed.slug, '?dose=19')).suggestion.dose).toBe(base.suggestion.dose);
  });
});

describe('?/openCoffee', () => {
  const open = (isAdmin: boolean, slug: string) => actions.openCoffee({ params: { slug }, locals: { isAdmin } } as never) as Promise<any>;
  it('401s without admin; opens a backlog coffee; page data shows its status', async () => {
    expect((await run(fresh.slug)).coffee.status).toBe('backlog');
    await expect(open(false, fresh.slug)).rejects.toMatchObject({ status: 401 });
    expect(await open(true, fresh.slug)).toEqual({ opened: true });
    expect((await run(fresh.slug)).coffee.status).toBe('open');
    expect(await open(true, fresh.slug)).toEqual({ opened: true }); // already open: nothing changes
    try { await open(true, 'nope'); expect.unreachable(); } catch (e) { expect(isHttpError(e, 404)).toBe(true); }
  });
});

describe('?/unopenCoffee', () => {
  const act = (name: 'openCoffee' | 'unopenCoffee', isAdmin: boolean, slug: string) => actions[name]({ params: { slug }, locals: { isAdmin } } as never) as Promise<any>;
  it('401s without admin; an admin sends an open coffee back to the backlog', async () => {
    await act('openCoffee', true, fresh.slug);
    await expect(act('unopenCoffee', false, fresh.slug)).rejects.toMatchObject({ status: 401 });
    expect((await run(fresh.slug)).coffee.status).toBe('open');
    expect(await act('unopenCoffee', true, fresh.slug)).toEqual({ unopened: true });
    expect((await run(fresh.slug)).coffee.status).toBe('backlog');
  });
});

describe('this coffee summary', () => {
  it('has bullets for everyone, with note bullets only for the admin', async () => {
    const anon = await run(brewed.slug), admin = await run(brewed.slug, '', true);
    expect(anon.thisCoffeeSummary.length).toBeGreaterThanOrEqual(2);
    expect(JSON.stringify(anon.thisCoffeeSummary)).not.toContain('try finer');
    expect(admin.thisCoffeeSummary.join(' ')).toContain('try finer next');
    expect(admin.thisCoffeeSummary.length).toBeLessThanOrEqual(5);
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
    expect(await post(brewed.slug, true, { grinder: 'A4Z', grind: '99', suggestion: 'x' })).toMatchObject({ marked: true, markId: expect.any(Number) });
    const d = await run(brewed.slug);
    expect(d.marks).toHaveLength(1);
    expect(d.marks[0]).toMatchObject({ status: 'pending', gear: { grinder: 'A4Z' } });
    expect(JSON.stringify(d.marks)).not.toContain('99');
    expect(JSON.stringify(d.marks)).not.toContain('try finer');
  });
});

describe('?/deleteMark', () => {
  const del = (isAdmin: boolean, id: string) =>
    actions.deleteMark({ locals: { isAdmin }, request: new Request('http://x', { method: 'POST', body: new URLSearchParams({ id }) }) } as never) as Promise<any>;
  it('401s without admin; deletes a pending mark; refuses an unknown or non-pending one', async () => {
    const id = (await run(brewed.slug)).marks[0].id;
    await expect(del(false, String(id))).rejects.toMatchObject({ status: 401 });
    expect(await del(true, String(id))).toEqual({ deleted: true });
    expect((await run(brewed.slug)).marks).toEqual([]);
    expect(await del(true, String(id))).toMatchObject({ status: 400 });
    expect(await del(true, 'x')).toMatchObject({ status: 400 });
  });
});
