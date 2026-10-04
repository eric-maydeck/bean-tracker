import { describe, it, expect } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { createDb, applySchema } from './db';
import { schema } from './schema';
import { createCoffee, type NewCoffeeInput } from './coffees';
import { importBeanConquerorData, getUnmatchedBeanConquerorBeans, countUnmatchedBeanConquerorBeans } from './beanconqueror';

type Db = ReturnType<typeof createDb>;

export function addCoffee(db: Db, over: Partial<NewCoffeeInput> = {}): number {
  return createCoffee(db, {
    roaster: 'Sey', coffee_name: 'Kiambu', origin: null, roast_level: null, processing: null, amount_g: 250, cost: 20,
    roast_date: '2026-09-01', frozen_start_date: null, frozen_end_date: null, rest_days_low: null, rest_days_high: null,
    image_url: null, ...over
  }).id;
}

type BeanInput = Parameters<typeof importBeanConquerorData>[1]['beans'][0];
export function bean(id: string, over: Partial<BeanInput> = {}): BeanInput {
  return {
    id, name: 'Kiambu', roaster: 'Sey', roastDate: '2026-09-01', roastType: null, degreeOfRoast: null,
    customDegreeOfRoast: null, blend: null, weightG: 250, cost: 20, aromatics: null, cuppingPoints: null,
    decaffeinated: false, url: null, eanArticleNumber: null, notes: null, rating: null,
    bcCreatedAt: `2026-09-0${id.slice(-1)}T00:00:00.000Z`, bcArchived: false, ...over
  };
}

export function importBeans(db: Db, beans: BeanInput[]) {
  importBeanConquerorData(db, { beans, beanOrigins: [], methods: [], grinders: [], brews: [] });
}

const linkOf = (db: Db, id: string) =>
  (db.prepare(`SELECT coffee_id FROM beanconqueror_beans WHERE id = ?`).get(id) as { coffee_id: number | null }).coffee_id;

describe('schema', () => {
  it('a fresh DB has the coffee_id column and its unique index', () => {
    const db = createDb(':memory:');
    const cols = db.prepare(`PRAGMA table_info(beanconqueror_beans)`).all() as { name: string }[];
    expect(cols.map((c) => c.name)).toContain('coffee_id');
    const idx = db.prepare(`SELECT sql FROM sqlite_master WHERE name = 'beanconqueror_beans_coffee'`).get() as { sql: string };
    expect(idx.sql).toMatch(/UNIQUE INDEX/);
  });

  it('rejects linking two beans to one coffee at the DB level', () => {
    const db = createDb(':memory:');
    const c = addCoffee(db, { coffee_name: 'Other' });
    importBeans(db, [bean('b1'), bean('b2')]);
    db.prepare(`UPDATE beanconqueror_beans SET coffee_id = ? WHERE id = 'b1'`).run(c);
    expect(() => db.prepare(`UPDATE beanconqueror_beans SET coffee_id = ? WHERE id = 'b2'`).run(c)).toThrow(/UNIQUE/);
  });

  it('deleting a linked coffee unlinks its bean (back in the list)', () => {
    const db = createDb(':memory:');
    const c = addCoffee(db);
    importBeans(db, [bean('b1')]);
    expect(linkOf(db, 'b1')).toBe(c);
    db.prepare(`DELETE FROM coffees WHERE id = ?`).run(c);
    expect(linkOf(db, 'b1')).toBeNull();
    expect(countUnmatchedBeanConquerorBeans(db)).toBe(1);
  });
});

describe('backfill (runs only when the column is added)', () => {
  // A DB from before the column: today's schema minus the coffee_id line.
  const COLUMN = ',\n  coffee_id INTEGER REFERENCES coffees(id) ON DELETE SET NULL';
  function oldDb(): DatabaseSync {
    expect(schema).toContain(COLUMN);
    const raw = new DatabaseSync(':memory:');
    raw.exec(schema.replace(COLUMN, ''));
    return raw;
  }
  const coffeeRow = (raw: DatabaseSync, slug: string, name: string, roastDate: string | null) =>
    raw.prepare(`INSERT INTO coffees (roaster, coffee_name, roast_date, slug, created_at, updated_at)
      VALUES ('Sey', ?, ?, ?, '2026-09-01', '2026-09-01')`).run(name, roastDate, slug).lastInsertRowid;
  const beanRow = (raw: DatabaseSync, id: string, name: string, roastDate: string | null) =>
    raw.prepare(`INSERT INTO beanconqueror_beans (id, name, roaster, roast_date, imported_at)
      VALUES (?, ?, 'Sey', ?, '2026-09-01')`).run(id, name, roastDate);
  const rawLink = (raw: DatabaseSync, id: string) =>
    (raw.prepare(`SELECT coffee_id FROM beanconqueror_beans WHERE id = ?`).get(id) as { coffee_id: number | null }).coffee_id;

  it('links unambiguous exact matches only, leaves twins and dateless rows unlinked, and runs once', () => {
    const raw = oldDb();
    const solo = coffeeRow(raw, 'a', 'Solo', '2026-09-01');
    coffeeRow(raw, 'b', 'Twin', '2026-09-02');
    coffeeRow(raw, 'c', 'Twin', '2026-09-02');
    coffeeRow(raw, 'd', 'Shared', '2026-09-03');
    coffeeRow(raw, 'e', 'Dateless', null);
    beanRow(raw, 'b-solo', 'Solo', '2026-09-01');
    beanRow(raw, 'b-twin', 'Twin', '2026-09-02');        // 2 coffees match: ambiguous
    beanRow(raw, 'b-shared-1', 'Shared', '2026-09-03');  // 1 coffee, 2 beans: ambiguous
    beanRow(raw, 'b-shared-2', 'Shared', '2026-09-03');
    beanRow(raw, 'b-dateless', 'Dateless', null);

    applySchema(raw);

    expect(rawLink(raw, 'b-solo')).toBe(Number(solo));
    for (const id of ['b-twin', 'b-shared-1', 'b-shared-2', 'b-dateless']) expect(rawLink(raw, id)).toBeNull();

    // A later unlink survives the next boot.
    raw.exec(`UPDATE beanconqueror_beans SET coffee_id = NULL WHERE id = 'b-solo'`);
    applySchema(raw);
    expect(rawLink(raw, 'b-solo')).toBeNull();
  });
});

describe('import auto-link', () => {
  it('links a bean with exactly one unlinked exact match', () => {
    const db = createDb(':memory:');
    const c = addCoffee(db);
    importBeans(db, [bean('b1')]);
    expect(linkOf(db, 'b1')).toBe(c);
  });

  it('leaves a bean unlinked when two unlinked coffees match (twins)', () => {
    const db = createDb(':memory:');
    addCoffee(db);
    addCoffee(db);
    importBeans(db, [bean('b1')]);
    expect(linkOf(db, 'b1')).toBeNull();
  });

  it('an unlinked existing bean is not auto-linked on re-import, even with a unique exact match', () => {
    const db = createDb(':memory:');
    importBeans(db, [bean('b1')]); // no coffee yet
    addCoffee(db);
    importBeans(db, [bean('b1')]);
    expect(linkOf(db, 'b1')).toBeNull();

    // A manual Unlink sticks too.
    importBeans(db, [bean('b2', { name: 'Other' })]);
    const other = addCoffee(db, { coffee_name: 'Other' });
    db.prepare(`UPDATE beanconqueror_beans SET coffee_id = ? WHERE id = 'b2'`).run(other);
    db.exec(`UPDATE beanconqueror_beans SET coffee_id = NULL WHERE id = 'b2'`);
    importBeans(db, [bean('b1'), bean('b2', { name: 'Other' })]);
    expect([linkOf(db, 'b1'), linkOf(db, 'b2')]).toEqual([null, null]);
  });

  it('two new beans matching one coffee: neither is linked', () => {
    const db = createDb(':memory:');
    addCoffee(db);
    importBeans(db, [bean('b2'), bean('b1')]);
    expect([linkOf(db, 'b1'), linkOf(db, 'b2')]).toEqual([null, null]);
  });

  it('links new beans in the same import that each have their own coffee', () => {
    const db = createDb(':memory:');
    const c1 = addCoffee(db);
    const c2 = addCoffee(db, { coffee_name: 'Other' });
    importBeans(db, [bean('b1'), bean('b2', { name: 'Other' })]);
    expect([linkOf(db, 'b1'), linkOf(db, 'b2')]).toEqual([c1, c2]);
  });

  it('never auto-links a dateless bean', () => {
    const db = createDb(':memory:');
    addCoffee(db, { coffee_name: 'Dateless', roast_date: null });
    importBeans(db, [bean('b2', { name: 'Dateless', roastDate: null })]);
    expect(linkOf(db, 'b2')).toBeNull();
  });

  it('a re-import keeps a link even after the coffee was renamed', () => {
    const db = createDb(':memory:');
    const c = addCoffee(db);
    importBeans(db, [bean('b1')]);
    db.prepare(`UPDATE coffees SET coffee_name = 'Kiambu AA' WHERE id = ?`).run(c);
    importBeans(db, [bean('b1', { rating: 9 })]);
    expect(linkOf(db, 'b1')).toBe(c);
  });
});

describe('tracked means linked', () => {
  it('the list and the count use coffee_id IS NULL, not the text match', () => {
    const db = createDb(':memory:');
    addCoffee(db);
    addCoffee(db);
    importBeans(db, [bean('b1')]); // exact text match exists, but ambiguous → unlinked
    expect(getUnmatchedBeanConquerorBeans(db, 20).map((b) => b.id)).toEqual(['b1']);
    expect(countUnmatchedBeanConquerorBeans(db)).toBe(1);
  });
});
