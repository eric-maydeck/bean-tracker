import type { DatabaseSync } from 'node:sqlite';
import { SETTING_FORMATS } from '#lib/gear.ts';
import { getGearDetails } from './gearDetails';
import { bcLocalTime } from './insights/time';

// The Account page's "Data warnings": BQ brews worth fixing in BQ before re-importing. Computed from the stored
// brews on each load; never blocks or changes an import.
export type ImportWarning = { id: number; at: string; coffee: string | null; method: string | null; grinder: string | null; value: string; reason: string };

type Shape = 'number' | 'dotted';
const NUMBER = /^\d+(\.\d+)?$/, DOTTED = /^\d+\.\d+\.\d+$/;
const shapeOf = (s: string): Shape | null => (NUMBER.test(s) ? 'number' : DOTTED.test(s) ? 'dotted' : null);

type Row = { id: number; at: string; coffee: string | null; method: string | null; mill: string | null; grinder: string | null; setting: string | null; dose: number | null; water: number | null; beverage: number | null };

export function importWarnings(db: DatabaseSync): ImportWarning[] {
  const rows = db.prepare(
    `SELECT b.id, b.bc_created_at AS at, bean.name AS coffee, m.name AS method, b.mill_id AS mill, g.name AS grinder,
        b.grind_setting AS setting, b.ground_coffee_g AS dose, b.water_amount_g AS water, b.beverage_quantity AS beverage
     FROM beanconqueror_brews b
     LEFT JOIN beanconqueror_beans bean ON bean.id = b.bean_id
     LEFT JOIN beanconqueror_methods m ON m.id = b.preparation_id
     LEFT JOIN beanconqueror_grinders g ON g.id = b.mill_id
     ORDER BY b.bc_created_at DESC, b.id DESC`
  ).all() as unknown as Row[];

  // A grinder's format: its Setting format field when set, else the majority shape of its brews (a tie reads as number).
  const field = new Map(getGearDetails(db).filter((d) => d.kind === 'grinder').map((d) => [d.name, d.values.settingFormat]));
  const counts = new Map<string, Record<Shape, number>>();
  for (const r of rows) {
    const shape = r.mill && r.setting ? shapeOf(r.setting.trim()) : null;
    if (shape) (counts.get(r.mill!) ?? counts.set(r.mill!, { number: 0, dotted: 0 }).get(r.mill!)!)[shape]++;
  }
  const formatOf = (r: Row): Shape | 'custom' | null => {
    const set = field.get(r.grinder ?? '');
    if (set) return set === SETTING_FORMATS[2] ? 'custom' : set === SETTING_FORMATS[1] ? 'dotted' : 'number';
    const c = counts.get(r.mill!);
    return c ? (c.dotted > c.number ? 'dotted' : 'number') : null;
  };

  const out: ImportWarning[] = [];
  for (const r of rows) {
    const warn = (value: string, reason: string) =>
      out.push({ id: r.id, at: bcLocalTime(r.at), coffee: r.coffee, method: r.method, grinder: r.grinder, value, reason });
    if (r.mill) {
      const s = r.setting?.trim() ?? '', shape = shapeOf(s), want = formatOf(r);
      if (!s) warn('blank', 'No grind setting');
      else if (want === 'custom') { /* any text goes */ }
      else if (!shape) warn(s, 'Malformed grind setting');
      else if (want && shape !== want) warn(s, `Not this grinder's usual format (expects ${want})`);
    }
    if (!r.dose) warn(r.dose == null ? 'blank' : '0g', 'No dose');
    if (!r.water && !r.beverage) warn(r.water == null && r.beverage == null ? 'blank' : '0g', 'No water');
  }
  return out;
}
