export const GEAR_KINDS = ['dripper', 'filter', 'grinder'] as const;
export type GearKind = (typeof GEAR_KINDS)[number];
export const KIND_LABEL: Record<GearKind, string> = { dripper: 'Dripper', filter: 'Filter', grinder: 'Grinder' };

// Which trophy cards show: a pick rules out the other cards of its own kind only (a dripper pick hides the other
// drippers, grinders and filters stay). The retired shelf holds whichever retired cards survive. Dripper/filter
// picks match a name; the grinder pick is a slug.
export function shownTrophies<T extends { kind: GearKind; key: string; name: string; retired: boolean }>(
  list: readonly T[], pick: { dripper?: string; filter?: string; grinder?: string }
): { active: T[]; retired: T[] } {
  const keep = (t: T) =>
    t.kind === 'dripper' ? !pick.dripper || t.name === pick.dripper
    : t.kind === 'filter' ? !pick.filter || t.name === pick.filter
    : !pick.grinder || t.key === `grinder-${pick.grinder}`;
  const kept = list.filter(keep);
  return { active: kept.filter((t) => !t.retired), retired: kept.filter((t) => t.retired) };
}

// The per-kind metadata standard. `options` are datalist suggestions (free text is the "other"); `aliases` are the
// lowercased product-page labels the importer matches.
export interface GearField {
  key: string; label: string; type: 'text' | 'number' | 'money' | 'url';
  unit?: string; min?: number; max?: number; options?: readonly string[]; aliases?: readonly string[];
}
const text = (key: string, label: string, options?: readonly string[], aliases: readonly string[] = [label.toLowerCase()]): GearField =>
  ({ key, label, type: 'text', options, aliases });
const num = (key: string, label: string, unit: string, min: number, max: number, aliases: readonly string[] = [label.toLowerCase()]): GearField =>
  ({ key, label, type: 'number', unit, min, max, aliases });

export const COMMON_FIELDS: readonly GearField[] = [
  text('brand', 'Brand', undefined, ['brand', 'manufacturer']),
  text('model', 'Model', undefined, ['model', 'model number']),
  { key: 'cost', label: 'Cost', type: 'money', min: 0, max: 100000, aliases: ['cost', 'price'] },
  { key: 'website', label: 'Official website', type: 'url', aliases: ['official website', 'website'] }
];
export const KIND_FIELDS: Record<GearKind, readonly GearField[]> = {
  dripper: [
    text('shape', 'Shape', ['Conical', 'Flat bottom', 'Wave', 'Hybrid']),
    num('coneAngle', 'Cone angle', '°', 0, 180, ['cone angle', 'angle']),
    text('material', 'Material', ['Plastic', 'Tritan', 'Ceramic', 'Glass', 'Metal'], ['material', 'materials']),
    text('flow', 'Flow', ['Open', 'Restricted', 'Valve / immersion'], ['flow', 'flow rate']),
    text('size', 'Size', ['01', '02', '03'])
  ],
  grinder: [
    text('type', 'Type', ['Hand', 'Electric']),
    text('burrType', 'Burr type', ['Conical', 'Flat'], ['burr type', 'burr shape', 'burrs']),
    text('burrName', 'Burr name', undefined, ['burr name', 'burr set']),
    num('burrSize', 'Burr size', 'mm', 10, 150, ['burr size', 'burr diameter']),
    text('burrMaterial', 'Burr material', ['Stainless steel', 'Hardened steel', 'Titanium coated'], ['burr material']),
    text('adjustment', 'Adjustment', ['Stepped', 'Stepless'], ['adjustment', 'adjustment type']),
    num('stepSize', 'Step size', 'µm', 0.1, 1000, ['step size', 'step', 'micron per step'])
  ],
  filter: [
    text('material', 'Material', ['Paper', 'Cloth', 'Metal'], ['material', 'materials']),
    text('shape', 'Shape', ['Cone', 'Wave', 'Flat-bottom basket']),
    text('fits', 'Fits', ['01', '02', '155', '185'], ['fits', 'fit', 'compatibility', 'size']),
    text('flow', 'Flow', ['Fast', 'Medium', 'Slow'], ['flow', 'flow rate'])
  ]
};
export const fieldsFor = (kind: GearKind): GearField[] => [...COMMON_FIELDS, ...KIND_FIELDS[kind]];

export type GearValues = Record<string, string | number>;
const MAX_TEXT = 120;

// Validates a details form/import payload: known keys only, trimmed, blanks dropped. First problem wins.
export function parseGearValues(kind: GearKind, raw: unknown): { values: GearValues } | { error: string } {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { error: 'Details must be an object' };
  const input = raw as Record<string, unknown>, values: GearValues = {};
  for (const f of fieldsFor(kind)) {
    const v = input[f.key];
    const s = typeof v === 'number' ? String(v) : typeof v === 'string' ? v.trim() : '';
    if (!s) continue;
    if (f.type === 'number' || f.type === 'money') {
      const n = Number(s);
      if (!Number.isFinite(n) || n < (f.min ?? -Infinity) || n > (f.max ?? Infinity))
        return { error: `${f.label} must be ${f.min}–${f.max}${f.unit ? ` ${f.unit}` : ''}` };
      values[f.key] = f.type === 'money' ? Math.round(n * 100) / 100 : n;
    } else if (f.type === 'url') {
      let ok = false;
      try { ok = /^https?:$/.test(new URL(s).protocol); } catch { /* not a URL */ }
      if (!ok || s.length > 2000) return { error: `${f.label} isn't a web address` };
      values[f.key] = s;
    } else {
      if (s.length > MAX_TEXT) return { error: `${f.label} is too long (${MAX_TEXT} characters at most)` };
      values[f.key] = s;
    }
  }
  return { values };
}
