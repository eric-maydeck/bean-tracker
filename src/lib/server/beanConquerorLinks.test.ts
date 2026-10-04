import { describe, it, expect } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { createDb, applySchema } from './db';
import { schema } from './schema';
import { createCoffee, type NewCoffeeInput } from './coffees';
import { importBeanConquerorData, getUnmatchedBeanConquerorBeans, countUnmatchedBeanConquerorBeans } from './beanconqueror';
import { linkBeanConquerorBean, unlinkBeanConquerorBean, getLinkedBean, getLinkableCoffees, BeanLinkError } from './beanConquerorLinks';

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

  it('is atomic: a failing backfill leaves no column, so it retries next boot', () => {
    const raw = oldDb();
    coffeeRow(raw, 'a', 'Solo', '2026-09-01');
    beanRow(raw, 'b-solo', 'Solo', '2026-09-01');
    raw.exec(`CREATE TRIGGER boom BEFORE UPDATE ON beanconqueror_beans
      BEGIN SELECT RAISE(ABORT, 'boom'); END`);
    expect(() => applySchema(raw)).toThrow('boom');
    const hasColumn = () =>
      (raw.prepare(`PRAGMA table_info(beanconqueror_beans)`).all() as { name: string }[]).some(
        (c) => c.name === 'coffee_id'
      );
    expect(hasColumn()).toBe(false);
    raw.exec('DROP TRIGGER boom');
    applySchema(raw);
    expect(hasColumn()).toBe(true);
    expect(rawLink(raw, 'b-solo')).not.toBeNull();
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

  it('an existing unlinked twin blocks auto-linking a new bean with the same key', () => {
    const db = createDb(':memory:');
    importBeans(db, [bean('b1')]); // twin A, no coffee yet
    addCoffee(db);
    importBeans(db, [bean('b2')]); // new bean B, one unlinked coffee
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

describe('linkBeanConquerorBean / unlinkBeanConquerorBean', () => {
  function twins() {
    const db = createDb(':memory:');
    const c1 = addCoffee(db);
    const c2 = addCoffee(db);
    importBeans(db, [bean('b1'), bean('b2')]); // ambiguous → both unlinked
    return { db, c1, c2 };
  }

  it('links, and the bean leaves the list', () => {
    const { db, c1 } = twins();
    linkBeanConquerorBean(db, 'b1', c1);
    expect(linkOf(db, 'b1')).toBe(c1);
    expect(getUnmatchedBeanConquerorBeans(db, 20).map((b) => b.id)).toEqual(['b2']);
  });

  it('relinking to the same coffee is a no-op', () => {
    const { db, c1 } = twins();
    linkBeanConquerorBean(db, 'b1', c1);
    expect(() => linkBeanConquerorBean(db, 'b1', c1)).not.toThrow();
  });

  it('rejects a coffee that already has a bean, cleanly (no raw UNIQUE error)', () => {
    const { db, c1 } = twins();
    linkBeanConquerorBean(db, 'b1', c1);
    expect(() => linkBeanConquerorBean(db, 'b2', c1)).toThrow(BeanLinkError);
    expect(() => linkBeanConquerorBean(db, 'b2', c1)).toThrow(/already linked to a Bean Conqueror bean/);
  });

  it('rejects a bean that is already linked elsewhere', () => {
    const { db, c1, c2 } = twins();
    linkBeanConquerorBean(db, 'b1', c1);
    expect(() => linkBeanConquerorBean(db, 'b1', c2)).toThrow(/already linked to another coffee/);
  });

  it('rejects unknown beans and coffees', () => {
    const { db, c1 } = twins();
    expect(() => linkBeanConquerorBean(db, 'nope', c1)).toThrow(/no longer exists/);
    expect(() => linkBeanConquerorBean(db, 'b1', 999)).toThrow(/no longer exists/);
  });

  it('unlink returns the bean to the list, even if it had been dismissed', () => {
    const { db, c1 } = twins();
    linkBeanConquerorBean(db, 'b1', c1);
    db.exec(`UPDATE beanconqueror_beans SET dismissed_at = '2026-09-05' WHERE id = 'b1'`);
    expect(unlinkBeanConquerorBean(db, c1)).toBe(true);
    expect(getUnmatchedBeanConquerorBeans(db, 20).map((b) => b.id).sort()).toEqual(['b1', 'b2']);
    expect(unlinkBeanConquerorBean(db, c1)).toBe(false);
  });
});

describe('getLinkedBean / getLinkableCoffees', () => {
  it('reports the linked bean and its brew count', () => {
    const db = createDb(':memory:');
    const c = addCoffee(db);
    importBeanConquerorData(db, {
      beans: [bean('b1')], beanOrigins: [], methods: [], grinders: [],
      brews: [1, 2].map((d) => ({
        bcCreatedAt: `2026-09-0${d}T08:00:00.000Z`, beanId: 'b1', preparationId: null, millId: null, grindSetting: null,
        groundCoffeeG: 15, brewTemperature: null, beanType: null, grindSpeedRpm: null, grindTime: null, profile: null,
        preparationTools: null, temperatureTime: null, brewTime: null, bloomTime: null, firstDripTime: null,
        waterAmountG: null, coffeeType: null, coffeeConcentration: null, rating: null, notes: null, beverageQuantity: null,
        tdsPercent: null, extractionYieldPercent: null, brewRatio: null, beanAgeDays: null, bcArchived: false, water: null
      }))
    });
    expect(getLinkedBean(db, c)).toEqual({ id: 'b1', name: 'Kiambu', brewCount: 2 });
    expect(getLinkedBean(db, 999)).toBeNull();
  });

  it('lists only coffees without a bean', () => {
    const db = createDb(':memory:');
    const linked = addCoffee(db);
    const free = addCoffee(db, { coffee_name: 'Free' });
    importBeans(db, [bean('b1')]);
    expect(linkOf(db, 'b1')).toBe(linked);
    expect(getLinkableCoffees(db).map((c) => c.id)).toEqual([free]);
  });

  it("the likely match is only ever a linkable coffee, and carries its id", () => {
    const db = createDb(':memory:');
    const taken = addCoffee(db, { coffee_name: 'Kiambu AA' });
    const free = addCoffee(db, { coffee_name: 'Kiambu AA', roast_date: '2026-09-03' });
    importBeans(db, [bean('b1', { name: 'Kiambu AA' }), bean('b2', { name: 'Kiambu', roastDate: '2026-09-02' })]);
    expect(linkOf(db, 'b1')).toBe(taken);
    const [b2] = getUnmatchedBeanConquerorBeans(db, 20);
    expect(b2.likelyMatch).toMatchObject({ id: free });
  });
});
