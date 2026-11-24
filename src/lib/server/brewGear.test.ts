import { describe, it, expect } from 'vitest';
import { createDb } from './db';
import { loadToolKinds, readGear, splitTools, toolColumns, type ToolKind } from './brewGear';

const kinds = (o: Record<string, ToolKind> = {}) => new Map(Object.entries(o));
const four = ['Cafec Abaca', 'Cafec T90', 'Sibarist Fast', 'Switch base'];

describe('readGear', () => {
  it('ticked filter: dripper is the whole name', () => {
    expect(readGear('V60 Ceramic Pearl - 02', four, ['Cafec Abaca'], kinds(), null)).toEqual({
      dripper: 'V60 Ceramic Pearl - 02', filter: 'Cafec Abaca', filters: ['Cafec Abaca'], accessories: []
    });
  });
  it('splits ticked filter from accessory', () => {
    const g = readGear('Switch', four, ['Cafec Abaca', 'Switch base'], kinds({ 'Switch base': 'accessory' }), null);
    expect(g).toMatchObject({ filter: 'Cafec Abaca', accessories: ['Switch base'] });
  });
  it('two ticked filters: no single filter', () => {
    const g = readGear('V60', four, ['Cafec Abaca', 'Cafec T90'], kinds(), null);
    expect(g.filter).toBeNull();
    expect(g.filters).toHaveLength(2);
  });
  it('nothing ticked, many tools: whole name, no filter', () => {
    expect(readGear('V60 Neo Tritan - 02', four, [], kinds(), null)).toMatchObject({ dripper: 'V60 Neo Tritan - 02', filter: null });
  });
  it('nothing ticked, old shape: split name', () => {
    expect(readGear('V60 - Cafec T90', [], [], kinds(), 'Cafec T90 filters')).toMatchObject({ dripper: 'V60', filter: 'Cafec T90' });
  });
  it('nothing ticked, one tool: it is the filter', () => {
    expect(readGear('Deep 27', ['Cafec Abaca+'], [], kinds(), 'Cafec Abaca+')).toMatchObject({ dripper: 'Deep 27', filter: 'Cafec Abaca+' });
  });
  it('a saved accessory kind keeps the fallback filter out of filters', () => {
    expect(readGear('ORB Long Soup - Aeropress', [], [], kinds({ Aeropress: 'accessory' }), null)).toMatchObject({
      dripper: 'ORB Long Soup', filter: null, filters: [], accessories: ['Aeropress']
    });
  });
  it('keeps the mixed filter for Gabi Master A', () => {
    expect(readGear('Gabi Master A', four, [], kinds(), null)).toMatchObject({ dripper: 'Gabi Master A', filter: '155 (mixed)' });
  });
});

describe('splitTools', () => {
  it('splits, strips " filters", trims, drops blanks', () => {
    expect(splitTools('Cafec T90 filters\x1f Abaca \x1f')).toEqual(['Cafec T90', 'Abaca']);
    expect(splitTools(null)).toEqual([]);
  });
});

describe('toolColumns', () => {
  it('selects the ticked and method tool names', () => {
    const db = createDb(':memory:');
    db.exec(`INSERT INTO beanconqueror_methods (id, name, imported_at) VALUES ('m', 'V60', 'x');
      INSERT INTO beanconqueror_method_tools (uuid, method_id, name) VALUES ('t1', 'm', 'Cafec Abaca filters'), ('t2', 'm', 'Switch base');
      INSERT INTO beanconqueror_brews (bc_uuid, bc_created_at, preparation_id, imported_at) VALUES ('u', '2026-01-01T00:00:00.000Z', 'm', 'x');
      INSERT INTO beanconqueror_brew_tools (brew_uuid, tool_uuid) VALUES ('u', 't1')`);
    const r = db.prepare(`SELECT ${toolColumns()} FROM beanconqueror_brews b JOIN beanconqueror_methods m ON m.id = b.preparation_id`).get() as { ticked: string; mtools: string };
    expect(splitTools(r.ticked)).toEqual(['Cafec Abaca']);
    expect(splitTools(r.mtools).sort()).toEqual(['Cafec Abaca', 'Switch base']);
  });
});

describe('loadToolKinds', () => {
  const setup = (ticks: string[][], saved: [string, string][] = []) => {
    const db = createDb(':memory:');
    db.prepare(`INSERT INTO beanconqueror_methods (id, name, imported_at) VALUES ('m', 'V60', 'x')`).run();
    const names = [...new Set(ticks.flat())];
    for (const n of names) db.prepare(`INSERT INTO beanconqueror_method_tools (uuid, method_id, name) VALUES (?, 'm', ?)`).run(n, n);
    ticks.forEach((t, i) => t.forEach((n) => db.prepare(`INSERT INTO beanconqueror_brew_tools (brew_uuid, tool_uuid) VALUES (?, ?)`).run(`b${i}`, n)));
    for (const [n, k] of saved) db.prepare(`INSERT INTO tool_kinds (name, kind, updated_at) VALUES (?, ?, 'x')`).run(n, k);
    return loadToolKinds(db);
  };
  it('saved beats catalog', () => expect(setup([['Cafec Abaca']], [['Cafec Abaca', 'accessory']]).get('Cafec Abaca')).toBe('accessory'));
  it('non-catalog beside a catalog filter is an accessory', () =>
    expect(setup([['Cafec Abaca', 'Switch base']]).get('Switch base')).toBe('accessory'));
  it('non-catalog alone is a filter', () => expect(setup([['House paper']]).get('House paper')).toBe('filter'));
  it('saved but never ticked is included', () => expect(setup([], [['Old', 'accessory']]).get('Old')).toBe('accessory'));
});
