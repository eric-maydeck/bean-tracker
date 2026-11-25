// src/lib/server/fixtures/beanconqueror/mockEspresso.ts
// A made-up Bean Conqueror (BQ) export for an espresso-first person: the regular zip's JSON files plus the
// flow-profile files that sit next to it. Every value is invented here, from ranges written here; nothing is
// read from a real export. Shapes and rates follow the coverage list (private docs, 2026-11-25-espresso-mock-coverage.md),
// whose section 8 case ids (C1-C74) the test asserts. The same seed gives byte-identical output.
type Rec = Record<string, unknown>;
export type MockSize = 'small' | 'full';
export interface MockEspresso {
  zipFiles: Record<string, string>; // Beanconqueror.json, Beanconqueror_Brews_N.json, Beanconqueror_Beans_N.json
  flowFiles: Record<string, string>; // <brew uuid>_flow_profile.json
}
export interface MockEspressoDetail extends MockEspresso {
  families: Record<string, string>; // brew uuid (or orphan uuid) of a pressure file → the curve family it was drawn from
}

const SIZES = {
  small: { brews: 330, beans: 210, days: 400, cap: 100 },
  full: { brews: 2300, beans: 1530, days: 760, cap: 500 }
};
const DAY = 86400;
const START = Date.UTC(2024, 2, 4) / 1000;

export function mockEspressoExport({ size, seed = 1 }: { size: MockSize; seed?: number }): MockEspresso {
  const { zipFiles, flowFiles } = mockEspressoDetailed(size, seed);
  return { zipFiles, flowFiles };
}
export function mockEspressoDetailed(size: MockSize, seed = 1): MockEspressoDetail {
  return build(SIZES[size], seed);
}

function mulberry32(a: number): () => number {
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---- invented word lists ----------------------------------------------------------------------------
const NAME_A = ['Amberly', 'Barrow', 'Cobble', 'Dunmore', 'Embervale', 'Fennick', 'Gantry', 'Harrow', 'Ironwood', 'Juniper',
  'Kestrel', 'Larkin', 'Marlow', 'Nettlefold', 'Orchard', 'Pennywhistle', 'Quarry', 'Rookery', 'Saffron', 'Thistledown',
  'Umber', 'Vesper', 'Willowmere', 'Yarrow', 'Zephyr', 'Alderbank', 'Brindle', 'Copperfield', 'Driftwood', 'Eventide'];
const NAME_B = ['Hills', 'Terrace', 'Hollow', 'Cooperative', 'Estate', 'Collective', 'Meadow', 'Station', 'Crest', 'Basin',
  'Highlands', 'Springs', 'Reserve', 'Grove', 'Plateau', 'Lot', 'Fields', 'Slopes', 'Gardens', 'Mill', 'Orchards', 'Bluff',
  'Cove', 'Heights', 'Valley', 'Banks', 'Peak', 'Run', 'Garden', 'Village'];
const PROCESS = ['Washed', 'Natural', 'Honey', 'Anaerobic', 'Carbonic', 'Wet Hulled', 'Pulped Natural', 'Double Fermented'];
const ROAST_A = ['Fennel', 'Harbor', 'Lantern', 'Mossy', 'Tidal', 'Cinder', 'Sable', 'Tamarind', 'Wren', 'Alder', 'Kiln', 'Bramble',
  'Plover', 'Gable', 'Nettle', 'Cairn', 'Flint', 'Sprig', 'Eddy', 'Vane', 'Larch', 'Sorrel', 'Pip', 'Teal', 'Burl'];
const ROAST_B = ['Roasters', 'Coffee Co', 'Roastery', 'Coffee Works', 'Roasting', 'Bean Lab', 'Cafe', 'Coffee House'];
const ROASTER_SYMS = ['🔥', '☕', '🌿', '⭐', '🌙', '🍃', '🌻', '🪴', '💧', '🌾'];
const ORIGINS: [string, string, string[]][] = [ // flag, country, invented regions
  ['🇪🇹', 'Ethiopia', ['Alto Rimu', 'Dessa Basin', 'Kelo Zone']], ['🇨🇴', 'Colombia', ['Cuenca Alta', 'Mirador Sur', 'Valle Nuevo']],
  ['🇰🇪', 'Kenya', ['Kabiru Ridge', 'Nyota County', 'Mwea Hills']], ['🇧🇷', 'Brazil', ['Serra Clara', 'Campo Alto', 'Vale Doce']],
  ['🇬🇹', 'Guatemala', ['Huerta Alta', 'Cerro Verde', 'Valle Lindo']], ['🇷🇼', 'Rwanda', ['Gisa District', 'Rubona Slopes', 'Nyaki Hill']],
  ['🇵🇦', 'Panama', ['Volcan Norte', 'Boquete Alto', 'Cerro Punta']], ['🇨🇷', 'Costa Rica', ['Tarraza Norte', 'Valle Oriente', 'Brunca Alta']],
  ['🇧🇮', 'Burundi', ['Kayanza North', 'Ngozi Plateau', 'Muyinga Hills']], ['🇮🇩', 'Indonesia', ['Gayo Highlands', 'Toba Shore', 'Kerinci Slope']],
  ['🇭🇳', 'Honduras', ['Marcala Alta', 'Copan Valle', 'Opalaca North']], ['🇲🇽', 'Mexico', ['Sierra Norte', 'Altos Chicos', 'Selva Fria']],
  ['🇵🇪', 'Peru', ['Cajon Alto', 'Cuzco Norte', 'Selva Central']], ['🇸🇻', 'El Salvador', ['Apaneca Sur', 'Cerro Lindo', 'Santa Rosa Alta']],
  ['🇹🇿', 'Tanzania', ['Mbozi Slopes', 'Kilo Plateau', 'Songwe North']], ['🇳🇮', 'Nicaragua', ['Nueva Alta', 'Jinotega Sur', 'Dipilto Hills']],
  ['🇺🇬', 'Uganda', ['Bugisu Slope', 'Rwenzori East', 'Kapchorwa Hill']], ['🇨🇺', 'Cuba', ['Sierra Alta', 'Escambray Sur', 'Oriente Hills']],
  ['🇹🇱', 'Timor-Leste', ['Ermera Hills', 'Letefoho Slope', 'Aileu Sur']], ['🇾🇪', 'Yemen', ['Haraz Ridge', 'Bani Hills', 'Sana Terraces']],
  ['🇮🇳', 'India', ['Chikka Hills', 'Baba Slopes', 'Nilgi Ridge']]
];
const VARIETY = ['Heirloom', 'Caturra', 'Bourbon', 'Typica', 'SL28', 'Pacamara', 'Catuai', 'Sidra', 'Pink Bourbon', 'Gesha'];
const FARM = ['Finca Alba', 'Finca Mirlo', 'Hacienda Tordo', 'Washing Station Ola', 'Kabo Co-op', 'Station Nuru', 'Finca Cordel', 'Sitio Pardal'];
const FARMER = ['Ines Calder', 'Tomas Vale', 'Amara Okon', 'Rafael Lund', 'Bea Moreno', 'Sef Haldor', 'Noor Tamsin', 'Pilar Sanz'];
const AROMA = ['peach', 'jasmine', 'black tea', 'dark chocolate', 'orange peel', 'honey', 'blueberry', 'caramel', 'cherry', 'hazelnut',
  'bergamot', 'brown sugar', 'plum', 'cedar', 'raspberry', 'baking spice', 'stone fruit', 'molasses'];
const ROAST_CUSTOM = ['Light', 'Medium Light', 'Medium', 'Filter roast', 'Omni', 'Light-Medium', 'Nordic', 'Espresso roast'];
const TOOLS = ['Halo', 'Pebble', 'Notch', 'Spindle', 'Cog', 'Bramble', 'Tern', 'Ledger', 'Kiln', 'Moth', 'Plover', 'Gable', 'Rivet',
  'Tansy', 'Ingot', 'Bobbin', 'Nettle', 'Loom', 'Cairn', 'Wicket', 'Flint', 'Gimlet', 'Sprig', 'Anvil', 'Basil', 'Cleat', 'Dowel',
  'Eddy', 'Fob', 'Gasket', 'Hasp', 'Isle', 'Jib', 'Knot', 'Lathe', 'Mallet', 'Nub', 'Oar', 'Peg', 'Quoin', 'Rung', 'Shim', 'Tack',
  'Urn', 'Vane', 'Wedge', 'Zest', 'Zinc'];
const GRINDERS = ['Corvid 55', 'Pelt 38', 'Hobnail Hand', 'Marrow Mini', 'Ostler 47', 'Tarn', 'Wick Hand', 'Sorrel Flat'];
const WATERS = ['Soft Spring Mix', 'Tap, charcoal filtered', 'Even Keel', 'Bright Draft', 'Low Alk Brew', 'Mid Hardness', 'Hard Tap',
  'Gentle Rain', 'Sparkle Cut', 'Split 50/50', 'Rich Body Mix', 'Clear Light', 'Salt Pinch', 'Mineral Boost', 'Plain Soft',
  'Soft Preset', 'Medium Preset'];
const NOTES = ['sour, finer next time', 'tasted flat', 'sweet and syrupy, very good', 'channeled at the edge', 'grind a bit coarser',
  'a little bitter, shorter shot', 'nice body, clean finish', 'bag nearly done', 'new papers', 'too fast, finer'];
const BEAN_NOTES = ['Bought a second bag.', 'Gift from a friend, roasted a week before.', 'Lovely as a filter and as a milk drink.',
  'Opened late, still good.', 'Smells like toasted bread and orange.', 'Keep in the cupboard, not the fridge.'];

type Slot = { t: number[]; p: number; kind: 'all' | 'one' | 'addon'; g?: string; second?: number; of?: number };
// Tool ticking per method: indices into the method's tool list. 'all' ticks every tool together (a pair
// that is always on); 'one' ticks one member of a group in turn (burr sets, papers); 'addon' co-ticks with a group.
const SLOTS: Record<string, Slot[]> = {
  e1: [{ t: [0, 1], p: 0.995, kind: 'all' }, { t: [7, 8, 9], p: 0.12, kind: 'one', second: 0.3 }, { t: [2, 3, 4, 5], p: 0.5, kind: 'one', g: 'G1' },
    { t: [6], p: 0.3, kind: 'addon', of: 2 }],
  e2: [{ t: [0], p: 1, kind: 'all' }, { t: [1], p: 0.96, kind: 'all' }, { t: [2, 3, 4], p: 0.9, kind: 'one', g: 'G2' },
    { t: [5, 6, 7], p: 0.25, kind: 'one', second: 0.1 }],
  e3: [{ t: [0], p: 1, kind: 'all' }, { t: [1, 2, 3], p: 0.8, kind: 'one' }, { t: [4], p: 0.2, kind: 'addon', of: 1 },
    { t: [5], p: 0.004, kind: 'all' }, { t: [6], p: 0.004, kind: 'all' }],
  e4: [{ t: [0], p: 1, kind: 'all' }, { t: [1], p: 0.5, kind: 'all' }, { t: [2], p: 0.02, kind: 'all' }],
  po1: [{ t: [0, 1, 2, 3], p: 0.6, kind: 'one' }],
  po2: [{ t: [0], p: 0.8, kind: 'all' }, { t: [1], p: 0.5, kind: 'all' }, { t: [2], p: 0.1, kind: 'all' }],
  po3: [{ t: [0], p: 0.6, kind: 'all' }, { t: [1], p: 0.3, kind: 'all' }],
  pc1: [{ t: [0], p: 0.6, kind: 'all' }],
  pc2: [{ t: [0], p: 1, kind: 'all' }, { t: [1], p: 0.5, kind: 'all' }],
  fi1: [{ t: [0], p: 0.8, kind: 'all' }, { t: [1], p: 0.4, kind: 'all' }]
};
// key, name, BQ type, style, tool count, grinders [id, weight]
const METHODS: [string, string, string, string, number, [string, number][]][] = [
  ['e1', 'Harbor Twin', 'PORTAFILTER', 'ESPRESSO', 10, [['G1', 1]]],
  ['e2', 'Lantern Duo', 'PORTAFILTER', 'ESPRESSO', 9, [['G2', 3], ['G1', 1]]],
  ['e3', 'Kettle Soup', 'CUSTOM_PREPARATION', 'ESPRESSO', 8, [['G1', 3], ['G2', 2]]],
  ['e4', 'Slate Single', 'PORTAFILTER', 'ESPRESSO', 3, [['G1', 1]]],
  ['e5', 'Pewter Bar', 'PORTAFILTER', 'ESPRESSO', 0, [['G3', 1]]],
  ['e6', 'Reed Lever', 'HAND_LEVER', 'ESPRESSO', 0, [['G4', 1]]],
  ['po1', 'Quill', 'V60', 'POUR OVER', 4, [['G3', 7], ['G4', 3]]],
  ['po2', 'Tidal Cone', 'CHEMEX', 'POUR OVER', 3, [['G4', 1]]],
  ['po3', 'Brindle', 'FELLOW_STAGG', 'POUR OVER', 2, [['G5', 1]]],
  ['po4', 'Cinder Cup', 'CUSTOM_PREPARATION', 'POUR OVER', 0, [['G5', 1], ['G7', 1]]],
  ['po5', 'Dune Flat', 'CUSTOM_PREPARATION', 'POUR OVER', 4, [['G5', 1]]], // no brews; its 4 tools are never ticked
  ['pc1', 'Mossy', 'MOCCA_MASTER', 'PERCOLATION', 1, [['G7', 1]]],
  ['pc2', 'Batch Run', 'CUSTOM_PREPARATION', 'PERCOLATION', 2, [['G3', 1]]],
  ['fi1', 'Press Pot', 'AEROPRESS', 'FULL_IMMERSION', 2, [['G8', 1]]],
  ['fi2', 'Slow Drip', 'COLD_DRIP', 'FULL_IMMERSION', 0, [['G6', 1]]],
  ['fi3', 'Steep Jar', 'CUSTOM_PREPARATION', 'FULL_IMMERSION', 0, [['G3', 1]]]
];
const NONESP: [string, number][] = [['po1', 0.34], ['po2', 0.09], ['po3', 0.12], ['po4', 0.03], ['pc1', 0.1], ['pc2', 0.17],
  ['fi1', 0.08], ['fi2', 0.04], ['fi3', 0.03]];
const SPEED_GRINDERS = ['G1', 'G2', 'G3', 'G5'];
const GRIND_RANGE: Record<string, [number, number]> = { G1: [2.2, 5.4], G3: [4, 10], G4: [3.2, 9], G5: [1.2, 4.2], G7: [3, 8], G8: [2, 6] };

// Pressure curve families (C68): peak bar, time to half peak (s), share of peak left at the end of the hold, tail (s).
interface Family { name: string; peak: [number, number]; r50: [number, number]; decline: [number, number]; tail: [number, number]; pre?: boolean; w: number }
const FAMILIES: Family[] = [
  { name: 'low-steady', peak: [1.3, 3.9], r50: [1, 6], decline: [0.93, 1], tail: [3, 9], w: 150 },
  { name: 'low-gentle', peak: [1.3, 3.9], r50: [1, 6], decline: [0.65, 0.88], tail: [3, 9], w: 128 },
  { name: 'low-steep', peak: [1.3, 3.9], r50: [1, 6], decline: [0.3, 0.55], tail: [3, 13], w: 142 },
  { name: 'high-flat', peak: [10, 10.7], r50: [0.4, 1.2], decline: [0.95, 1], tail: [3, 10], w: 40 },
  { name: 'high-gentle', peak: [10, 10.7], r50: [0.4, 1.2], decline: [0.65, 0.85], tail: [3, 10], w: 17 },
  { name: 'high-steep', peak: [10, 10.7], r50: [0.4, 1.2], decline: [0.35, 0.55], tail: [3, 12], w: 25 },
  { name: 'mid', peak: [4, 8], r50: [1, 4], decline: [0.7, 1], tail: [3, 10], w: 12 },
  { name: 'slow-start', peak: [9, 10.5], r50: [6, 10], decline: [0.85, 1], tail: [3, 10], w: 12 },
  { name: 'pre-infusion', peak: [9, 10.5], r50: [1, 2.5], decline: [0.85, 1], tail: [3, 10], pre: true, w: 12 },
  { name: 'long-flat', peak: [8.5, 9.5], r50: [1, 2], decline: [0.96, 1], tail: [4, 8], w: 0 }
];

function build(cfg: { brews: number; beans: number; days: number; cap: number }, seed: number): MockEspressoDetail {
  const f = mulberry32(seed);
  const N = cfg.brews;
  const int = (a: number, b: number) => a + Math.floor(f() * (b - a + 1));
  const chance = (p: number) => f() < p;
  const pick = <T,>(a: T[]): T => a[Math.floor(f() * a.length)];
  const pickW = <T,>(items: [T, number][]): T => {
    let r = f() * items.reduce((n, [, w]) => n + w, 0);
    for (const [v, w] of items) if ((r -= w) < 0) return v;
    return items[items.length - 1][0];
  };
  const gauss = () => Math.sqrt(-2 * Math.log(1 - f())) * Math.cos(2 * Math.PI * f());
  const r1 = (x: number) => Math.round(x * 10) / 10;
  const r2 = (x: number) => Math.round(x * 100) / 100;
  const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));
  const range = (r: [number, number]) => r[0] + f() * (r[1] - r[0]);
  const shuffle = <T,>(a: T[]): T[] => {
    const b = a.slice();
    for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(f() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; }
    return b;
  };
  const hex = (n: number) => Array.from({ length: n }, () => '0123456789abcdef'[Math.floor(f() * 16)]).join('');
  const seen = new Set<string>();
  const uid = (): string => {
    const u = `${hex(8)}-${hex(4)}-4${hex(3)}-${'89ab'[int(0, 3)]}${hex(3)}-${hex(12)}`;
    if (seen.has(u)) return uid();
    seen.add(u);
    return u;
  };
  const cnt = (rate: number, min: number) => Math.max(min, Math.round(rate * N)); // an oddity's count, scaled to this size
  const iso = (sec: number, ms = true) => {
    const s = new Date(Math.floor(sec) * 1000 + (ms ? int(0, 999) : 0)).toISOString();
    return ms ? s : s.replace(/\.\d{3}Z$/, 'Z');
  };

  // ---- gear ---------------------------------------------------------------------------------------------
  const cfgOf = (ts: number) => ({ uuid: uid(), unix_timestamp: ts });
  const gearTs = START - 40 * DAY;
  const grinders = GRINDERS.map((name, i) => ({ id: 'G' + (i + 1), name, uuid: uid(), finished: i === 6 }));
  const gById = new Map(grinders.map((g) => [g.id, g]));
  const toolNames = shuffle(TOOLS);
  let ti = 0;
  const methods = METHODS.map(([key, name, type, style, nTools, grs]) => ({
    key, name, type, style, grs, uuid: uid(),
    tools: Array.from({ length: nTools }, () => ({ name: toolNames[ti++], uuid: uid(), ts: gearTs + int(0, 20) * DAY }))
  }));
  const mByKey = new Map(methods.map((m) => [m.key, m]));
  // repeat names: the same tool created again under another method
  [['e3', 0, 'e1', 0], ['e3', 4, 'e1', 6], ['po1', 0, 'e2', 1], ['e4', 1, 'e2', 0], ['pc2', 1, 'po3', 0]].forEach(([a, ai, b, bi]) => {
    mByKey.get(a as string)!.tools[ai as number].name = mByKey.get(b as string)!.tools[bi as number].name;
  });
  mByKey.get('po5')!.tools[0].name = '49'; // a tool named by a plain number
  const waterIds = WATERS.map(() => uid());
  const water = WATERS.map((name, i) => {
    const preset = i >= 14;
    const mineral = (max: number) => (chance(0.45) ? 0 : int(1, max));
    const t = (): string => pickW([['PPM', 67], ['UNKNOWN', 37], ['MG_L', 15]]);
    const w: Rec = {
      name, note: chance(0.35) ? pick(['Mix by volume, tested with strips', 'Distilled plus a pinch of salts', 'Fridge jug']) : '',
      config: { uuid: waterIds[i], unix_timestamp: gearTs + int(0, 300) * DAY }, attachments: chance(0.75) ? [`image/${uid()}.jpg`] : [], finished: false,
      general_hardness: mineral(220), total_alkalinity: mineral(137), calcium: mineral(45), magnesium: mineral(95), sodium: mineral(80),
      potassium: mineral(40), chloride: mineral(70), sulfate: 0, tds: mineral(180)
    };
    for (const k of ['general_hardness', 'total_alkalinity', 'calcium', 'magnesium', 'sodium', 'potassium', 'chloride', 'sulfate', 'tds']) w[`${k}_type`] = i === 0 && k === 'tds' ? 'PPM' : t();
    w.type = preset ? ['PRESET_SOFT', 'PRESET_MEDIUM'][i - 15] ?? 'PRESET_SOFT' : 'CUSTOM_WATER';
    return w;
  });

  // ---- brew times: 2-8 a day (median 4), two gaps over a week --------------------------------------------
  const nDays = Math.round(N / 4);
  const holidays: [number, number][] = [[Math.floor(cfg.days * 0.3), 9], [Math.floor(cfg.days * 0.62), 11]];
  let days = Array.from({ length: nDays }, (_, k) => Math.floor((k * cfg.days) / nDays + (f() * cfg.days) / nDays));
  days[0] = 0;
  days[nDays - 1] = cfg.days - 1;
  days = [...new Set(days)].filter((d) => d === 0 || d === cfg.days - 1 || !holidays.some(([s, l]) => d >= s && d < s + l));
  const perDay = days.map(() => pickW([[2, 1], [3, 2], [4, 3], [5, 2], [6, 1.2], [7, 0.3], [8, 0.2]] as [number, number][]));
  let total = perDay.reduce((a, b) => a + b, 0);
  while (total > N) { const k = int(0, perDay.length - 1); if (perDay[k] > 2) { perDay[k]--; total--; } }
  while (total < N) { const k = int(0, perDay.length - 1); if (perDay[k] < 8) { perDay[k]++; total++; } }
  const stamps: number[] = [];
  days.forEach((d, k) => {
    const day = Array.from({ length: perDay[k] }, () => START + d * DAY + 19 * 3600 + int(0, 10 * 3600)).sort((a, b) => a - b);
    stamps.push(...day);
  });
  for (let i = 1; i < stamps.length; i++) if (stamps[i] <= stamps[i - 1]) stamps[i] = stamps[i - 1] + 61;

  // ---- shots (internal brew model) ----------------------------------------------------------------------
  interface Shot {
    i: number; ts: number; mkey: string; esp: boolean; style: string; mill: string; bean: number; uuid: string;
    dose: number; yield: number; waterIn: number; brewTime: number; drip: number; bloom: number; temp: number; grind: string | number;
    speed: number; tds: number; rating: number; note: string; profile: string; coffeeType: string; tools: string[]; waterId: string;
    flow: boolean; pressure: boolean; family: string; dur: number; favourite: boolean; vessel: [string, number]; att: string[];
    flavors: Rec; dip: boolean; spike: boolean; dropEnd: boolean; reset: boolean; negP: boolean; ratio: number;
  }
  const nonEspN = Math.round(N * 0.1);
  const nonEspIdx = new Set(shuffle(Array.from({ length: N }, (_, i) => i)).slice(0, nonEspN));
  const nonMethods = shuffle(NONESP.map(([k]) => k));
  let nonSeen = 0;
  const shots: Shot[] = stamps.map((ts, i) => {
    const p = i / (N - 1);
    const esp = !nonEspIdx.has(i);
    const mkey = esp ? (p < 0.42 + (f() - 0.5) * 0.06 ? 'e1' : p < 0.72 + (f() - 0.5) * 0.06 ? 'e2' : 'e3')
      : nonSeen < nonMethods.length ? nonMethods[nonSeen++] : pickW(NONESP);
    return {
      i, ts, mkey, esp, style: mByKey.get(mkey)!.style, mill: '', bean: -1, uuid: uid(), dose: 0, yield: 0, waterIn: 0, brewTime: 0, drip: 0, bloom: 0,
      temp: 0, grind: 0, speed: 0, tds: 0, rating: 0, note: '', profile: '', coffeeType: '', tools: [], waterId: '', flow: false, pressure: false,
      family: '', dur: 0, favourite: false, vessel: ['', 0], att: [], flavors: {}, dip: false, spike: false, dropEnd: false, reset: false,
      negP: false, ratio: 0
    };
  });
  const used = new Set<number>();
  const force = (n: number, ok: (s: Shot) => boolean, apply: (s: Shot) => void) => {
    const c = shuffle(shots.filter((s) => !used.has(s.i) && ok(s)));
    for (let k = 0; k < n && k < c.length; k++) { used.add(c[k].i); apply(c[k]); }
  };
  // tiny espresso methods (1-5 brews each), anywhere in time
  force(cnt(0.0015, 2), (s) => s.esp, (s) => { s.mkey = 'e4'; });
  force(cnt(0.001, 1), (s) => s.esp, (s) => { s.mkey = 'e5'; });
  force(cnt(0.002, 2), (s) => s.esp, (s) => { s.mkey = 'e6'; });
  used.clear();
  for (const s of shots) {
    s.style = mByKey.get(s.mkey)!.style;
    s.mill = pickW(mByKey.get(s.mkey)!.grs);
  }

  // ---- beans: lots (portions of one purchase share name, roaster, roast date), uses, then dates -------------
  const roasterN = Math.max(10, Math.round((228 * cfg.beans) / 1540));
  const roasters = shuffle(ROAST_A.flatMap((a) => ROAST_B.map((b) => `${a} ${b}`))).slice(0, roasterN).map((n) => `${pick(ROASTER_SYMS)} ${n}`);
  const roasterW = roasters.map((r, k) => [r, 1 / (1 + k * 0.35)] as [string, number]);
  interface Lot { size: number; name: string; roaster: string; origin: number; blend: boolean; base: number; roast: number; frozen: 'none' | 'mixed' | 'full'; group: boolean; mid: boolean }
  const lots: Lot[] = [];
  const lotOf: number[] = []; // bean index → lot index
  const sizeDist: [number, number][] = [[2, 14], [3, 15], [4, 23], [5, 14], [6, 3], [7, 1], [10, 1], [11, 1]];
  let nBeans = 0;
  const mkName = (o: number) => {
    const base = `${ORIGINS[o][0]} ${pick(NAME_A)} ${pick(NAME_B)}`;
    if (chance(0.4)) return base;
    const sep = pickW([[' - ', 361], [' / ', 57], [' (', 38], [', ', 35], [' | ', 11], [' – ', 12], [' — ', 2]] as [string, number][]);
    const tail = chance(0.5) ? pick(PROCESS) : `Lot ${int(1, 40)}`;
    return sep === ' (' ? `${base} (${tail})` : base + sep + tail;
  };
  while (nBeans < cfg.beans) {
    const multi = chance(0.065);
    const size = Math.min(multi ? pickW(sizeDist) : 1, cfg.beans - nBeans);
    const prev = lots.length && chance(0.15) ? pick(lots) : null;
    const origin = prev ? prev.origin : int(0, ORIGINS.length - 1);
    lots.push({
      size, name: prev ? prev.name : mkName(origin), roaster: prev ? prev.roaster : pickW(roasterW), origin, blend: chance(0.02), base: 0, roast: 0,
      frozen: 'none', group: size > 1 || chance(0.54), mid: chance(0.09)
    });
    if (size === 1 && [3, 9, 15].includes(lots.length - 1)) lots[lots.length - 1].blend = true;
    for (let k = 0; k < size; k++) lotOf.push(lots.length - 1);
    nBeans += size;
  }
  // the first three multi-bean lots: one mixed, one fully frozen, one not frozen (so every case exists even when small)
  const multiLots = lots.filter((l) => l.size > 1);
  multiLots.forEach((l, k) => { l.frozen = k === 0 ? 'mixed' : k === 1 ? 'full' : k === 2 ? 'none' : chance(0.85) ? (chance(0.78) ? 'mixed' : 'full') : 'none'; });
  lots.forEach((l) => { if (l.size === 1 && chance(0.008)) { l.frozen = 'full'; l.group = chance(0.2); } });
  const beanFrozen: boolean[] = [];
  lots.forEach((l, li) => {
    const members = lotOf.map((x, b) => (x === li ? b : -1)).filter((b) => b >= 0);
    const nFro = l.frozen === 'full' ? members.length : l.frozen === 'mixed' ? int(Math.ceil(members.length * 0.6), members.length - 1) : 0;
    members.forEach((b, k) => { beanFrozen[b] = k < nFro; });
  });
  const uses: number[] = Array.from({ length: cfg.beans }, (_, b) => {
    if (beanFrozen[b]) return chance(0.1) ? 1 : 0;
    if (chance(0.054)) return 0;
    return pickW([[1, 0.509], [2, 0.255], [Math.min(9, 3 + Math.floor(-Math.log(1 - f()) * 1.1)), 0.233], [int(10, 14), 0.003]] as [number, number][]);
  });
  const firstUsed = uses.findIndex((u, b) => u > 0 && !beanFrozen[b]);
  uses[firstUsed] = 10;
  const usedBeans = () => uses.map((u, b) => (u > 0 ? b : -1)).filter((b) => b >= 0);
  let sum = uses.reduce((a, b) => a + b, 0);
  while (sum > N) { const b = pick(usedBeans()); if (b !== firstUsed && (uses[b] > 1 || !beanFrozen[b])) { uses[b]--; sum--; } }
  while (sum < N) { const b = pick(usedBeans()); uses[b]++; sum++; }
  // at least two brews on frozen beans (a few real ones are brewed)
  let frozenUsed = beanFrozen.filter((fz, b) => fz && uses[b] > 0).length;
  for (let b = 0; b < cfg.beans && frozenUsed < 2; b++) if (beanFrozen[b] && uses[b] === 0) { uses[b] = 1; frozenUsed++; const v = pick(usedBeans().filter((x) => !beanFrozen[x] && uses[x] > 1)); uses[v]--; }
  lots.forEach((l, li) => { l.base = START - 40 * DAY + (li / lots.length) * cfg.days * DAY; });
  const entries: { b: number; at: number }[] = [];
  uses.forEach((u, b) => {
    const l = lots[lotOf[b]];
    const gap = int(2, 8) * DAY;
    const start = l.base + int(15, 55) * DAY;
    for (let k = 0; k < u; k++) entries.push({ b, at: start + k * gap + int(0, DAY) });
  });
  entries.sort((a, b) => a.at - b.at);
  entries.forEach((e, k) => { shots[k].bean = e.b; });
  const firstUse: number[] = Array(cfg.beans).fill(Infinity);
  const lastUse: number[] = Array(cfg.beans).fill(-Infinity);
  for (const s of shots) { firstUse[s.bean] = Math.min(firstUse[s.bean], s.ts); lastUse[s.bean] = Math.max(lastUse[s.bean], s.ts); }
  const oldLot = lotOf[shots[Math.floor(N / 3)].bean];
  const ageFirst = () => (chance(0.03) ? int(100, 250) : 3 + Math.round(Math.exp(Math.log(37) + 0.55 * gauss())));
  lots.forEach((l, li) => {
    const members = lotOf.map((x, b) => (x === li ? b : -1)).filter((b) => b >= 0);
    const ref = Math.min(...members.map((b) => (firstUse[b] < Infinity ? firstUse[b] : l.base + 30 * DAY)));
    const roast = ref - (li === oldLot ? 150 : Math.min(ageFirst(), 250)) * DAY - int(0, DAY - 1);
    // a brew is never before the roast, and a lot's frozen portions stay in the freezer past it
    l.roast = roast;
  });
  const beanTs = Array.from({ length: cfg.beans }, (_, b) => lots[lotOf[b]].roast + int(3, 14) * DAY + int(0, DAY - 1));
  if (!shots.some((s) => beanTs[s.bean] > s.ts)) { const s = shots[Math.floor(N / 2)]; beanTs[s.bean] = s.ts + 2 * DAY; } // C9: a brew before its bean's own timestamp

  // ---- brew parameters ----------------------------------------------------------------------------------
  const flowStart = START + cfg.days * 0.16 * DAY;
  const timeBucket = () => pickW([[int(8, 14), 5.8], [int(15, 19), 34.6], [int(20, 34), 51.5], [int(35, 59), 6.7], [int(60, 99), 1.5]] as [number, number][]);
  const dripOf = () => (chance(0.2) ? 1 : chance(0.88) ? int(2, 9) : int(10, 14));
  const eraDays = (s: Shot) => s.ts >= flowStart;
  for (const s of shots) {
    if (s.esp) {
      s.dose = chance(0.48) ? r1(clamp(21.4 + 2.1 * gauss(), 16.5, 27)) : Math.round(clamp(21.4 + 2.1 * gauss(), 16.5, 27));
      s.ratio = Math.exp(Math.log(3.05) + 0.17 * gauss());
      s.yield = chance(0.9) ? r1(s.dose * s.ratio) : Math.round(s.dose * s.ratio);
      if (chance(0.54)) {
        s.temp = s.mkey === 'e1' ? pickW([[99, 0.9], [96, 0.04], [95, 0.02], [90, 0.04]] as [number, number][])
          : s.mkey === 'e2' ? pickW([[88, 0.85], [90, 0.1], [99, 0.05]] as [number, number][]) : pickW([[99, 0.5], [88, 0.5]] as [number, number][]);
      }
      s.coffeeType = s.mkey === 'e1' && chance(0.99) ? 'espresso' : '';
      if (eraDays(s)) {
        s.flow = chance(0.77);
        if (s.flow) { s.brewTime = timeBucket(); s.drip = dripOf(); s.dur = s.brewTime * (chance(0.8) ? 1 + gauss() * 0.015 : 1 + range([-0.15, 0.15])); }
        else if (chance(0.04)) s.brewTime = timeBucket(); // a timed shot with no scale
      }
    } else {
      const dose = (a: number, b: number) => (chance(0.5) ? r1(range([a, b])) : int(a, b));
      if (s.style === 'POUR OVER') {
        s.dose = chance(0.06) ? int(31, 40) : dose(15, 21); s.waterIn = Math.round(s.dose * range([15, 17.5])); s.brewTime = int(120, 260);
        s.bloom = chance(0.8) ? int(20, 60) : 0; s.temp = chance(0.85) ? pick([92, 93, 94, 95, 96, 96, 100]) : 0;
      } else if (s.style === 'PERCOLATION') {
        s.dose = int(30, 68); s.waterIn = int(500, 1000); s.brewTime = int(180, 600); s.bloom = chance(0.5) ? int(30, 120) : 0;
        s.temp = chance(0.85) ? int(90, 96) : 0;
        if (s.mkey === 'pc2') s.profile = pick(['Pulse x3', 'Slow even pour', 'Pulse x2']);
      } else {
        s.dose = s.mkey === 'fi1' ? int(15, 18) : s.mkey === 'fi2' ? int(60, 100) : int(12, 30);
        s.waterIn = s.mkey === 'fi2' ? int(600, 880) : int(200, 450); s.brewTime = s.mkey === 'fi2' ? int(300, 880) : int(90, 240);
        s.bloom = chance(0.3) ? int(20, 60) : 0; s.temp = s.mkey === 'fi2' ? 0 : chance(0.8) ? int(88, 96) : 0;
      }
    }
    if (SPEED_GRINDERS.includes(s.mill) && chance(0.6)) s.speed = 100 * int(2, 20);
    s.grind = s.mill === 'G2' ? int(180, 820) : s.mill === 'G6' ? '' : r1(range(GRIND_RANGE[s.mill]));
    if (typeof s.grind === 'number' && s.mill !== 'G2' && chance(0.1)) s.grind = Math.round(s.grind);
    s.waterId = s.esp || chance(0.77) ? waterIds[clamp(Math.floor((s.i / N) * 14) + int(-1, 2), 0, 13)] : '';
    if (chance(0.03)) s.waterId = pick(waterIds);
  }
  // pressure: the soup brewer is low pressure, the first portafilter sometimes high
  for (const s of shots) if (s.esp && s.flow && chance(s.mkey === 'e3' ? 0.85 : s.mkey === 'e1' ? 0.18 : 0.04)) s.pressure = true;

  // ---- forced oddities (every one has a minimum so the small export has it too) ---------------------------
  const esp = (s: Shot) => s.esp;
  const non = (s: Shot) => !s.esp;
  force(cnt(0.0017, 1), (s) => s.esp, (s) => { s.dose = 0; });
  force(1, esp, (s) => { s.dose = 2; s.yield = 5.4; });
  force(cnt(0.0021, 1), esp, (s) => { s.yield = 0; });
  force(cnt(0.0009, 1), esp, (s) => { s.yield = pick([0.4, 9]); });
  force(1, esp, (s) => { s.dose = 20.2; s.yield = 285; }); // also the ratio above 1:8
  force(1, esp, (s) => { s.yield = r1(s.dose * 0.88); }); // ratio below 1:1
  force(cnt(0.003, 2), esp, (s) => { s.yield = r1(s.dose * range([1.2, 1.45])); });
  force(1, (s) => s.esp && s.flow, (s) => { s.brewTime = 125; s.dur = 125; s.drip = 6; s.pressure = true; s.family = 'long-flat'; });
  force(1, (s) => s.esp && !s.flow, (s) => { s.brewTime = 3; s.drip = 0; });
  force(cnt(0.0008, 2), (s) => s.esp && s.flow, (s) => { s.brewTime = int(7, 9); s.dur = s.brewTime; s.drip = s.brewTime + int(0, 2); });
  force(cnt(0.0017, 3), (s) => s.esp && s.flow, (s) => { s.drip = int(31, 65); s.brewTime = s.drip + int(8, 20); s.dur = s.brewTime; });
  force(1, (s) => s.esp && s.flow, (s) => { s.brewTime = 0; });
  force(cnt(0.0034, 2), (s) => s.esp && s.flow, (s) => { s.drip = 0; });
  force(cnt(0.0013, 1), (s) => s.esp && !s.flow, (s) => { s.drip = int(2, 8); s.brewTime = int(18, 30); });
  force(cnt(0.0055, 2), non, (s) => { s.mill = 'G6'; s.grind = ''; s.speed = 0; });
  force(cnt(0.0013, 2), esp, (s) => { s.grind = 0; });
  force(cnt(0.0009, 2), non, (s) => { s.mill = 'G2'; s.grind = int(180, 820); s.speed = chance(0.5) ? 100 * int(2, 20) : 0; });
  force(cnt(0.011, 2), (s) => s.style === 'POUR OVER', (s) => { s.temp = 100; });
  force(cnt(0.0063, 2), (s) => s.style === 'PERCOLATION', (s) => { s.temp = 200; });
  force(1, non, (s) => { s.bloom = 3480; });
  force(cnt(0.0013, 1), (s) => s.style === 'POUR OVER', (s) => { s.yield = Math.round(s.waterIn * 0.9); });
  force(cnt(0.0038, 1), esp, (s) => { s.coffeeType = 'americano'; });
  force(cnt(0.0017, 1), esp, (s) => { s.coffeeType = 'Cortado'; });
  force(cnt(0.04, 3), (s) => s.esp && s.flow, (s) => { s.bloom = pickW([[10, 4], [5, 1], [8, 1], [7, 1]] as [number, number][]); });
  force(cnt(0.0035, 3), esp, (s) => { s.tds = used.size % 3 === 0 ? 2 : r2(range([0.5, 3])); });
  force(1, non, (s) => { s.mill = 'G6'; s.grind = ''; });
  // flows on a few pour-over and percolation brews
  force(cnt(0.0013, 1), (s) => s.style === 'POUR OVER' && eraDays(s), (s) => { s.flow = true; s.dur = s.brewTime; });
  force(1, (s) => s.style === 'PERCOLATION' && eraDays(s), (s) => { s.flow = true; s.dur = s.brewTime; });
  // favourites, vessel, attachments, flavors
  force(cnt(0.0013, 2), () => true, (s) => { s.favourite = true; });
  force(2, esp, (s) => { s.vessel = ['Glass Jug 2', used.size % 2 ? 246.3 : 0]; });
  force(cnt(0.0017, 1), () => true, (s) => { s.att = [`image/${uid()}.jpg`]; });
  force(1, () => true, (s) => { s.flavors = { '12': true, '31': true, '7': true }; });
  // brew notes: ASCII, newline, emoji, accented letter, long (up to ~160 chars)
  const noteIdx = new Set<number>();
  for (const s of shots) if (chance(s.esp ? 0.022 : 0.15)) noteIdx.add(s.i);
  while (noteIdx.size < cnt(0.036, 8)) noteIdx.add(int(0, N - 1));
  const noteForms = ['grind finer, sour at the end', 'second cup\ntasted better', 'sweet and juicy 🍑', 'très doux, un peu court', 'long note ' + 'about the pour and the puck, '.repeat(5).slice(0, 150)];
  [...noteIdx].forEach((i, k) => { shots[i].note = k < noteForms.length ? noteForms[k] : pick(NOTES); });
  // ratings: ~2.5% of brews, whole and half steps; espresso ones only on one method
  const ratable = shots.filter((s) => !s.esp || s.mkey === 'e2');
  shuffle(ratable).slice(0, cnt(0.025, 6)).forEach((s, k) => { s.rating = k % 2 ? pick([0.5, 1.5, 2.5, 3.5, 4.5]) : pick([2, 3, 3, 4, 4, 1]); });

  // ---- tools ticked -----------------------------------------------------------------------------------
  const L = Math.max(8, Math.round((40 * N) / 2300));
  const groupCount = new Map<string, number>();
  const orders = new Map<string, number[]>();
  for (const s of shots) {
    const m = mByKey.get(s.mkey)!;
    const slots = SLOTS[s.mkey] ?? [];
    const ticked: (number | null)[] = slots.map(() => null);
    const picked: number[] = [];
    slots.forEach((sl, si) => {
      if (sl.kind === 'addon') { if (ticked[sl.of!] !== null && chance(sl.p)) picked.push(...sl.t); return; }
      if (sl.g && s.mill !== sl.g) return;
      if (!chance(sl.p)) return;
      if (sl.kind === 'all') { picked.push(...sl.t); ticked[si] = 0; return; }
      const key = s.mkey + si;
      const n = groupCount.get(key) ?? 0;
      groupCount.set(key, n + 1);
      if (!orders.has(key)) orders.set(key, shuffle(sl.t.map((_, k) => k)));
      const order = orders.get(key)!;
      let k = order[(Math.floor(n / L) + (chance(0.12) ? int(1, sl.t.length - 1) : 0)) % sl.t.length];
      ticked[si] = k;
      picked.push(sl.t[k]);
      if (sl.second && chance(sl.second)) { k = (k + int(1, sl.t.length - 1)) % sl.t.length; picked.push(sl.t[k]); }
    });
    s.tools = picked.slice(0, 4).map((k) => m.tools[k].uuid); // BQ's real shots tick at most four
  }
  // one tool created after it was first ticked
  const lateTool = mByKey.get('e2')!.tools[7];
  const firstTick = Math.min(...shots.filter((s) => s.tools.includes(lateTool.uuid)).map((s) => s.ts), START + cfg.days * DAY * 0.6);
  lateTool.ts = firstTick + 30 * DAY;
  // a late-created tool must not postdate the whole data: keep it inside the span
  if (lateTool.ts > START + cfg.days * DAY) lateTool.ts = firstTick + DAY;

  // ---- pressure families and profile text -----------------------------------------------------------------
  const pressureShots = shuffle(shots.filter((s) => s.pressure));
  const famOrder = FAMILIES.filter((fm) => fm.w > 0).map((fm) => fm.name);
  let fi = 0;
  const profileForms = ['4letter', 'bare', '6letter', 'hyphen', 'comma', 'plus'];
  let pf = 0;
  const profileText = (): string => {
    const form = pf < profileForms.length ? profileForms[pf++] : chance(0.9) ? 'dominant' : pick(['4letter', 'bare', '6letter', 'hyphen', 'comma', 'plus']);
    switch (form) {
      case '4letter': return 'Flat';
      case 'bare': return pf <= 3 && N > 1000 ? '137' : String(pick([9, 8, 6, 10]));
      case '6letter': return 'Smooth';
      case 'hyphen': return 'pre 3bar - ramp, 9bar';
      case 'comma': return 'soft start, hold, fade';
      case 'plus': return 'lever+decline';
      default: return `${chance(0.97) ? 6 : 9}bar Smooth`;
    }
  };
  for (const s of pressureShots) {
    if (!s.family) s.family = fi < famOrder.length ? famOrder[fi++] : pickW(FAMILIES.map((fm) => [fm.name, fm.w] as [string, number]));
    s.profile = chance(0.95) ? profileText() : '';
  }
  if (pressureShots.length) { pressureShots[0].negP = true; }
  const flowShots = shots.filter((s) => s.flow);
  if (flowShots.length) {
    shuffle(flowShots).slice(0, cnt(0.003, 1)).forEach((s) => { s.dip = true; });
    shuffle(flowShots).slice(0, cnt(0.0013, 1)).forEach((s) => { s.reset = true; });
    shuffle(flowShots).slice(0, 1).forEach((s) => { s.spike = true; });
    shuffle(flowShots).slice(0, Math.round(flowShots.length * 0.06)).forEach((s) => { s.dropEnd = true; });
  }

  // ---- serialize beans ------------------------------------------------------------------------------------
  const frozenIds = new Set<string>();
  const frozenId = () => { let c: string; do c = chance(0.01) ? String(int(100000, 999999)) : hex(6); while (frozenIds.has(c)); frozenIds.add(c); return c; };
  const groupIds = lots.map(() => uid());
  let storageN = 0;
  const frozenInfo: ({ date: string; storage: string; unfrozen: string } | null)[] = [];
  let frozenCount = 0;
  const cupping = () => ({ body: 0, brightness: 0, clean_cup: 0, complexity: 0, cuppers_correction: 0, dry_fragrance: 0, finish: 0, flavor: 0, sweetness: 0, uniformity: 0, wet_aroma: 0, notes: '' });
  let blendSeen = 0;
  const lotRd = new Map<number, string>();
  const beans: Rec[] = [];
  const beanUuids: string[] = [];
  for (let b = 0; b < cfg.beans; b++) {
    const l = lots[lotOf[b]];
    const used = uses[b] > 0;
    const blend = l.blend;
    const comps = blend ? [2, 1, 3][blendSeen] ?? pickW([[1, 7], [2, 20], [3, 3]] as [number, number][]) : 1;
    const zeros = blend && (blendSeen === 0 || (blendSeen > 2 && chance(0.4)));
    if (blend) blendSeen++;
    const info: Rec[] = [];
    for (let c = 0; c < comps; c++) {
      const o = c === 0 ? ORIGINS[l.origin] : pick(ORIGINS);
      const e: Rec = {};
      const put = (k: string, v: unknown, p: number) => { if (chance(p)) e[k] = v; };
      put('country', `${o[0]} ${o[1]}`, 0.997); put('region', pick(o[2]), 0.992); put('processing', chance(0.75) ? pick(PROCESS) : `${pick(PROCESS)} ${pick(['lot', 'blend', 'micro lot'])}`, 0.995);
      put('variety', chance(0.05) ? String(int(1, 9)) : pick(VARIETY), 0.99); put('farm', pick(FARM), 0.97); put('farmer', pick(FARMER), 0.97);
      put('elevation', pick([`${int(12, 21) * 100} - ${int(19, 24) * 100} masl`, `${int(14, 22) * 100}–${int(19, 24) * 100} meters`, `${int(12, 22) * 100}+ masl`]), 0.989);
      put('harvest_time', chance(0.8) ? pick(['2024', '2025', 'Nov/Dec 2024', '2024/25', String(int(2023, 2025))]) : '', 0.605);
      put('percentage', blend ? (zeros ? 0 : c === 0 ? 100 - Math.floor(100 / comps) * (comps - 1) : Math.floor(100 / comps)) : pick([100, 100, 100, 0]), blend ? 1 : 0.19);
      put('certification', pick(['Organic', 'Fair trade', '']), 0.034); put('fob_price', int(3, 40), 0.034); put('purchasing_price', int(4, 60), 0.047);
      info.push(e);
    }
    const rated = used ? chance(0.78) : chance(0.05);
    const rating = rated ? clamp(Math.round((3.25 + 0.5 * gauss()) * 4) / 4, 0.25, 4.5) : 0;
    const weight = beanFrozen[b] && l.size > 1 ? pick([20, 40, 50, 60, 100, 125]) : chance(0.7) ? pick([20, 40, 50, 60, 100, 125, 250, 340]) : int(15, 460);
    const cost = chance(0.15) ? 0 : pickW([[int(3, 60), 0.28], [r1(range([3, 40])), 0.24], [r2(range([3, 60])), 0.32]] as [number, number][]);
    const roastType = pickW([['FILTER', 1483], ['ESPRESSO', 26], ['OMNI', 21], ['UNKNOWN', 10]] as [string, number][]);
    const roast = pickW([['CUSTOM_ROAST', 1377], ['UNKNOWN', 149], ['CINNAMON_ROAST', 12], ['CITY_ROAST', 1], ['MODERATE_LIGHT_ROAST', 1]] as [string, number][]);
    const nAtt = chance(0.17) ? 0 : pickW([[1, 894], [2, 260], [3, 112], [int(4, 6), 6]] as [number, number][]);
    const fz = beanFrozen[b];
    if (fz) {
      const storage = storageN < 4 ? ['TUBE', 'COFFEE_BAG', 'VACUUM_SEALED', 'UNKNOWN'][storageN] : pickW([['TUBE', 193], ['VACUUM_SEALED', 16], ['COFFEE_BAG', 12], ['UNKNOWN', 8]] as [string, number][]);
      storageN++;
      const fd = l.roast + clamp(Math.round(84 + 28 * gauss()), 6, 132) * DAY + int(0, DAY - 1);
      frozenInfo[b] = { date: iso(fd), storage, unfrozen: '' };
      frozenCount++;
    } else frozenInfo[b] = null;
    const roastMid = l.mid;
    if (!lotRd.has(lotOf[b])) lotRd.set(lotOf[b], roastMid ? `${new Date(l.roast * 1000).toISOString().slice(0, 10)}T12:00:00.000Z` : iso(l.roast, true));
    const rd = lotRd.get(lotOf[b])!; // one roast date for every portion of a lot
    const uuid = uid();
    beanUuids.push(uuid);
    const finished = used && chance(0.936) && lastUse[b] < START + (cfg.days - 21) * DAY;
    beans.push({
      name: l.name, buyDate: '', roastingDate: rd, note: chance(0.02) ? null : chance(0.12) ? pick(BEAN_NOTES) + (chance(0.3) ? `\n${pick(BEAN_NOTES)}` : '') : '',
      roaster: l.roaster, config: { uuid, unix_timestamp: beanTs[b] }, roast, roast_range: chance(0.02) ? int(1, 9) / 2 : 0,
      roast_custom: roast === 'CUSTOM_ROAST' ? pick(ROAST_CUSTOM) : '', beanMix: blend ? 'BLEND' : 'SINGLE_ORIGIN',
      aromatics: chance(0.021) ? '' : Array.from({ length: int(1, 4) }, () => pick(AROMA)).join(', '), weight, finished, cost,
      attachments: Array.from({ length: nAtt }, () => `image/${uid()}.jpg`), decaffeinated: chance(0.033), cupping_points: chance(0.02) ? String(int(80, 90)) : '',
      bean_roasting_type: roastType, bean_information: info, url: chance(0.83) ? `https://example.com/shop/${hex(chance(0.05) ? 120 : 8)}` : '',
      ean_article_number: chance(0.023) ? null : '',
      bean_roast_information: { drop_temperature: 0, roast_length: 0, roaster_machine: '', green_bean_weight: 0, outside_temperature: 0, humidity: 0, bean_uuid: '',
        first_crack_minute: 0, first_crack_temperature: 0, second_crack_minute: 0, second_crack_temperature: 0 },
      rating, qr_code: chance(0.115) ? undefined : chance(0.012) ? hex(8) : '', internal_share_code: chance(0.016) ? hex(6) : '',
      favourite: false, shared: false, cupping: cupping(), cupped_flavor: { custom_flavors: [], predefined_flavors: {} },
      frozenDate: frozenInfo[b]?.date ?? '', unfrozenDate: '', frozenId: fz ? frozenId() : '', frozenGroupId: l.group ? groupIds[lotOf[b]] : '',
      frozenStorageType: frozenInfo[b]?.storage ?? 'UNKNOWN', frozenNote: '', bestDate: '', openDate: '', co2e_kg: 0
    });
  }
  // bean oddities (C46-C59): each forced once at least
  const beanForce = (n: number, ok: (b: Rec, i: number) => boolean, apply: (b: Rec, i: number) => void) => {
    const c = shuffle(beans.map((b, i) => i).filter((i) => ok(beans[i], i)));
    for (let k = 0; k < n && k < c.length; k++) apply(beans[c[k]], c[k]);
  };
  const B = cfg.beans;
  const single = (_b: Rec, i: number) => lots[lotOf[i]].size === 1; // lot members keep one name, roaster and roast date
  const bcnt = (rate: number, min: number) => Math.max(min, Math.round(rate * B));
  beanForce(1, (b, i) => single(b, i) && b.roastingDate !== '', (b) => { b.roastingDate = ''; });
  beanForce(bcnt(0.0136, 2), (b, i) => single(b, i) && !String(b.roastingDate).endsWith('T12:00:00.000Z') && b.roastingDate !== '', (b) => { b.roastingDate = String(b.roastingDate).replace(/\.\d{3}Z$/, 'Z'); });
  beanForce(1, () => true, (b) => { b.weight = 0; });
  beanForce(1, (b) => b.cost !== 0, (b) => { b.cost = 112; });
  beanForce(1, () => true, (b) => { b.attachments = Array.from({ length: 10 }, () => `image/${uid()}.jpg`); });
  beanForce(bcnt(0.0091, 2), single, (b) => { b.name = ' ' + b.name; });
  beanForce(1, single, (b) => { b.name = String(b.name).trimStart() + ' '; });
  beanForce(bcnt(0.0026, 1), (b) => b.aromatics !== '', (b) => { b.aromatics = `bright​ citrus, ${b.aromatics}`; });
  beanForce(1, () => true, (b) => { b.note = 'Long tasting log: ' + 'a slow sweet cup with caramel and stone fruit, '.repeat(11) + '\nSecond paragraph, brewed twice.'; });
  beanForce(1, () => true, (b) => { b.co2e_kg = undefined; });
  beanForce(1, () => true, (b) => { b.bean_information = [{}]; });
  beanForce(1, () => true, (b) => { b.bean_information = [{ country: 'Test', harvest_time: null, fob_price: null, purchasing_price: null, certification: null, percentage: null }]; });
  beanForce(1, () => true, (b) => { b.bean_information = [{ country: `${ORIGINS[0][0]} Ethiopia`, variety: '74110', harvest_time: '2024' }]; });
  beanForce(bcnt(0.0013, 1), (_b, i) => !!frozenInfo[i] && !!beans[i].frozenGroupId, (b) => { b.frozenGroupId = ''; });
  beanForce(bcnt(0.0013, 1), (b) => !b.frozenDate && !b.frozenId, (b) => { b.frozenId = hex(6); });
  let unf = 0;
  beanForce(bcnt(0.002, 2), (b) => !!b.frozenDate, (b) => {
    const d = Date.parse(String(b.frozenDate));
    b.unfrozenDate = new Date(d + (unf++ === 0 ? 0 : 60 * DAY * 1000)).toISOString();
  });
  beanForce(1, (b) => b.roast === 'CUSTOM_ROAST', (b) => { b.roast_custom = ''; });
  for (const t of ['ESPRESSO', 'OMNI', 'UNKNOWN']) beanForce(1, (b) => b.bean_roasting_type !== t, (b) => { b.bean_roasting_type = t; });
  for (const r of ['CINNAMON_ROAST', 'CITY_ROAST', 'MODERATE_LIGHT_ROAST', 'UNKNOWN']) beanForce(1, (b) => b.roast !== r, (b) => { b.roast = r; b.roast_custom = ''; });
  beanForce(1, () => true, (b) => { b.roast_range = 2.5; });
  beanForce(1, () => true, (b) => { b.ean_article_number = null; });
  beanForce(1, () => true, (b) => { b.qr_code = hex(8); });
  beanForce(1, () => true, (b) => { b.internal_share_code = hex(6); });
  beanForce(1, () => true, (b) => { b.attachments = []; });
  beanForce(1, () => true, (b) => { b.attachments = Array.from({ length: 3 }, () => `image/${uid()}.jpg`); });
  beanForce(1, single, (b) => { b.name = '🇨🇴 Hacienda Niño Alta - Café Lot'; });
  void frozenCount;

  // ---- serialize brews ----------------------------------------------------------------------------------
  const flowFiles: Record<string, string> = {};
  const families: Record<string, string> = {};
  const clock = (s: Shot, t: number) => {
    const ms = (s.ts % DAY) * 1000 + Math.round(t * 1000);
    const p = (n: number, w = 2) => String(n).padStart(w, '0');
    return `${p(Math.floor(ms / 3600000) % 24)}:${p(Math.floor(ms / 60000) % 60)}:${p(Math.floor(ms / 1000) % 60)}.${p(ms % 1000, 3)}`;
  };
  const labeler = () => {
    let sec = -1, k = 0;
    return (t: number) => {
      const s = Math.max(0, Math.floor(t));
      if (s !== sec) { sec = s; k = s === 0 ? 8 : 0; }
      return `${s}.${k++}`;
    };
  };
  const smooth = (x: number) => x * x * (3 - 2 * x);
  const pressureCurve = (fm: Family, dur: number, shotDur: number) => {
    const peak = range(fm.peak), r50 = range(fm.r50), decline = range(fm.decline), tail = range(fm.tail);
    const hs = Math.max(dur - tail, dur * 0.5);
    const preT = fm.pre ? range([5, 9]) : 0;
    const tPk = preT + 2 * r50;
    const at = (t: number): number => {
      let v: number;
      if (t < preT) v = 0.3 * peak * (0.6 + 0.4 * smooth(clamp(t / 2, 0, 1)));
      else if (t < tPk) v = fm.pre ? peak * (0.3 + 0.7 * smooth((t - preT) / (2 * r50))) : peak * smooth((t - preT) / (2 * r50));
      else v = peak * (1 - (1 - decline) * clamp((t - tPk) / Math.max(hs - tPk, 1), 0, 1));
      if (t > hs) v *= Math.pow(clamp(1 - (t - hs) / (dur - hs), 0, 1), 1.5);
      return v;
    };
    void shotDur;
    return at;
  };
  function flowFile(s: Shot | null, Y: number, dur: number, d: number, famName: string, newKeys: boolean, opts: { dip?: boolean; reset?: boolean; spike?: boolean; dropEnd?: boolean; negP?: boolean; weightless?: boolean; empty?: boolean }, id: string): string {
    const base: Rec = { weight: [], weightSecond: [], waterFlow: [], realtimeFlow: [], realtimeFlowSecond: [], pressureFlow: [], temperatureFlow: [], brewbyweight: [] };
    if (newKeys) Object.assign(base, { waterDispensed: [], waterDispensedFlowSecond: [], customMetrics: {}, customAxes: [] });
    if (opts.empty) return JSON.stringify(base);
    const sh = s ?? ({ ts: START + int(0, 300) * DAY + 70000 } as Shot);
    if (!opts.weightless) {
      const times: number[] = [];
      let t = 0;
      while (t < dur) {
        times.push(t);
        const r = f();
        t += r < 0.55 ? 0.1 : r < 0.8 ? 0.2 : r < 0.95 ? 0.3 + f() * 0.3 : r < 0.995 ? 0.6 + f() * 0.5 : 2 + f() * 4;
      }
      times.push(dur);
      if (opts.dropEnd) times.push(dur + 0.2, dur + 0.5);
      const dEff = Math.min(d || 4, dur - 1.5);
      const w = times.map((tt) => {
        if (tt > dur) return Y - (3 + f() * 30);
        let v = tt < dEff ? f() * 0.2 : Y * Math.pow(clamp((tt - dEff) / (dur - dEff), 0, 1), 1.12);
        if (opts.dip && tt < 1.2) v = -(2 + f() * 12);
        return r1(v + (tt >= dEff && tt < dur ? (f() - 0.5) * 0.1 : 0));
      });
      if (!opts.dropEnd) w[w.length - 1] = r1(Y);
      const label = labeler();
      const resetAt = opts.reset ? Math.floor(times.length * 0.4) : -1;
      const lbl = times.map((tt, k) => label(k >= resetAt && resetAt >= 0 ? Math.max(0, tt - 1.5) : tt));
      const flowAt = (k: number) => {
        const a = Math.max(0, k - 2), b = Math.min(w.length - 1, k + 2);
        return b === a ? 0 : r1(((w[b] - w[a]) / Math.max(times[b] - times[a], 0.1)));
      };
      const wt = w.map((v, k) => ({ timestamp: clock(sh as Shot, times[k]), brew_time: lbl[k], actual_weight: r1(v + (f() - 0.5) * 0.2), old_weight: r1(k ? w[k - 1] : 0),
        actual_smoothed_weight: v, old_smoothed_weight: r1(k ? w[k - 1] : 0), not_mutated_weight: r1(v + (f() - 0.5) * 0.3) }));
      base.weight = wt;
      base.waterFlow = w.slice(0, Math.max(0, w.length - 2)).map((_, k) => ({ brew_time: lbl[k], timestamp: wt[k].timestamp, value: flowAt(k) }));
      base.realtimeFlow = w.map((v, k) => ({ brew_time: lbl[k], timestamp: wt[k].timestamp, smoothed_weight: v,
        timestampdelta: k ? Math.round((times[k] - times[k - 1]) * 1000) : 0, flow_value: opts.spike && k === Math.floor(w.length / 2) ? 1997.3 : flowAt(k) }));
    }
    if (famName) {
      const fm = FAMILIES.find((x) => x.name === famName)!;
      const durP = dur + 4;
      const at = pressureCurve(fm, durP, dur);
      const label = labeler();
      const rows: Rec[] = [];
      let prev = 0;
      for (let t = 0.3, k = 0; t < durP; t += 0.14 + (f() - 0.5) * 0.04, k++) {
        const v = r2(Math.max(0, at(t) + (f() - 0.5) * 0.08));
        rows.push({ timestamp: clock(sh as Shot, t), brew_time: label(t), actual_pressure: v, old_pressure: prev });
        prev = v;
      }
      if (opts.negP) rows[rows.length - 1].actual_pressure = -0.3;
      base.pressureFlow = rows;
      families[id] = famName;
    }
    return JSON.stringify(base);
  }
  const newKeysAfter = START + cfg.days * 0.81 * DAY;
  for (const s of shots) {
    if (!s.flow) continue;
    const Y = s.esp ? (s.yield > 0 ? s.yield : Math.round((s.dose || 18) * 3)) : s.waterIn;
    const dur = s.dur > 0 ? s.dur : s.brewTime > 0 ? s.brewTime : timeBucket();
    flowFiles[`${s.uuid}_flow_profile.json`] = flowFile(s, Y, dur, s.esp ? s.drip || 5 : 3, s.pressure ? s.family : '', s.ts >= newKeysAfter,
      { dip: s.dip, reset: s.reset, spike: s.spike, dropEnd: s.dropEnd, negP: s.negP }, s.uuid);
  }
  // orphan flow files: no brew; one with every array empty, one with pressure only
  const orphanN = cnt(0.0065, 3);
  for (let k = 0; k < orphanN; k++) {
    const id = uid();
    flowFiles[`${id}_flow_profile.json`] = flowFile(null, r1(range([30, 65])), range([14, 30]), 4, k === 1 ? 'low-steady' : '', k % 2 === 0,
      k === 0 ? { empty: true } : k === 1 ? { weightless: true } : {}, id);
  }
  const visualizerShared = (s: Shot) => (chance(0.5) ? s.uuid : uid());
  const brewObj = (s: Shot): Rec => ({
    grind_size: s.grind, grind_weight: s.dose, method_of_preparation: mByKey.get(s.mkey)!.uuid, mill: gById.get(s.mill)!.uuid, mill_speed: s.speed,
    mill_timer: 0, pressure_profile: s.profile, bean: beanUuids[s.bean], brew_temperature_time: 0, brew_temperature: s.temp, brew_time: s.brewTime,
    brew_quantity: s.waterIn, brew_quantity_type: 'GR', note: s.note, rating: s.rating, coffee_type: s.coffeeType, coffee_concentration: '',
    coffee_first_drip_time: s.drip, coffee_blooming_time: s.bloom, attachments: s.att, config: { uuid: s.uuid, unix_timestamp: s.ts }, tds: s.tds,
    brew_beverage_quantity: s.yield, brew_beverage_quantity_type: 'GR', mill_timer_milliseconds: 0, brew_time_milliseconds: 0,
    brew_temperature_time_milliseconds: 0, coffee_first_drip_time_milliseconds: 0, coffee_blooming_time_milliseconds: 0,
    coordinates: { accuracy: null, altitude: null, altitudeAccuracy: null, heading: null, latitude: null, longitude: null, speed: null },
    cupping: cupping(), cupped_flavor: { predefined_flavors: s.flavors, custom_flavors: [] }, method_of_preparation_tools: s.tools,
    bean_weight_in: 0, favourite: s.favourite, best_brew: false, water: s.waterId, vessel_name: s.vessel[0], vessel_weight: s.vessel[1],
    flow_profile: s.flow ? `brews/${uid()}_flow_profile.json` : '', reference_flow_profile: { type: 'NONE', uuid: '' }, preparationDeviceBrew: { type: 'NONE' },
    customInformation: { visualizer_id: s.flow ? visualizerShared(s) : '' }
  });
  const toolObj = (t: { name: string; uuid: string; ts: number }) => ({ name: t.name, config: { uuid: t.uuid, unix_timestamp: t.ts }, archived: false });
  const flags = (names: string[], v: boolean) => Object.fromEntries(names.map((n) => [n, v]));
  const PARAMS = ['bean_type', 'brew_time', 'grind_size', 'grind_weight', 'mill', 'method_of_preparation', 'brew_quantity', 'brew_temperature', 'note',
    'coffee_type', 'coffee_first_drip_time', 'coffee_blooming_time', 'rating', 'mill_speed', 'pressure_profile', 'tds', 'brew_beverage_quantity',
    'method_of_preparation_tool', 'water'];
  const prepObj = (m: (typeof methods)[number]): Rec => ({
    name: m.name, note: '', config: { uuid: m.uuid, unix_timestamp: gearTs + 3600 }, type: m.type, style_type: m.style, finished: false,
    use_custom_parameters: m.type === 'CUSTOM_PREPARATION', manage_parameters: { ...flags(PARAMS, true), set_last_coffee_brew: false, attachments: [] },
    default_last_coffee_parameters: flags(PARAMS, true), visible_list_view_parameters: flags(PARAMS, true), repeat_coffee_parameters: { ...flags(PARAMS, true), repeat_coffee_active: false },
    brew_order: { before: Object.fromEntries(PARAMS.slice(0, 8).map((p, k) => [p, k + 1])), while: { brew_time: 1, coffee_first_drip_time: 2 },
      after: { rating: 1, note: 2, attachments: [] } },
    tools: m.tools.map(toolObj), attachments: m.key === 'e6' ? [`image/${uid()}.jpg`] : [],
    connectedPreparationDevice: { type: 'NONE', url: '', customParams: {} }
  });
  const sorted = shots.slice().sort((a, b) => a.ts - b.ts || a.i - b.i);
  const brewRecs = sorted.map(brewObj);
  const sortedBeans = beans.map((b, k) => ({ b, k })).sort((a, c) => (a.b.config as { unix_timestamp: number }).unix_timestamp - (c.b.config as { unix_timestamp: number }).unix_timestamp).map((x) => x.b);
  const chunk = <T,>(a: T[]) => { const out: T[][] = []; for (let i = cfg.cap; i < a.length; i += cfg.cap) out.push(a.slice(i, i + cfg.cap)); return out; };
  // out-of-order timestamps inside a file (set after the split, so the oldest-first split above stays chronological)
  const rolled = brewRecs.slice(cfg.cap);
  const beanRoast = (r: Rec) => Date.parse(String(beans[beanUuids.indexOf(r.bean as string)].roastingDate)) / 1000 || 0;
  shuffle(rolled.map((_, k) => k).filter((k) => k > 3)).slice(0, cnt(0.01, 3)).forEach((k, n) => {
    const r = rolled[k], c = r.config as { unix_timestamp: number };
    const shift = n === 0 ? 124 * DAY : n === 1 ? 36 * 3600 : int(78, 3000) * 60;
    c.unix_timestamp = Math.max(c.unix_timestamp - shift, Math.ceil(beanRoast(r) + 3.5 * DAY));
    const before = (rolled[k - 1].config as { unix_timestamp: number }).unix_timestamp;
    if (c.unix_timestamp >= before) c.unix_timestamp = before - 4800;
  });
  // two duplicate timestamps
  shuffle(rolled.map((_, k) => k).filter((k) => k > 3)).slice(0, cnt(0.001, 2)).forEach((k) => {
    (rolled[k].config as { unix_timestamp: number }).unix_timestamp = (rolled[k - 1].config as { unix_timestamp: number }).unix_timestamp;
  });
  const mainFile = {
    BEANS: sortedBeans.slice(0, cfg.cap), BREWS: brewRecs.slice(0, cfg.cap), GRAPH: [], GREEN_BEANS: [],
    MILL: grinders.map((g) => ({ name: g.name, note: '', config: { uuid: g.uuid, unix_timestamp: gearTs + 7200 }, finished: g.finished, attachments: [] })),
    PREPARATION: methods.map(prepObj),
    ROASTING_MACHINES: [],
    SETTINGS: [{ brew_rating: 5, brew_rating_steps: 0.5, bean_rating: 5, bean_rating_steps: 0.25, brew_milliseconds: false, language: 'en', currency: 'USD',
      track_brew_coordinates: false, brew_timer_show_milliseconds: false, scale_connected: true }],
    VERSION: [{ alreadyDisplayedVersions: ['8.6.0', '8.7.0', '8.8.0'], updatedDataVersions: Array.from({ length: 15 }, (_, k) => `UPDATE_${k + 1}`),
      config: cfgOf(START - 60 * DAY) }],
    WATER: water
  };
  const zipFiles: Record<string, string> = { 'Beanconqueror.json': JSON.stringify(mainFile) };
  chunk(brewRecs).forEach((c, k) => { zipFiles[`Beanconqueror_Brews_${k + 1}.json`] = JSON.stringify(c); });
  chunk(sortedBeans).forEach((c, k) => { zipFiles[`Beanconqueror_Beans_${k + 1}.json`] = JSON.stringify(c); });
  return { zipFiles, flowFiles, families };
}
