import { describe, it, expect } from 'vitest';
import { createDb } from './db';
import { saveGearDetails } from './gearDetails';
import { importWarnings } from './importWarnings';

const db = createDb(':memory:');
db.exec(`INSERT INTO beanconqueror_grinders (id, name, imported_at) VALUES ('gz', 'ZP6', 'x'), ('ga', 'A4Z', 'x');
  INSERT INTO beanconqueror_methods (id, name, imported_at) VALUES ('v60', 'V60 - Cafec Abaca', 'x');
  INSERT INTO beanconqueror_beans (id, name, imported_at) VALUES ('b1', 'Kenya', 'x')`);
let n = 0;
const brew = (mill: string | null, setting: string | null, dose: number | null = 15, water: number | null = 250, beverage: number | null = null) =>
  db.prepare(`INSERT INTO beanconqueror_brews (bc_created_at, bean_id, preparation_id, mill_id, grind_setting, ground_coffee_g, water_amount_g, beverage_quantity, imported_at)
    VALUES (?, 'b1', 'v60', ?, ?, ?, ?, ?, 'x')`).run(`2026-09-01T08:00:${String(n++).padStart(2, '0')}.000Z`, mill, setting, dose, water, beverage);
const reasons = () => importWarnings(db).map((w) => w.reason);
const clear = () => db.exec('DELETE FROM beanconqueror_brews; DELETE FROM gear_details; DELETE FROM beanconqueror_brew_tools; DELETE FROM beanconqueror_method_tools; DELETE FROM beanconqueror_methods WHERE id <> \'v60\'');

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
      ['Wrong grind format', '1.4.2'], ['Malformed grind setting', 'fine'], ['No grind setting', 'blank']
    ]);
    expect(w[0]).toMatchObject({ at: '2026-09-01T08:00', coffee: 'Kenya', method: 'V60 - Cafec Abaca', grinder: 'ZP6' });
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
  });

  it('a Custom setting format accepts any text', () => {
    clear();
    brew('gz', 'fine-ish'); brew('gz', '1.4.2'); brew('gz', '');
    saveGearDetails(db, { kind: 'grinder', name: 'ZP6', values: { settingFormat: 'Custom (any text)' }, imageUrl: null });
    expect(reasons()).toEqual(['No grind setting']);
  });

  describe('filters', () => {
    // A brew on its own method (named \`name\`, BQ style \`style\`) with the given tools ticked.
    let k = 0;
    const tooled = (name: string, tools: string[], ticked: number[], style: string | null = 'POUR OVER') => {
      const id = `m${k++}`;
      db.prepare(`INSERT INTO beanconqueror_methods (id, name, preparation_style, imported_at) VALUES (?, ?, ?, 'x')`).run(id, name, style);
      tools.forEach((t, i) => db.prepare(`INSERT INTO beanconqueror_method_tools (uuid, method_id, name) VALUES (?, ?, ?)`).run(`${id}t${i}`, id, t));
      const uuid = `u${id}`;
      db.prepare(`INSERT INTO beanconqueror_brews (bc_uuid, bc_created_at, bean_id, preparation_id, ground_coffee_g, water_amount_g, imported_at)
        VALUES (?, ?, 'b1', ?, 15, 250, 'x')`).run(uuid, `2026-09-02T08:00:${String(k).padStart(2, '0')}.000Z`, id);
      ticked.forEach((i) => db.prepare(`INSERT INTO beanconqueror_brew_tools (brew_uuid, tool_uuid) VALUES (?, ?)`).run(uuid, `${id}t${i}`));
    };

    it('flags a pour-over brew with nothing ticked', () => {
      clear(); tooled('Kalita', ['Cafec Abaca'], []);
      expect(importWarnings(db).map((w) => [w.reason, w.value, w.method])).toEqual([['No filter', 'blank', 'Kalita']]);
    });

    it('flags a brew with only an accessory ticked', () => {
      clear(); tooled('V60', ['Cafec Abaca', 'Switch base'], [0, 1]); // teaches Switch base is an accessory
      tooled('V60', ['Cafec Abaca', 'Switch base'], [1]);
      expect(reasons()).toEqual(['No filter']);
    });

    it('flags two filters ticked, joined by +', () => {
      clear(); tooled('V60', ['Cafec Abaca', 'Cafec T-90'], [0, 1]);
      expect(importWarnings(db).map((w) => [w.reason, w.value])).toEqual([['Two filters ticked', 'Cafec Abaca + Cafec T-90']]);
    });

    it('flags two spellings of one tool once, on the latest brew that ticks either', () => {
      clear(); tooled('V60', ['Cafec T90'], [0]); tooled('Kalita', ['Cafec T-90'], [0]); tooled('Kalita', ['Cafec T-90'], [0]);
      const w = importWarnings(db);
      expect(w.map((x) => [x.reason, x.value])).toEqual([['Two spellings of one tool', 'Cafec T-90 / Cafec T90']]);
      expect(w[0].method).toBe('Kalita');
    });

    it('raises nothing for an old-shape method name, a soup brewer, or T-90 beside TH-3', () => {
      clear(); tooled('V60 - Cafec Abaca', [], []); tooled('OXO Rapid Brewer', [], [], 'ESPRESSO'); tooled('Orea', ['Cafec T-90', 'Cafec TH-3'], [0]);
      tooled('Orea', ['Cafec T-90', 'Cafec TH-3'], [1]);
      expect(importWarnings(db)).toEqual([]);
    });
  });
});
