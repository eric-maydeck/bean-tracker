import { describe, it, expect } from 'vitest';
import { createDb } from './db';
import { saveGearDetails } from './gearDetails';
import { importWarnings } from './importWarnings';

const db = createDb(':memory:');
db.exec(`INSERT INTO beanconqueror_grinders (id, name, imported_at) VALUES ('gz', 'ZP6', 'x'), ('ga', 'A4Z', 'x');
  INSERT INTO beanconqueror_methods (id, name, imported_at) VALUES ('v60', 'V60', 'x');
  INSERT INTO beanconqueror_beans (id, name, imported_at) VALUES ('b1', 'Kenya', 'x')`);
let n = 0;
const brew = (mill: string | null, setting: string | null, dose: number | null = 15, water: number | null = 250, beverage: number | null = null) =>
  db.prepare(`INSERT INTO beanconqueror_brews (bc_created_at, bean_id, preparation_id, mill_id, grind_setting, ground_coffee_g, water_amount_g, beverage_quantity, imported_at)
    VALUES (?, 'b1', 'v60', ?, ?, ?, ?, ?, 'x')`).run(`2026-09-01T08:00:${String(n++).padStart(2, '0')}.000Z`, mill, setting, dose, water, beverage);
const reasons = () => importWarnings(db).map((w) => w.reason);
const clear = () => db.exec('DELETE FROM beanconqueror_brews; DELETE FROM gear_details');

describe('importWarnings', () => {
  it('flags nothing for clean brews', () => {
    brew('gz', '5'); brew('gz', '5.0'); brew('ga', '1.4.2');
    expect(importWarnings(db)).toEqual([]);
  });

  it('flags blank, malformed and other-shape settings, newest first, with local time and names', () => {
    clear();
    brew('gz', '5'); brew('gz', '6'); brew('gz', '');
    brew('gz', 'fine'); brew('gz', '1.4.2');
    const w = importWarnings(db);
    expect(w.map((x) => [x.reason, x.value])).toEqual([
      ["Not this grinder's usual format (expects number)", '1.4.2'], ['Malformed grind setting', 'fine'], ['No grind setting', 'blank']
    ]);
    expect(w[0]).toMatchObject({ at: '2026-09-01T08:00', coffee: 'Kenya', method: 'V60', grinder: 'ZP6' });
  });

  it('skips grind checks without a grinder', () => {
    clear();
    brew(null, null);
    expect(importWarnings(db)).toEqual([]);
  });

  it('flags a missing or zero dose, and water only when the beverage is missing too', () => {
    clear();
    brew('gz', '5', null); brew('gz', '5', 0);
    brew('gz', '5', 18, null, 36); // espresso: beverage only
    brew('gz', '5', 18, 0, null);
    expect(reasons().reverse()).toEqual(['No dose', 'No dose', 'No water']);
  });

  it('gives several warnings to one brew', () => {
    clear();
    brew('gz', '', 0, null);
    expect(reasons().sort()).toEqual(['No dose', 'No grind setting', 'No water']);
  });

  it('a grinder\'s Setting format field overrides the majority of its brews', () => {
    clear();
    brew('gz', '5'); brew('gz', '6'); brew('gz', '1.4.2');
    saveGearDetails(db, { kind: 'grinder', name: 'ZP6', values: { settingFormat: 'Dotted (e.g. 1.4.2)' }, imageUrl: null });
    expect(importWarnings(db).map((w) => w.value).sort()).toEqual(['5', '6']);
    expect(reasons()[0]).toContain('expects dotted');
  });

  it('a Custom setting format accepts any text', () => {
    clear();
    brew('gz', 'fine-ish'); brew('gz', '1.4.2'); brew('gz', '');
    saveGearDetails(db, { kind: 'grinder', name: 'ZP6', values: { settingFormat: 'Custom (any text)' }, imageUrl: null });
    expect(reasons()).toEqual(['No grind setting']);
  });
});
