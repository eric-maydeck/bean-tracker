import { describe, it, expect } from 'vitest';
import { createDb } from '../db';
import { createCoffee } from '../coffees';
import { saveGearDetails } from '../gearDetails';
import { loadBrewRows, loadGearClass, gearOptions, gearDefaults, coffeeDetails, type BrewRow } from './load';

const db = createDb(':memory:');
let n = 0; // a unique second per brew (the importer's identity index)
const coffee = (roaster: string, name: string, o: { roast?: string | null; amount?: number | null; processing?: string | null; fs?: string | null; fe?: string | null } = {}) => {
  const id = createCoffee(db, { roaster, coffee_name: name, origin: 'Kenya', roast_level: 'Light', processing: o.processing ?? 'Washed',
    amount_g: o.amount === undefined ? 250 : o.amount, cost: 20, roast_date: o.roast === undefined ? '2026-09-01' : o.roast,
    frozen_start_date: o.fs ?? null, frozen_end_date: o.fe ?? null, rest_days_low: null, rest_days_high: null, image_url: null }).id;
  db.prepare(`INSERT INTO beanconqueror_beans (id, name, roaster, imported_at, coffee_id) VALUES (?, ?, ?, 'x', ?)`).run(`bean${id}`, name, roaster, id);
  return id;
};
db.exec(`INSERT INTO beanconqueror_grinders (id, name, bc_archived, imported_at) VALUES ('gz', 'ZP6', 0, 'x'), ('ga', 'A4Z', 1, 'x');
  INSERT INTO beanconqueror_methods (id, name, bc_archived, imported_at) VALUES ('v60', 'V60 - Cafec Abaca', 0, 'x'),
    ('gabi', 'Gabi Master A', 0, 'x'), ('orb', 'ORB Long Soup', 0, 'x'), ('old', 'Old Dripper - Old Filter', 1, 'x'),
    ('gr', 'Graycano - Sibarist Fast', 0, 'x');
  INSERT INTO beanconqueror_waters (id, name, imported_at) VALUES ('w1', 'Third Wave', 'x');
  INSERT INTO recipes (id, name, definition, created_at, updated_at) VALUES (1, 'Rec One', '{}', 'x', 'x');`);
const brew = (c: number, at: string, o: { mill?: string; method?: string; grind?: string | null; rating?: number | null; dose?: number | null;
  temp?: number | null; water?: number | null; best?: number; wid?: string | null } = {}) =>
  db.prepare(`INSERT INTO beanconqueror_brews (bc_created_at, bean_id, preparation_id, mill_id, grind_setting, rating, ground_coffee_g,
      brew_temperature, water_amount_g, best_brew, water_id, imported_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'x')`)
    .run(`${at}T08:00:${String(n++).padStart(2, '0')}.000Z`, `bean${c}`, o.method ?? 'v60', o.mill ?? 'gz', o.grind === undefined ? '5.5' : o.grind,
      o.rating ?? 0, o.dose ?? 15, o.temp ?? 94, o.water ?? 250, o.best ?? 0, o.wid ?? null);

saveGearDetails(db, { kind: 'dripper', name: 'V60', values: { shape: 'Conical' }, imageUrl: null });
saveGearDetails(db, { kind: 'dripper', name: 'Gabi Master A', values: { shape: 'Flat bottom' }, imageUrl: null });
saveGearDetails(db, { kind: 'dripper', name: 'Graycano', values: { shape: 'Conical', ownData: 'Own brews only' }, imageUrl: null });
saveGearDetails(db, { kind: 'filter', name: 'Sibarist Fast', values: { ownData: 'Own brews only' }, imageUrl: null });

describe('loadBrewRows', () => {
  const a = coffee('Sey', 'Kiambu');
  brew(a, '2026-09-11', { rating: 9, best: 1, wid: 'w1' });
  brew(a, '2026-09-12', { grind: 'fine', rating: 0 });
  brew(a, '2026-09-13', { grind: '', mill: 'ga' });
  db.prepare(`INSERT INTO brew_recipe_matches (brew_id, recipe_id, how) VALUES (1, 1, 'match')`).run();
  const rows = loadBrewRows(db);

  it('joins coffee, gear, water, recipe; rating 0 -> null; best flag; rest days', () => {
    expect(rows[0]).toMatchObject({ id: 1, coffeeId: a, roaster: 'Sey', coffeeName: 'Kiambu', origin: 'Kenya', processGroup: 'Washed',
      roastLevel: 'Light', localTime: '2026-09-11T08:00', restDays: 10, grinder: 'ZP6', grind: '5.5', grindNum: 5.005, dripper: 'V60',
      filter: 'Cafec Abaca', tempC: 94, dose: 15, waterG: 250, water: 'Third Wave', recipeId: 1, recipeName: 'Rec One', rating: 9, best: true,
      grinderArchived: false, methodArchived: false });
    expect(rows[1]).toMatchObject({ rating: null, best: false, recipeId: null, recipeName: null, water: null });
  });
  it('grindNum is null for blank or non-numeric grinds; archived flags set', () => {
    expect(rows[1].grindNum).toBeNull();
    expect(rows[2].grindNum).toBeNull();
    expect(rows[2].grinderArchived).toBe(true);
  });
});

describe('loadGearClass', () => {
  const g = loadGearClass(db);
  it('pools conical drippers, keeps others by name', () => {
    expect(g.dripper('V60')).toBe('cone');
    expect(g.dripper('Gabi Master A')).toBe('Gabi Master A');
    expect(g.dripper('ORB Long Soup')).toBe('ORB Long Soup');
    expect(g.dripper('Graycano')).toBe('Graycano'); // ownData beats Conical
  });
  it('filters pool as any unless ownData', () => {
    expect(g.filter('Cafec Abaca')).toBe('any');
    expect(g.filter('Sibarist Fast')).toBe('Sibarist Fast');
  });
});

const row = (o: Partial<BrewRow>): BrewRow => ({ id: 0, coffeeId: 1, slug: 's', roaster: 'r', coffeeName: 'c', origin: null, processGroup: 'Washed',
  roastLevel: null, localTime: '2026-10-01T08:00', restDays: null, grinder: null, grind: null, grindNum: null, dripper: null, filter: null,
  tempC: null, dose: null, waterG: null, water: null, recipeId: null, recipeName: null, rating: null, best: false, notes: null,
  grinderArchived: false, methodArchived: false, ...o });

describe('gearOptions / gearDefaults', () => {
  const rows = [
    row({ localTime: '2024-01-01T08:00', grinder: 'Ancient', dripper: 'Ancient' }),
    row({ localTime: '2026-06-01T08:00', grinder: 'A', dripper: 'D1', filter: 'F1' }),
    row({ localTime: '2026-09-01T08:00', grinder: 'B', dripper: 'D2', filter: 'F1', methodArchived: true }),
    row({ localTime: '2026-10-01T08:00', grinder: 'B', dripper: 'D1', filter: 'F2', grinderArchived: true }),
    row({ localTime: '2026-10-02T08:00', grinder: 'A', dripper: 'D1', filter: 'F2' })
  ];
  it('lists last-365-day gear, most recent first, skipping archived', () => {
    expect(gearOptions(rows, '2026-10-28')).toEqual({ grinders: ['A', 'B'], drippers: ['D1'], filters: ['F2', 'F1'] });
  });
  it('defaults to the most used of the last 30, skipping archived', () => {
    expect(gearDefaults(rows)).toEqual({ grinder: 'A', dripper: 'D1', filter: 'F2' });
    expect(gearDefaults(rows, 'D1').filter).toBe('F2');
    expect(gearDefaults([])).toEqual({ grinder: null, dripper: null, filter: null });
  });
});

describe('gearDefaults filter follows the dripper', () => {
  const rows = [
    ...[1, 2, 3].map((i) => row({ localTime: `2026-09-0${i}T08:00`, dripper: 'CT62', filter: 'Abaca' })),
    ...[1, 2].map((i) => row({ localTime: `2026-10-0${i}T08:00`, dripper: 'Graycano', filter: 'Sibarist' })),
    row({ localTime: '2026-10-03T08:00', dripper: 'Graycano', filter: 'Abaca', methodArchived: true }),
    row({ localTime: '2026-10-04T08:00', dripper: 'Other', filter: null })
  ];
  it('uses the chosen dripper\'s most used filter, else the global one', () => {
    expect(gearDefaults(rows).filter).toBe('Abaca');
    expect(gearDefaults(rows, 'Graycano')).toMatchObject({ dripper: 'CT62', filter: 'Sibarist' });
    expect(gearDefaults(rows, 'Other').filter).toBe('Abaca'); // no filter on file: global
  });
});

describe('coffeeDetails', () => {
  it('nets logged doses (floored at 0) and freezer days', () => {
    const c = coffee('Sey', 'Detail', { roast: '2026-10-01', amount: 40, fs: '2026-10-05', fe: '2026-10-10' });
    brew(c, '2026-10-12', { dose: 15 });
    brew(c, '2026-10-13', { dose: 15 });
    expect(coffeeDetails(db, createSlug(c), '2026-10-20')).toMatchObject({ id: c, roaster: 'Sey', coffeeName: 'Detail', roastDate: '2026-10-01',
      restDays: 14, gramsLeft: 10, processing: 'Washed', origin: 'Kenya', roastLevel: 'Light' });
    brew(c, '2026-10-14', { dose: 30 });
    expect(coffeeDetails(db, createSlug(c), '2026-10-20')!.gramsLeft).toBe(0);
  });
  it('gramsLeft null without amount; unknown slug null', () => {
    const c = coffee('Sey', 'NoAmt', { amount: null });
    expect(coffeeDetails(db, createSlug(c), '2026-10-20')!.gramsLeft).toBeNull();
    expect(coffeeDetails(db, 'nope', '2026-10-20')).toBeNull();
  });
});
function createSlug(id: number): string {
  return (db.prepare(`SELECT slug FROM coffees WHERE id = ?`).get(id) as { slug: string }).slug;
}
