import { describe, it, expect } from 'vitest';
import { createDb } from './db';
import { createCoffee } from './coffees';
import { favoriteGrind } from './favoriteGrind';

const db = createDb(':memory:');
let n = 0; // a unique second per brew (the importer's identity index)
const coffee = (roaster: string, name: string, roast = '2026-09-01') => {
  const id = createCoffee(db, { roaster, coffee_name: name, origin: null, roast_level: null, processing: null, amount_g: 250, cost: 20,
    roast_date: roast, frozen_start_date: null, frozen_end_date: null, rest_days_low: null, rest_days_high: null, image_url: null }).id;
  db.prepare(`INSERT INTO beanconqueror_beans (id, name, roaster, imported_at, coffee_id) VALUES (?, ?, ?, 'x', ?)`).run(`bean${id}`, name, roaster, id);
  return id;
};
db.exec(`INSERT INTO beanconqueror_grinders (id, name, imported_at) VALUES ('gz', 'ZP6', 'x'), ('ga', 'A4Z', 'x');
  INSERT INTO beanconqueror_methods (id, name, imported_at) VALUES ('v60', 'V60', 'x'), ('orig', 'Origami', 'x'), ('ct', 'CT62 - Cafec Abaca', 'x')`);
const brew = (coffeeId: number, mill: string, setting: string, rating: number | null, at: string, method = 'v60') =>
  db.prepare(`INSERT INTO beanconqueror_brews (bc_created_at, bean_id, preparation_id, mill_id, grind_setting, rating, imported_at)
    VALUES (?, ?, ?, ?, ?, ?, 'x')`).run(`${at}T08:00:${String(n++).padStart(2, '0')}.000Z`, `bean${coffeeId}`, method, mill, setting, rating);

describe('favoriteGrind', () => {
  it('is empty for a coffee with no brews', () => {
    expect(favoriteGrind(db, coffee('R0', 'None'))).toEqual([]);
  });

  it('picks the highest rating per grinder, A to Z, the latest brew winning a tie, with the dripper', () => {
    const c = coffee('R1', 'Alpha');
    brew(c, 'gz', '5', 8, '2026-09-02');
    brew(c, 'gz', '5.5', 9, '2026-09-03', 'orig');
    brew(c, 'gz', '6', 9, '2026-09-04');
    brew(c, 'ga', '1.2', 7, '2026-09-05');
    expect(favoriteGrind(db, c)).toEqual([
      { grinder: 'A4Z', brews: 1, best: { setting: '1.2', rating: 7, dripper: 'V60', filter: null, date: '2026-09-05' }, other: null },
      { grinder: 'ZP6', brews: 3, best: { setting: '6', rating: 9, dripper: 'V60', filter: null, date: '2026-09-04' }, other: null }
    ]);
  });

  it('splits a "Dripper - Filter" method name into dripper and filter', () => {
    const c = coffee('R6', 'Split');
    brew(c, 'gz', '5', 8, '2026-09-02', 'ct');
    expect(favoriteGrind(db, c)[0].best).toMatchObject({ dripper: 'CT62', filter: 'Cafec Abaca' });
  });

  it('a grinder with brews but no ratings has a count and no best', () => {
    const c = coffee('R2', 'Beta');
    brew(c, 'gz', '5', null, '2026-09-02');
    brew(c, 'gz', '5', 0, '2026-09-03');
    expect(favoriteGrind(db, c)).toEqual([{ grinder: 'ZP6', brews: 2, best: null, other: null }]);
  });

  it('shows the same coffee\'s other bag only when strictly higher on that grinder', () => {
    const a = coffee('Sey', 'Kiambu', '2026-09-01');
    const b = coffee(' sey ', 'KIAMBU', '2026-08-01');
    const c = coffee('Sey', 'Other name');
    brew(a, 'gz', '5', 8, '2026-09-02');
    brew(a, 'ga', '1', 9, '2026-09-02');
    brew(b, 'gz', '4.5', 9, '2026-08-10', 'orig'); // higher on ZP6
    brew(b, 'ga', '1.1', 9, '2026-08-11'); // equal on A4Z: not shown
    brew(c, 'gz', '3', 10, '2026-09-09'); // another coffee: ignored
    const r = favoriteGrind(db, a);
    expect(r.map((g) => g.other)).toEqual([
      null,
      { setting: '4.5', rating: 9, dripper: 'Origami', filter: null, date: '2026-08-10', slug: expect.any(String), roastDate: '2026-08-01' }
    ]);
    expect(r[1].other!.slug).toBe((db.prepare(`SELECT slug FROM coffees WHERE id = ?`).get(b) as { slug: string }).slug);
    expect(favoriteGrind(db, b)[1].other).toBeNull(); // the first bag is lower, so nothing to show there
  });

  it('shows a rated other bag on a grinder where this bag has no ratings', () => {
    const a = coffee('R5', 'Pair');
    const b = coffee('R5', 'Pair');
    brew(a, 'gz', '5', null, '2026-09-02');
    brew(b, 'gz', '4', 6, '2026-09-03');
    expect(favoriteGrind(db, a)[0]).toMatchObject({ best: null, other: { setting: '4', rating: 6 } });
  });
});
