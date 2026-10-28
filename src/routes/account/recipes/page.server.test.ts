import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';

// Own in-memory DB for this file (getDb is a DB_PATH-keyed singleton).
process.env.DB_PATH = ':memory:';

import { getDb } from '$lib/server/db';
import { compactFlow } from '$lib/server/bcFlow';
import { saveShot } from '$lib/server/visualizerUpload';
import { readStale } from '$lib/server/pourReadings';
import { listRecipes } from '$lib/server/recipes';
import { draftFromReadings } from '$lib/recipes';
import type { PourReading } from '$lib/pours';
import { actions, load } from './+page.server';

const flow = compactFlow(JSON.parse(readFileSync(new URL('../../../lib/server/fixtures/bcflow/bbs.json', import.meta.url), 'utf8')))!;
const uuid = (i: number) => `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`;
const event = (isAdmin: boolean, query = '', fields: Record<string, string> = {}) => {
  const body = new FormData();
  for (const [k, v] of Object.entries(fields)) body.set(k, v);
  return {
    locals: { isAdmin },
    url: new URL(`https://beans.example/account/recipes${query}`),
    request: new Request('http://localhost/account/recipes', { method: 'POST', body })
  } as never;
};
type Data = Awaited<ReturnType<typeof load>> & Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

describe('recipes page', () => {
  const db = getDb();
  const N = 10; // MIN_GROUP
  for (let i = 1; i <= N; i++) {
    db.prepare(
      `INSERT INTO beanconqueror_brews (bc_created_at, bc_uuid, water_amount_g, ground_coffee_g, brew_time, notes, rating, has_flow_profile, imported_at)
       VALUES (?, ?, 295.3, 18, '117', ?, 8, 1, 'x')`
    ).run(`2026-02-${String(i).padStart(2, '0')}T08:30:00Z`, uuid(i), i < 3 ? 'BBS.' : null);
    saveShot(db, { uuid: uuid(i), flow });
  }
  readStale(db, -1);
  const key = (db.prepare(`SELECT structure_key k FROM brew_pour_readings LIMIT 1`).get() as { k: string }).k;

  it('redirects a signed-out visitor to sign in', () => {
    try {
      load(event(false));
      expect.unreachable();
    } catch (e) {
      expect(e).toMatchObject({ status: 303, location: '/login?redirectTo=%2Faccount%2Frecipes' });
    }
  });

  it('lists groups, and brews only for a ?brews= URL, never touching the raw flows', () => {
    const spy = vi.spyOn(db, 'prepare');
    const d = load(event(true)) as Data;
    expect(d.groups).toHaveLength(1);
    expect(d.groups[0]).toMatchObject({ key, count: N, tagged: 2, suggestedName: 'BBS' });
    expect(d.brews).toBeNull();
    expect(d.totals).toEqual({ read: N, lowConfidence: 0, notesOnly: 0 });
    const withBrews = load(event(true, `?brews=s${key}`)) as Data;
    expect(withBrews.brews).toHaveLength(10);
    expect(withBrews.unlisted).toBeNull(); // it is a listed group
    expect(load(event(true, '?brews=zzz&view=nope')) as Data).toMatchObject({ brews: null, hidden: null });
    expect(spy.mock.calls.map((c) => String(c[0])).filter((s) => s.includes('brew_flows'))).toEqual([]);
    spy.mockRestore();
  });

  it('order=top lists the best rated first, newest first among equals', () => {
    db.prepare(`UPDATE beanconqueror_brews SET rating = 10 WHERE bc_uuid = ?`).run(uuid(2));
    const top = (load(event(true, `?brews=s${key}&order=top`)) as Data).brews as { date: string; rating: number }[];
    expect(top.map((b) => b.rating).slice(0, 2)).toEqual([10, 8]);
    expect(top[1].date).toBe('2026-02-10'); // newest of the 8s
    const latest = (load(event(true, `?brews=s${key}`)) as Data).brews as { date: string }[];
    expect(latest[0].date).toBe('2026-02-10');
    db.prepare(`UPDATE beanconqueror_brews SET rating = 8 WHERE bc_uuid = ?`).run(uuid(2));
  });

  it('every action rejects a signed-out request', async () => {
    for (const a of [actions.saveRecipe, actions.deleteRecipe, actions.dismiss, actions.undismiss])
      await expect(a(event(false))).rejects.toMatchObject({ status: 401 });
  });

  it('saveRecipe: bad JSON, duplicate name, then a valid save rematches brews', async () => {
    const def = draftFromReadings(
      [JSON.parse((db.prepare(`SELECT reading FROM brew_pour_readings LIMIT 1`).get() as { reading: string }).reading) as PourReading],
      [null]
    );
    const bad = await actions.saveRecipe(event(true, '', { name: 'R', tags: '', definition: '{nope' }));
    expect(bad).toMatchObject({ status: 400, data: { error: 'Invalid recipe' } });
    const ok = await actions.saveRecipe(event(true, '', { name: 'Mine', tags: 'bbs, b', definition: JSON.stringify(def) }));
    expect(ok).toMatchObject({ saved: expect.any(Number) });
    expect(listRecipes(db)).toMatchObject([{ name: 'Mine', tags: ['bbs', 'b'] }]);
    expect(db.prepare(`SELECT COUNT(*) n FROM brew_recipe_matches`).get()).toMatchObject({ n: N });
    const dup = await actions.saveRecipe(event(true, '', { name: 'mine', tags: '', definition: JSON.stringify(def) }));
    expect(dup).toMatchObject({ status: 400, data: { error: 'A recipe with that name exists' } });
    const d = load(event(true)) as Data;
    expect(d.recipes[0]).toMatchObject({ counts: { logged: 2, match: N - 2, modified: 0 } });
    await actions.deleteRecipe(event(true, '', { id: String((ok as { saved: number }).saved) }));
    expect(listRecipes(db)).toEqual([]);
  });

  it('saveRecipe with an id updates in place and rematches; each def error reaches the form verbatim', async () => {
    const reading = JSON.parse((db.prepare(`SELECT reading FROM brew_pour_readings LIMIT 1`).get() as { reading: string }).reading) as PourReading;
    const def = draftFromReadings([reading], [null]);
    const id = (await actions.saveRecipe(event(true, '', { name: 'Edit me', tags: '', definition: JSON.stringify(def) }))) as { saved: number };
    const save = (d: unknown, extra: Record<string, string> = {}) =>
      actions.saveRecipe(event(true, '', { id: String(id.saved), name: 'Edited', tags: 'ed', definition: JSON.stringify(d), ...extra }));
    expect(await save(def)).toMatchObject({ saved: id.saved });
    expect(listRecipes(db)).toMatchObject([{ id: id.saved, name: 'Edited', tags: ['ed'] }]);
    const bad = (d: unknown, error: string) => expect(save(d)).resolves.toMatchObject({ status: 400, data: { error } });
    await bad({ ...def, pours: [] }, 'Add at least one pour');
    await bad({ ...def, pours: def.pours.map((p, i) => ({ ...p, bloom: i === 1 })) }, 'Blooms come first');
    await bad({ ...def, pourCount: { min: 1, max: 1 } }, 'Pour count range must include the pours listed');
    await bad({ ...def, ratio: { target: 40, tol: 0.7 } }, 'Ratio must be between 1:5 and 1:30');
    await bad({ ...def, tempC: 120 }, 'Temperature must be 60-100 °C');
    await bad({ v: 2 }, 'Invalid recipe');
    expect(listRecipes(db)).toHaveLength(1);
    await actions.deleteRecipe(event(true, '', { id: String(id.saved) }));
  });

  it('a dripper lock set from a recipe rematches brews; the lock is the dripper\'s', async () => {
    db.prepare(`INSERT INTO beanconqueror_methods (id, name, preparation_tools, imported_at) VALUES (900, 'Gabi Master A', '', 'x')`).run();
    db.prepare(`UPDATE beanconqueror_brews SET preparation_id = 900`).run();
    const reading = JSON.parse((db.prepare(`SELECT reading FROM brew_pour_readings LIMIT 1`).get() as { reading: string }).reading) as PourReading;
    const def = { ...draftFromReadings([reading], [null]), drippers: ['Gabi Master A'] };
    const other = draftFromReadings([reading], [null]);
    const matched = () => (db.prepare(`SELECT COUNT(*) n FROM brew_recipe_matches`).get() as { n: number }).n;
    expect(((await actions.saveRecipe(event(true, '', { name: 'Any one', tags: '', definition: JSON.stringify(other) }))) as { saved: number }).saved).toBeGreaterThan(0);
    expect(matched()).toBe(N);
    const gabi = (await actions.saveRecipe(event(true, '', { name: 'Gabi one', tags: '', definition: JSON.stringify({ ...def, ratio: { target: 5, tol: 0.1 } }), locks: JSON.stringify({ 'Gabi Master A': true }) }))) as { saved: number };
    expect((load(event(true)) as Data).locked).toEqual(['Gabi Master A']);
    expect((load(event(true)) as Data).drippers).toEqual(['Gabi Master A']);
    expect(matched()).toBe(0); // locked: the Any recipe no longer matches and the Gabi recipe's ratio misses
    await actions.saveRecipe(event(true, '', { id: String(gabi.saved), name: 'Gabi one', tags: '', definition: JSON.stringify(def), locks: JSON.stringify({ 'Gabi Master A': true }) }));
    expect(matched()).toBe(N);
    await actions.saveRecipe(event(true, '', { id: String(gabi.saved), name: 'Gabi one', tags: '', definition: JSON.stringify(def), locks: JSON.stringify({ 'Gabi Master A': false }) }));
    expect((load(event(true)) as Data).locked).toEqual([]);
    for (const r of listRecipes(db)) await actions.deleteRecipe(event(true, '', { id: String(r.id) }));
    db.prepare(`UPDATE beanconqueror_brews SET preparation_id = NULL`).run();
  });

  it('a hidden structure says which recipe now matches its brews, and restoring names it', async () => {
    const reading = JSON.parse((db.prepare(`SELECT reading FROM brew_pour_readings LIMIT 1`).get() as { reading: string }).reading) as PourReading;
    const saved = (await actions.saveRecipe(event(true, '', { name: 'Folded', tags: '', definition: JSON.stringify(draftFromReadings([reading], [null])) }))) as { saved: number };
    await actions.dismiss(event(true, '', { key }));
    expect(((load(event(true, '?view=hidden')) as Data).hidden as unknown[])[0]).toMatchObject({ matchedBy: [{ name: 'Folded', count: N }] });
    expect(await actions.undismiss(event(true, '', { key }))).toMatchObject({ undismissed: key, now: [{ name: 'Folded', count: N }] });
    const rows = (load(event(true, `?brews=r${saved.saved}`)) as Data).brews as { dripper: string | null }[];
    expect(rows[0]).toHaveProperty('dripper');
    await actions.deleteRecipe(event(true, '', { id: String(saved.saved) }));
    expect(await actions.dismiss(event(true, '', { key }))).toBeTruthy();
    expect(await actions.undismiss(event(true, '', { key }))).toMatchObject({ now: [] });
  });

  it('dismiss hides a structure, undismiss brings it back', async () => {
    await actions.dismiss(event(true, '', { key }));
    let d = load(event(true, '?view=hidden')) as Data;
    expect(d.groups).toEqual([]);
    expect(d.hidden).toMatchObject([{ key, count: N }]);
    // A dismissed key still opens its list, in its own panel with its description and count.
    const open = load(event(true, `?brews=s${key}`)) as Data;
    expect(open.unlisted).toMatchObject({ key, count: N, description: expect.stringMatching(/total/) });
    expect(open.brews).toHaveLength(10);
    expect(open.brewsTotal).toBe(N);
    await actions.undismiss(event(true, '', { key }));
    d = load(event(true, '?view=hidden')) as Data;
    expect(d.groups).toHaveLength(1);
    expect(d.hidden).toEqual([]);
  });
});
