import { describe, it, expect } from 'vitest';
import { createDb } from '../../src/lib/server/db.ts';
import { renameGear, type RenameMap } from './2026-11-24-rename-gear.ts';

const map: RenameMap = {
  drippers: { 'Old Dripper': 'New Dripper', 'Gone Dripper': 'Taken Dripper' },
  filters: { 'Old Filter': 'New Filter' },
  deleteCards: [{ kind: 'filter', name: 'Mixed' }],
  deleteMethods: ['Used Method', 'Spare Method']
};

function seed() {
  const db = createDb(':memory:');
  const run = (s: string, ...a: string[]) => db.prepare(s).run(...a);
  for (const [k, n] of [['dripper', 'Old Dripper'], ['dripper', 'Gone Dripper'], ['dripper', 'Taken Dripper'], ['filter', 'Old Filter'], ['filter', 'Mixed']])
    run(`INSERT INTO gear_details (kind, name, created_at, updated_at) VALUES (?, ?, 'x', 'x')`, k, n);
  run(`INSERT INTO locked_drippers (name) VALUES ('Old Dripper')`);
  run(`INSERT INTO tool_kinds (name, kind, updated_at) VALUES ('Old Filter', 'filter', 'x')`);
  run(`INSERT INTO recipes (name, tags, definition, created_at, updated_at) VALUES ('r', '[]', '{"drippers":["Old Dripper","Other"]}', 'x', 'x')`);
  run(`INSERT INTO beanconqueror_methods (id, name, imported_at) VALUES ('m1', 'Used Method', 'x'), ('m2', 'Spare Method', 'x')`);
  run(`INSERT INTO beanconqueror_method_tools (uuid, method_id, name) VALUES ('t1', 'm2', 'Tool')`);
  run(`INSERT INTO beanconqueror_brews (bc_created_at, preparation_id, imported_at) VALUES ('x', 'm1', 'x')`);
  run(`INSERT INTO coffees (roaster, coffee_name, created_at, updated_at) VALUES ('R', 'C', 'x', 'x')`);
  run(`INSERT INTO brew_now_marks (coffee_id, marked_at, marked_local, dripper, filter, suggestion) VALUES (1, 'x', 'x', 'Old Dripper', 'Old Filter', '{}')`);
  return db;
}
const names = (db: ReturnType<typeof seed>, q: string) => (db.prepare(q).all() as { n: string }[]).map((r) => r.n);

describe('rename-gear', () => {
  it('renames, deletes unreferenced methods, keeps referenced ones, and a rerun changes nothing', () => {
    const db = seed();
    const first = renameGear(db, map);
    expect(names(db, `SELECT name n FROM gear_details ORDER BY kind, name`)).toEqual(['Gone Dripper', 'New Dripper', 'Taken Dripper', 'New Filter']);
    expect(first).toContain('skipped dripper card Gone Dripper: Taken Dripper already has one');
    expect(names(db, `SELECT name n FROM locked_drippers`)).toEqual(['New Dripper']);
    expect(names(db, `SELECT name n FROM tool_kinds`)).toEqual(['New Filter']);
    expect(JSON.parse((db.prepare(`SELECT definition d FROM recipes`).get() as { d: string }).d).drippers).toEqual(['New Dripper', 'Other']);
    expect(names(db, `SELECT name n FROM beanconqueror_methods`)).toEqual(['Used Method']);
    expect(db.prepare(`SELECT count(*) c FROM beanconqueror_method_tools`).get()).toEqual({ c: 0 });
    expect(db.prepare(`SELECT dripper, filter FROM brew_now_marks`).get()).toEqual({ dripper: 'New Dripper', filter: 'New Filter' });
    expect(first).toContain('kept method Used Method: a brew uses it');
    const before = db.prepare(`SELECT * FROM gear_details ORDER BY kind, name`).all();
    renameGear(db, map);
    expect(db.prepare(`SELECT * FROM gear_details ORDER BY kind, name`).all()).toEqual(before);
    expect(names(db, `SELECT name n FROM locked_drippers`)).toEqual(['New Dripper']);
  });
});
