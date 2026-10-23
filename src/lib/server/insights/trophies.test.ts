import { describe, it, expect } from 'vitest';
import { createDb } from '$lib/server/db';
import { MIXED_FILTER, type BrewFact } from './facts';
import type { GearDetail } from '$lib/server/gearDetails';
import { gearArchive, trophyCase, type GearArchive } from './trophies';

let n = 0;
const brew = (o: Partial<BrewFact>): BrewFact => ({
  id: ++n, coffeeId: 1, localTime: '2026-09-15T08:00', localDate: '2026-09-15', backfilled: false, dose: null, rating: null, roaster: null,
  origin: null, processGroup: 'Washed', roastLevel: null, decaf: false, brewer: null, brewerType: 'pourover', waterG: null, ratio: null,
  grind: null, dripper: null, filter: null, water: null, waterProfile: null, restDays: null, costPerBrew: null, brewTimeSeconds: null,
  bloomSeconds: null, grinder: null, hasNote: false, brewIndex: 0, tempC: null, ...o
});
const none: GearArchive = { dripper: new Set(), grinder: new Set(), filter: new Set() };
const T = '2026-10-22';
const ago = (d: number) => new Date(Date.parse(T) - d * 864e5).toISOString().slice(0, 10);

describe('trophyCase', () => {
  it('one card per dripper, grinder and filter, all brews, raw ratings', () => {
    const xs = [
      brew({ dripper: 'V60', filter: 'Abaca', grinder: 'ZP6', dose: 15, rating: 8, coffeeId: 1, localDate: '2026-10-01' }),
      brew({ dripper: 'V60', filter: 'Abaca', grinder: 'ZP6', dose: 16, rating: null, coffeeId: 2, localDate: '2026-10-20' }),
      brew({ dripper: 'V60', filter: 'Sibarist', grinder: null, dose: null, rating: 6, coffeeId: 1, localDate: '2026-10-21' })
    ];
    const v60 = trophyCase(xs, none, T).find((t) => t.key === 'dripper-v60')!;
    expect(v60).toMatchObject({ kind: 'dripper', name: 'V60', brews: 3, grams: 31, rating: 7, best: 8, bags: 2, days: 3,
      firstUsed: '2026-10-01', lastUsed: '2026-10-21', favorite: { name: 'Abaca', brews: 2 }, retired: false });
    expect(trophyCase(xs, none, T).map((t) => t.key)).toEqual(['dripper-v60', 'filter-abaca', 'filter-sibarist', 'grinder-zp6']);
  });
  it('no rated brews: rating and best are null', () => {
    const t = trophyCase([brew({ dripper: 'V60', rating: null }), brew({ dripper: 'V60', rating: 0 })], none, T)[0];
    expect(t).toMatchObject({ rating: null, best: null });
    expect(t.sample).toMatchObject({ brews: 0, small: false }); // pooled(): no rated brews is no data, not low confidence
  });
  it('mixed filter gets no card and is never a favorite', () => {
    const xs = [brew({ dripper: 'Gabi', filter: MIXED_FILTER, localDate: '2026-10-20' }), brew({ dripper: 'Gabi', filter: MIXED_FILTER, localDate: '2026-10-21' })];
    const ts = trophyCase(xs, none, T);
    expect(ts.map((t) => t.key)).toEqual(['dripper-gabi']);
    expect(ts[0].favorite).toBeNull();
  });
  it('retired: archived, or last brew more than 90 days ago', () => {
    const at = (d: number, grinder = 'G') => trophyCase([brew({ grinder, localDate: ago(d) })], none, T)[0];
    expect(at(90).retired).toBe(false);
    expect(at(91).retired).toBe(true);
    const z = trophyCase([brew({ grinder: 'ZP6', localDate: T })], { ...none, grinder: new Set(['ZP6']) }, T)[0];
    expect(z).toMatchObject({ archived: true, retired: true });
  });
  it('favorite ties break on mean rating, then name', () => {
    const d = (filter: string, rating: number) => brew({ dripper: 'V60', filter, rating });
    const fav = (xs: BrewFact[]) => trophyCase(xs, none, T).find((t) => t.key === 'dripper-v60')!.favorite;
    expect(fav([d('B', 6), d('A', 8)])).toEqual({ name: 'A', brews: 1 });
    expect(fav([d('B', 8), d('A', 8)])).toEqual({ name: 'A', brews: 1 });
  });
});

describe('trophyCase scope', () => {
  const xs = () => [
    brew({ id: 1, dripper: 'V60', filter: 'A', dose: 15, rating: 8, coffeeId: 1, localDate: '2026-06-01' }),
    brew({ id: 2, dripper: 'V60', filter: 'A', dose: 15, rating: 6, coffeeId: 2, localDate: '2026-10-10' }),
    brew({ id: 3, dripper: 'V60', filter: 'B', dose: 10, rating: 9, coffeeId: 2, localDate: '2026-10-20' }),
    brew({ id: 4, dripper: 'Old', dose: 15, rating: 7, coffeeId: 3, localDate: '2026-05-01' })
  ];
  const month = { start: '2026-10-01', end: T };
  it('Period scopes counts and ratings; first/last used and retired stay lifetime', () => {
    const ts = trophyCase(xs(), none, T, { period: month });
    const v60 = ts.find((t) => t.key === 'dripper-v60')!;
    expect(v60).toMatchObject({ brews: 2, grams: 25, rating: 7.5, best: 9, bags: 1, days: 2, favorite: { name: 'B', brews: 1 }, // 1 brew each: the higher-rated partner
      firstUsed: '2026-06-01', lastUsed: '2026-10-20', retired: false });
  });
  it('gear with no brew in the Period gets no card', () => {
    const ts = trophyCase(xs(), none, T, { period: month });
    expect(ts.map((t) => t.key)).not.toContain('dripper-old');
    expect(trophyCase(xs(), none, T).map((t) => t.key)).toContain('dripper-old');
  });
  it('retired is judged on all brews even when the Period is short', () => {
    const ts = trophyCase(xs(), none, T, { period: { start: '2026-05-01', end: '2026-05-31' } });
    expect(ts.map((t) => t.key)).toEqual(['dripper-old']);
    expect(ts[0].retired).toBe(true);
    const v = trophyCase(xs(), none, T, { period: { start: '2026-06-01', end: '2026-06-30' } })[0];
    expect(v).toMatchObject({ key: 'dripper-v60', brews: 1, retired: false, lastUsed: '2026-10-20' }); // last used is lifetime
  });
  it('the Ratings and Brews switches change only rating, best and sample', () => {
    const base = trophyCase(xs(), none, T, { period: { start: null, end: T } }).find((t) => t.key === 'dripper-v60')!;
    // Calibrated drops ratings before RATINGS_SETTLED_FROM; Once dialed nulls a brew's rating.
    const dialed = xs().map((b) => (b.id === 3 ? { ...b, rating: null, dialRating: 9 } : b));
    const sw = trophyCase(xs(), none, T, { ratings: 'all', scored: dialed }).find((t) => t.key === 'dripper-v60')!;
    expect(sw).toMatchObject({ rating: 7, best: 8, brews: base.brews, grams: base.grams, bags: base.bags, days: base.days, favorite: base.favorite });
    // The sample counts the dial-in brew (before the skip, like the other tabs); the average does not.
    expect(sw.sample).toMatchObject({ brews: 3, scored: 2 });
    const cal = trophyCase(xs(), none, T, { ratings: 'current' }).find((t) => t.key === 'dripper-old')!; // before the settled date
    expect(cal).toMatchObject({ brews: 1, grams: 15, rating: null, best: null });
  });
});

describe('gearArchive', () => {
  it('a grinder by its row; a dripper/filter only when every method parsing to it is archived', () => {
    const db = createDb(':memory:');
    const now = '2026-10-09T00:00:00.000Z';
    const m = db.prepare(`INSERT INTO beanconqueror_methods (id, name, preparation_style, preparation_tools, bc_archived, imported_at) VALUES (?, ?, 'POUR OVER', '', ?, ?)`);
    m.run('m1', 'V60 - Abaca', 1, now);
    m.run('m2', 'V60 - Sibarist', 0, now);
    const g = db.prepare(`INSERT INTO beanconqueror_grinders (id, name, bc_archived, imported_at) VALUES (?, ?, ?, ?)`);
    g.run('g1', 'ZP6', 1, now);
    g.run('g2', 'C40', 0, now);
    const a = gearArchive(db);
    expect([...a.dripper]).toEqual([]);
    expect([...a.filter]).toEqual(['Abaca']);
    expect([...a.grinder]).toEqual(['ZP6']);
  });

  describe('stored details', () => {
    const detail = (o: Partial<GearDetail>): GearDetail => ({ kind: 'dripper', name: 'V60', values: { brand: 'Hario' }, imageUrl: null,
      imageCopy: null, imageFill: null, createdAt: '2026-10-01T00:00:00.000Z', updatedAt: '2026-10-02T00:00:00.000Z', ...o });
    const xs = [brew({ dripper: 'V60', grinder: 'ZP6', localDate: '2026-10-20' })];
    it('ignores stored rows with no brews', () => {
      const ts = trophyCase(xs, none, T, {}, [detail({ name: 'Old Name' })]);
      expect(ts.map((t) => t.key)).toEqual(['dripper-v60', 'grinder-zp6']);
      expect(ts.every((t) => Object.keys(t.values).length === 0 && t.image === null)).toBe(true);
    });
    it('attaches values and image by kind + name', () => {
      const ts = trophyCase(xs, none, T, {}, [detail({ imageUrl: 'https://x/a.png', imageCopy: '/img/gear/a.webp', imageFill: '#112233' }),
        detail({ name: 'v60' }), detail({ kind: 'grinder' })]);
      const v60 = ts.find((t) => t.key === 'dripper-v60')!;
      expect(v60).toMatchObject({ values: { brand: 'Hario' }, imageUrl: 'https://x/a.png', image: { src: '/img/gear/a.webp', fill: '#112233' },
        createdAt: '2026-10-01T00:00:00.000Z', updatedAt: '2026-10-02T00:00:00.000Z' });
      expect(ts.find((t) => t.key === 'grinder-zp6')).toMatchObject({ values: {}, image: null, createdAt: null, updatedAt: null });
    });
  });
});
