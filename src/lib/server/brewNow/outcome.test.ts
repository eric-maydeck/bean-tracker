import { describe, it, expect, beforeEach } from 'vitest';

process.env.DB_PATH = ':memory:';

import { getDb } from '$lib/server/db';
import { createCoffee } from '$lib/server/coffees';
import { addMark, deleteMark, linkMarks, marksFor, biasLine, type MarkView } from './outcome';
import type { Suggestion } from './suggest';

const db = getDb();
const mk = (roaster: string, name: string) => {
  const c = createCoffee(db, { roaster, coffee_name: name, origin: 'Kenya', roast_level: 'Light', processing: 'Washed', amount_g: 250, cost: 20,
    roast_date: '2026-09-01', frozen_start_date: null, frozen_end_date: null, rest_days_low: null, rest_days_high: null, image_url: null });
  db.prepare(`INSERT INTO beanconqueror_beans (id, name, roaster, imported_at, coffee_id) VALUES (?, ?, ?, 'x', ?)`).run(`bean${c.id}`, name, roaster, c.id);
  return c;
};
db.exec(`INSERT INTO beanconqueror_grinders (id, name, imported_at) VALUES ('g1', 'ZP6', 'x');
  INSERT INTO beanconqueror_methods (id, name, imported_at) VALUES ('m1', 'V60 - Cafec Abaca', 'x');`);
const a = mk('Sey', 'Kiambu');
const b = mk('Onyx', 'Other');
const brew = (c: { id: number }, at: string, grind = '5.5', temp = 94) =>
  Number(db.prepare(`INSERT INTO beanconqueror_brews (bc_created_at, bean_id, preparation_id, mill_id, grind_setting, rating, ground_coffee_g,
    brew_temperature, water_amount_g, imported_at) VALUES (?, ?, 'm1', 'g1', ?, 8, 15, ?, 250, 'x')`).run(at, `bean${c.id}`, grind, temp).lastInsertRowid);
const row = (setting: string, value: string | null) => ({ setting, value, reason: '', tier: 1, confidence: 'good', evidence: [], link: null });
const sug = { rows: [row('grind', '5.5'), row('temp', '94 °C'), row('dose', '15 g'), row('recipe', null), row('water', null)],
  confidence: 'good', basis: '', lastNote: 'secret note' } as unknown as Suggestion;
const gear = { grinder: 'ZP6', dripper: 'V60', filter: 'Cafec Abaca' };
const mark = (c: { id: number }, now: string) => addMark(db, { coffeeId: c.id, gear, suggestion: sug, now: new Date(now) });

const NOW = new Date('2026-10-20T20:00:00Z');
const link = (now = NOW) => linkMarks(db, now);

beforeEach(() => db.exec(`DELETE FROM brew_now_marks; DELETE FROM beanconqueror_brews;`));

describe('outcome', () => {
  it('links a later brew and shows what changed, without notes', () => {
    mark(a, '2026-10-20T14:00:00Z'); // 08:00 local (MDT)
    brew(a, '2026-10-20T09:30:00.000Z', '6.0', 94);
    expect(link()).toBe(1);
    const [m] = marksFor(db, a.id);
    expect(m).toMatchObject({ markedLocal: '2026-10-20T08:00', status: 'linked', rating: 8, gear });
    expect(m.diffs).toEqual([
      { setting: 'grind', suggested: '5.5', actual: '6.0' },
      { setting: 'dose', suggested: '15 g', actual: '15 g' }
    ].filter((d) => d.suggested !== d.actual));
    expect(JSON.stringify(m)).not.toContain('secret');
  });
  it('leaves a mark pending when the only brew is earlier', () => {
    brew(a, '2026-10-20T07:00:00.000Z');
    mark(a, '2026-10-20T14:00:00Z');
    expect(link()).toBe(0);
    expect(marksFor(db, a.id)[0]).toMatchObject({ status: 'pending', brewId: null, diffs: [], rating: null });
  });
  it('links only the latest of two marks before one brew; the older is skipped', () => {
    mark(a, '2026-10-20T14:00:00Z');
    mark(a, '2026-10-20T15:00:00Z');
    const id = brew(a, '2026-10-20T10:30:00.000Z');
    expect(link()).toBe(1);
    expect(marksFor(db, a.id).map((m) => [m.markedLocal, m.status, m.brewId])).toEqual([
      ['2026-10-20T09:00', 'linked', id], ['2026-10-20T08:00', 'skipped', null]
    ]);
  });
  it('never links a brew of another coffee, and a second run is a no-op', () => {
    mark(a, '2026-10-20T14:00:00Z');
    brew(b, '2026-10-20T10:30:00.000Z');
    expect(link()).toBe(0);
    brew(a, '2026-10-20T11:00:00.000Z');
    expect(link()).toBe(1);
    expect(link()).toBe(0);
  });
  it('treats a linked mark whose brew was deleted as pending and re-links it later', () => {
    mark(a, '2026-10-20T14:00:00Z');
    const id = brew(a, '2026-10-20T10:30:00.000Z');
    link();
    db.prepare('DELETE FROM beanconqueror_brews WHERE id = ?').run(id);
    expect(marksFor(db, a.id)[0]).toMatchObject({ status: 'pending', diffs: [], brewId: null });
    const next = brew(a, '2026-10-21T07:30:00.000Z');
    expect(link()).toBe(1);
    expect(marksFor(db, a.id)[0]).toMatchObject({ status: 'linked', brewId: next });
  });
  it('returns at most 5, newest first', () => {
    for (let i = 0; i < 7; i++) mark(a, `2026-10-2${i}T14:00:00Z`);
    const m = marksFor(db, a.id);
    expect(m).toHaveLength(5);
    expect(m[0].markedLocal > m[4].markedLocal).toBe(true);
  });
  it('links a brew logged in the same minute as the mark', () => {
    mark(a, '2026-10-20T14:00:00Z');
    brew(a, '2026-10-20T14:00:30.000Z');
    expect(link()).toBe(1);
  });
  it('compares grind numerically, trims water, and holds the recipe diff until a recipe matches', () => {
    addMark(db, { coffeeId: a.id, gear, now: new Date('2026-10-20T14:00:00Z'),
      suggestion: { ...sug, rows: [row('grind', '5'), row('temp', '94 °C'), row('dose', '15 g'), row('recipe', 'Rec'), row('water', 'Soft')] } as unknown as Suggestion });
    db.exec(`INSERT INTO beanconqueror_waters (id, name, imported_at) VALUES ('w1', 'Soft ', 'x')`);
    const id = brew(a, '2026-10-20T10:30:00.000Z', '5.0', 94);
    db.prepare(`UPDATE beanconqueror_brews SET water_id = 'w1' WHERE id = ?`).run(id);
    link();
    expect(marksFor(db, a.id)[0].diffs).toEqual([]);
  });
});

describe('marks expire after 24 h (E10)', () => {
  it('a pending mark with no brew in 24 h expires; a late brew no longer links it', () => {
    mark(a, '2026-10-20T14:00:00Z');
    expect(link(new Date('2026-10-21T13:00:00Z'))).toBe(0);
    expect(marksFor(db, a.id)[0].status).toBe('pending');
    brew(a, '2026-10-21T09:00:00.000Z'); // 27 h after the mark
    expect(link(new Date('2026-10-21T15:00:00Z'))).toBe(0);
    expect(marksFor(db, a.id)[0]).toMatchObject({ status: 'expired', brewId: null });
  });
  it('a brew within 24 h still links', () => {
    mark(a, '2026-10-20T14:00:00Z');
    brew(a, '2026-10-21T07:59:00.000Z');
    expect(link(new Date('2026-10-22T20:00:00Z'))).toBe(1);
  });
  it('deleteMark removes only a pending mark', () => {
    mark(a, '2026-10-20T14:00:00Z');
    mark(b, '2026-10-20T14:00:00Z');
    brew(b, '2026-10-20T10:30:00.000Z');
    link();
    const [pending] = marksFor(db, a.id), [linked] = marksFor(db, b.id);
    expect(deleteMark(db, linked.id)).toBe(false);
    expect(deleteMark(db, pending.id)).toBe(true);
    expect(marksFor(db, a.id)).toEqual([]);
  });
  it('a followed grind range counts as no difference', () => {
    addMark(db, { coffeeId: a.id, gear, now: new Date('2026-10-20T14:00:00Z'),
      suggestion: { ...sug, rows: [row('grind', '5.5–5.7'), row('temp', '94 °C'), row('dose', '15 g'), row('recipe', null), row('water', null)] } as unknown as Suggestion });
    brew(a, '2026-10-20T10:30:00.000Z', '5.6', 94);
    link();
    expect(marksFor(db, a.id)[0].diffs).toEqual([]);
  });
});

describe('biasLine', () => {
  const m = (grind: [string, string] | null, temp: [string, string] | null, status: MarkView['status'] = 'linked'): MarkView => ({
    id: 1, markedLocal: '', status, gear, rating: null, brewId: status === 'linked' ? 1 : null,
    diffs: [...(grind ? [{ setting: 'grind' as const, suggested: grind[0], actual: grind[1] }] : []),
      ...(temp ? [{ setting: 'temp' as const, suggested: temp[0], actual: temp[1] }] : [])]
  });
  it('needs two linked tries and a consistent direction', () => {
    expect(biasLine([m(['5.5', '5.0'], null)])).toBeNull();
    expect(biasLine([m(['5.5', '5.0'], null), m(null, null, 'pending'), m(null, null)])).toBeNull(); // one real diff only
    expect(biasLine([m(['5.5', '5.0'], null), m(['5.5', '6.0'], null)])).toBeNull(); // mixed
  });
  it('says which way grind and temp lean', () => {
    const t = ['94 °C', '95 °C'] as [string, string];
    expect(biasLine([m(['5.5', '5.0'], t), m(['5.5', '4.5'], t), m(null, null), m(['5.5', '5.1'], t)]))
      .toBe('Last 4 tries: lower grind setting than suggested 3\u00d7, temp +0.8 \u00b0C on average');
  });
});
