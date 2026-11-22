import { unitGap } from './unitGap.ts';
// An http(s) address of sane length.
export function isWebUrl(s: string): boolean {
  try { return /^https?:$/.test(new URL(s).protocol) && s.length <= 2000; } catch { return false; }
}

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
  key: string; label: string; type: 'text' | 'number' | 'money' | 'url' | 'select';
  unit?: string; min?: number; max?: number; options?: readonly string[]; aliases?: readonly string[];
  help?: string; // the edit form's "?" tip
}
const text = (key: string, label: string, options?: readonly string[], aliases: readonly string[] = [label.toLowerCase()], help?: string): GearField =>
  ({ key, label, type: 'text', options, aliases, help });
const num = (key: string, label: string, unit: string, min: number, max: number, aliases: readonly string[] = [label.toLowerCase()], help?: string): GearField =>
  ({ key, label, type: 'number', unit, min, max, aliases, help });

export const COMMON_FIELDS: readonly GearField[] = [
  // Two to a row on the view and edit screens: Brand | Official website, then Model | Cost.
  text('brand', 'Brand', undefined, ['brand', 'manufacturer']),
  { key: 'website', label: 'Official website', type: 'url', aliases: ['official website', 'website'] },
  text('model', 'Model', undefined, ['model', 'model number']),
  { key: 'cost', label: 'Cost', type: 'money', min: 0, max: 100000, aliases: ['cost', 'price'] }
];
export const OWN_DATA_SIMILAR = "Yes, use similar gear's brews";
export const OWN_DATA_ONLY = "No, only this gear's brews";
const ownData = { ...text('ownData', 'Learn from similar gear?', [OWN_DATA_SIMILAR, OWN_DATA_ONLY], undefined,
  "Brew now suggests grind settings, a brew temperature, and a recipe using data from your past brews. Yes: also uses brews from similar gear (e.g. other ~60° cones) when there isn't much data. No: uses only brews made with this exact gear. Choose this for gear that brews differently."), type: 'select' as const };
export const SETTING_FORMATS = ['Number (e.g. 5.5)', 'Dotted (e.g. 1.4.2)', 'Custom (any text)'] as const;
export const KIND_FIELDS: Record<GearKind, readonly GearField[]> = {
  dripper: [
    text('shape', 'Shape', ['Conical', 'Flat bottom', 'Wave', 'Hybrid'], undefined,
      "The dripper's bed shape. Conical (V60, Origami): one drain point. Flat bottom (Kalita Wave, Orea): an even bed. Wave/hybrid: between."),
    num('coneAngle', 'Cone angle', '°', 0, 180, ['cone angle', 'angle']),
    text('material', 'Material', ['Plastic', 'Tritan', 'Ceramic', 'Glass', 'Metal'], ['material', 'materials'],
      'What the dripper is made of. Plastic and Tritan hold little heat; ceramic and glass need preheating; metal heats fast.'),
    text('flow', 'Flow', ['Open', 'Restricted', 'Valve / immersion'], ['flow', 'flow rate'],
      'How fast it drains on its own. Open: grind and pour set the speed (V60). Restricted: small holes slow it (Kalita, Melitta). Valve / immersion: a valve holds the water until released (Hario Switch, Clever).'),
    text('size', 'Size', ['01', '02', '03'], undefined,
      "The maker's size code: 01 for 1–2 cups (~200–350mL), 02 for 1–4 cups (~300–600mL), 03 for larger batches."),
    ownData
  ],
  grinder: [
    text('type', 'Type', ['Hand', 'Electric'], undefined,
      'Hand (1Zpresso, Comandante, Kingrinder) or Electric (Baratza, Fellow, DF64).'),
    text('burrType', 'Burr type', ['Conical', 'Flat'], ['burr type', 'burr shape', 'burrs'],
      'Conical burrs (most hand grinders) or flat burrs (many electric grinders, e.g. SSP 102 Brew).'),
    text('burrName', 'Burr name', undefined, ['burr name', 'burr set']),
    num('burrSize', 'Burr size', 'mm', 10, 150, ['burr size', 'burr diameter']),
    text('burrCoating', 'Burr coating', ['Stainless steel', 'Hardened steel', 'Titanium (TiN)', 'DLC', 'Red Speed', 'Silver Knight'], ['burr coating', 'coating', 'burr material'],
      "The burr's finish. Plain stainless or hardened steel, or a coating (Titanium TiN, DLC, Red Speed, Silver Knight) that mainly lasts longer."),
    { ...text('adjustment', 'Adjustment', ['Stepped', 'Stepless'], ['adjustment', 'adjustment type'],
      'Stepped grinders click between fixed settings; stepless ones turn smoothly to any setting.'), type: 'select' },
    num('stepSize', 'Step size', 'µm', 0.1, 1000, ['step size', 'step', 'micron per step'],
      'How far one click moves the burrs, in microns (µm): ~12–25µm on most hand grinders, smaller is finer control.'),
    // Speed: the plain `rpm` for fixed-speed grinders, the conversion set when BQ marks the grinder's speed adjustable.
    num('rpm', 'Motor speed', 'RPM', 1, 20000, []),
    // Convert first so each dial value and its RPM share a form row (dial left, RPM right).
    { ...text('rpmConvert', 'Convert dial to RPM', ['Yes', 'No'], [],
      "Yes: BQ's speed is a dial setting; enter the dial range and the RPM at each end (linear between). No: BQ's speed is already RPM."), type: 'select' },
    num('dialMin', 'Dial min', '', 0, 1000, []),
    num('rpmMin', 'Speed at dial min', 'RPM', 1, 20000, []),
    num('dialMax', 'Dial max', '', 0, 1000, []),
    num('rpmMax', 'Speed at dial max', 'RPM', 1, 20000, []),
    // Last, so the dial/RPM pairs above keep their form rows.
    { ...text('settingFormat', 'Setting format', SETTING_FORMATS, [],
      "The shape of this grinder's grind settings. Blank: worked out from this grinder's brews. Custom: any text, never flagged. The import data warnings on Account use it to flag settings in the other shape."), type: 'select' }
  ],
  filter: [
    text('material', 'Material', ['Paper', 'Cloth', 'Metal'], ['material', 'materials'],
      'Paper is the norm (bleached or natural/unbleached); cloth gives more body; metal lets oils and fines through.'),
    text('shape', 'Shape', ['Cone', 'Wave', 'Flat-bottom basket'], undefined,
      "The paper's shape, matching the dripper. Cone (V60, Origami), wave (Kalita Wave, 155/185), flat-bottom basket (Melitta-style, batch brewers)."),
    text('fits', 'Size', ['01', '02', '155', '185'], ['fits', 'fit', 'compatibility', 'size'],
      'The size code it fits: 01 or 02 for cones, 155 or 185 for wave filters.'),
    text('flow', 'Flow', ['Fast', 'Medium', 'Slow'], ['flow', 'flow rate'],
      'How fast the paper drains, as the maker describes it. Fast (Sibarist Fast, Cafec T-90), medium (Hario tabbed), slow (thicker papers).'),
    ownData
  ]
};
export const CONVERT_KEYS = ['rpmConvert', 'dialMin', 'dialMax', 'rpmMin', 'rpmMax'];
// A grinder shows `rpm` or the dial conversion set, by whether BQ marks its speed adjustable.
export const fieldsFor = (kind: GearKind, opts: { adjustableSpeed?: boolean } = {}): GearField[] =>
  [...COMMON_FIELDS, ...KIND_FIELDS[kind]].filter((f) => f.key === 'rpm' ? !opts.adjustableSpeed : !CONVERT_KEYS.includes(f.key) || !!opts.adjustableSpeed);

export type GearValues = Record<string, string | number>;
const MAX_TEXT = 120;

// Validates a details form/import payload: known keys only, trimmed, blanks dropped. First problem wins.
export function parseGearValues(kind: GearKind, raw: unknown): { values: GearValues } | { error: string } {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { error: 'Details must be an object' };
  const input = raw as Record<string, unknown>, values: GearValues = {};
  for (const f of [...COMMON_FIELDS, ...KIND_FIELDS[kind]]) {
    const v = input[f.key];
    const s = typeof v === 'number' ? String(v) : typeof v === 'string' ? v.trim() : '';
    if (!s) continue;
    if (f.type === 'number' || f.type === 'money') {
      const n = Number(s);
      if (!Number.isFinite(n) || n < (f.min ?? -Infinity) || n > (f.max ?? Infinity))
        return { error: `${f.label} must be ${f.min}–${f.max}${f.unit ? `${unitGap(f.unit)}${f.unit}` : ''}` };
      values[f.key] = f.type === 'money' ? Math.round(n * 100) / 100 : n;
    } else if (f.type === 'url') {
      if (!isWebUrl(s)) return { error: `${f.label} isn't a web address` };
      values[f.key] = s;
    } else if (f.type === 'select') {
      if (!f.options?.includes(s)) return { error: `${f.label} must be one of ${f.options?.join(', ')}` };
      values[f.key] = s;
    } else {
      if (s.length > MAX_TEXT) return { error: `${f.label} is too long (${MAX_TEXT} characters at most)` };
      values[f.key] = s;
    }
  }
  if (kind === 'grinder' && values.adjustment !== 'Stepped') delete values.stepSize; // a step only means something on a stepped grinder
  if (kind === 'grinder') {
    if (values.type === 'Hand') delete values.rpm; // a hand grinder has no motor speed
    if (values.rpmConvert === 'Yes') {
      const need = KIND_FIELDS.grinder.find((f) => CONVERT_KEYS.slice(1).includes(f.key) && values[f.key] === undefined);
      if (need) return { error: `${need.label} is required to convert the dial to RPM` };
      if (+values.dialMax <= +values.dialMin) return { error: 'Dial max must be above dial min' };
    } else for (const k of CONVERT_KEYS.slice(1)) delete values[k]; // the dial range only means something when converting
  }
  return { values };
}
