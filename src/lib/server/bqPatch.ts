// One-time tool: rewrites only the BEANS key of a Bean Conqueror export (see scripts/bq-patch.ts).
import { COFFEE_ORIGIN_FIELDS } from '../types.ts';
import { coffeeBeanUuid } from './bqBeanUuid.ts';
import { BC_TIME_ZONE, bcRoastDate, bcTimestamp } from './beanConquerorJson.ts';
export type BeanOriginPatch = Partial<
  Record<
    | 'country'
    | 'processing'
    | 'farm'
    | 'farmer'
    | 'variety'
    | 'region'
    | 'elevation'
    | 'harvest_time'
    | 'certification',
    string
  >
>;
export type BeanPatch = {
  uuid: string;
  set?: Record<string, unknown>;
  origin?: BeanOriginPatch;
  photo?: string;
};
export type PatchPlan = { beans: BeanPatch[]; newBeans: Record<string, unknown>[] };
export type BeanChange = { uuid: string; name: string; field: string; from: unknown; to: unknown };

export const PATCHABLE_FIELDS: readonly string[] = [
  'url', 'attachments', 'name', 'roastingDate', 'roast_range', 'weight', 'cost',
  'decaffeinated', 'finished', 'frozenDate', 'unfrozenDate'
];

type Rec = Record<string, unknown>;
const uuidOf = (e: unknown) => ((e as Rec)?.config as Rec | undefined)?.uuid as string | undefined;
const blank = (v: unknown) => v === '' || v === null || v === undefined;
const emptyAttachments = (v: unknown) => !Array.isArray(v) || v.length === 0;

export function applyPatchPlan(
  main: Rec,
  plan: PatchPlan,
  photoNames: Record<string, string> = {}
): { main: Rec; changes: BeanChange[] } {
  const beans = structuredClone(main.BEANS as Rec[]);
  const byUuid = new Map(beans.map((b) => [uuidOf(b), b]));
  const changes: BeanChange[] = [];
  const write = (bean: Rec, target: Rec, key: string, to: unknown, field = key) => {
    if (blank(to) || JSON.stringify(target[key]) === JSON.stringify(to)) return;
    changes.push({ uuid: uuidOf(bean)!, name: String(bean.name), field, from: target[key], to });
    target[key] = to;
  };

  for (const p of plan.beans) {
    const bean = byUuid.get(p.uuid);
    if (!bean) throw new Error(`Unknown bean uuid ${p.uuid}`);
    for (const [k, v] of Object.entries(p.set ?? {})) {
      if (!PATCHABLE_FIELDS.includes(k)) throw new Error(`Field ${k} is not patchable`);
      if (k === 'attachments' && !emptyAttachments(bean[k])) continue;
      write(bean, bean, k, v);
    }
    if (p.photo !== undefined && emptyAttachments(bean.attachments) && photoNames[p.uuid]) {
      write(bean, bean, 'attachments', [photoNames[p.uuid]]);
    }
    const origin = Object.entries(p.origin ?? {}).filter(([, v]) => !blank(v));
    if (origin.length) {
      if (!Array.isArray(bean.bean_information)) bean.bean_information = [];
      const info = bean.bean_information as Rec[];
      if (!info.length) info.push({});
      for (const [k, v] of origin) write(bean, info[0], k, v, `bean_information[0].${k}`);
    }
  }

  for (const nb of plan.newBeans) {
    const u = uuidOf(nb);
    if (!u || byUuid.has(u)) throw new Error(`New bean uuid ${u} missing or already exists`);
    byUuid.set(u, nb);
    beans.push(structuredClone(nb));
  }
  return { main: { ...main, BEANS: beans }, changes };
}

const canon = (v: unknown): string =>
  JSON.stringify(v, (_k, x) =>
    x && typeof x === 'object' && !Array.isArray(x)
      ? Object.fromEntries(Object.entries(x).sort(([a], [b]) => (a < b ? -1 : 1)))
      : x
  );

// Differences per entry (by config.uuid) for the keys a bean patch must not change.
export function comparePatched(expected: Rec, actual: Rec): string[] {
  const out: string[] = [];
  for (const key of ['BEANS', 'BREWS', 'MILL', 'PREPARATION', 'WATER']) {
    const entries = (arr: unknown) =>
      ((arr as unknown[]) ?? []).map((e, i): [string, unknown] => [uuidOf(e) ?? `#${i}`, e]);
    const exp = new Map(entries(expected[key]));
    const act = new Map(entries(actual[key]));
    for (const [side, arr] of [['expected', expected], ['actual', actual]] as const) {
      const seen = new Set<string>();
      for (const [u] of entries(arr[key])) {
        if (seen.has(u)) out.push(`${key} ${u}: duplicate in ${side}`);
        seen.add(u);
      }
    }
    const [n, na] = [expected[key], actual[key]].map((x) => ((x as unknown[]) ?? []).length);
    if (n !== na) out.push(`${key}: count ${n} expected, ${na} actual`);
    for (const [u, e] of exp) {
      if (!act.has(u)) out.push(`${key} ${u}: missing in actual`);
      else if (canon(e) !== canon(act.get(u))) out.push(`${key} ${u}: differs`);
    }
    for (const u of act.keys()) if (!exp.has(u)) out.push(`${key} ${u}: unexpected in actual`);
  }
  return out;
}

// ---- Building the plan from the site (Task 8) ----

export type PatchCoffee = {
  id: number;
  roaster: string;
  coffee_name: string;
  product_url: string | null;
  roast_date: string | null;
  roast_level: string | null;
  degrees_of_roast: number | null; // from roast_levels for this coffee's roast_level
  amount_g: number | null;
  cost: number | null;
  decaf: number | null;
  status: string;
  frozen_start_date: string | null;
  frozen_end_date: string | null;
  origin: string | null;
  processing: string | null;
  producer: string | null;
  farm: string | null;
  variety: string | null;
  region: string | null;
  elevation: string | null;
  harvest_time: string | null;
  certification: string | null;
  bean_uuid: string | null; // linked beanconqueror_beans.id
  photo: string | null; // local file of the coffee's own image, or null
};

// Bean defaults from Bean Conqueror v8.7.0, src/classes/bean/bean.ts (Bean constructor).
// Enum values are the stored keys, as in an export ('FILTER', 'SINGLE_ORIGIN', 'BLEND').
export const NEW_BEAN_TEMPLATE: Record<string, unknown> = {
  name: '', buyDate: '', roastingDate: '', note: '', roaster: '', config: {},
  roast: 'UNKNOWN', roast_range: 0, roast_custom: '', beanMix: 'SINGLE_ORIGIN', aromatics: '',
  weight: 0, finished: false, cost: 0, attachments: [], decaffeinated: false, cupping_points: '',
  bean_roasting_type: 'UNKNOWN', bean_information: [], url: '', ean_article_number: '',
  bean_roast_information: {
    drop_temperature: 0, roast_length: 0, roaster_machine: '', green_bean_weight: 0,
    outside_temperature: 0, humidity: 0, bean_uuid: '', first_crack_minute: 0,
    first_crack_temperature: 0, second_crack_minute: 0, second_crack_temperature: 0
  },
  rating: 0, qr_code: '', internal_share_code: '', favourite: false, shared: false,
  cupping: {
    body: 0, brightness: 0, clean_cup: 0, complexity: 0, cuppers_correction: 0, dry_fragrance: 0,
    finish: 0, flavor: 0, sweetness: 0, uniformity: 0, wet_aroma: 0, notes: ''
  },
  cupped_flavor: { predefined_flavors: {}, custom_flavors: [] },
  frozenDate: '', unfrozenDate: '', frozenId: '', frozenGroupId: '', frozenStorageType: 'UNKNOWN',
  frozenNote: '', bestDate: '', openDate: '', co2e_kg: 0
};

// The instant at local midnight of a 'YYYY-MM-DD' date in BC_TIME_ZONE, as BQ stores dates.
export function bqDateFromLocal(date: string): string {
  const guess = Date.parse(`${date}T00:00:00.000Z`);
  if (Number.isNaN(guess)) throw new Error(`Bad date ${date}`);
  const offsetAt = (ms: number) => Date.parse(bcTimestamp(ms / 1000)) - ms;
  const first = guess - offsetAt(guess);
  return new Date(guess - offsetAt(first)).toISOString();
}

type Kind = 'str' | 'num' | 'bool' | 'date';
// keep = site field name (keep.json uses these); key = BQ bean key.
const FIELDS: { keep: string; key: string; kind: Kind; get: (c: PatchCoffee) => unknown }[] = [
  { keep: 'coffee_name', key: 'name', kind: 'str', get: (c) => c.coffee_name },
  { keep: 'product_url', key: 'url', kind: 'str', get: (c) => c.product_url },
  { keep: 'roast_date', key: 'roastingDate', kind: 'date', get: (c) => c.roast_date },
  { keep: 'roast_level', key: 'roast_range', kind: 'num', get: (c) => c.degrees_of_roast },
  { keep: 'amount_g', key: 'weight', kind: 'num', get: (c) => c.amount_g },
  { keep: 'cost', key: 'cost', kind: 'num', get: (c) => c.cost },
  { keep: 'decaf', key: 'decaffeinated', kind: 'bool', get: (c) => (c.decaf == null ? null : c.decaf === 1) },
  { keep: 'status', key: 'finished', kind: 'bool', get: (c) => c.status === 'archive' },
  { keep: 'frozen_start_date', key: 'frozenDate', kind: 'date', get: (c) => c.frozen_start_date },
  { keep: 'frozen_end_date', key: 'unfrozenDate', kind: 'date', get: (c) => c.frozen_end_date }
];
// Site origin field -> bean_information[0] key.
const ORIGIN: [string, keyof BeanOriginPatch][] = [
  ['origin', 'country'], ['processing', 'processing'], ['producer', 'farmer'],
  ...COFFEE_ORIGIN_FIELDS.filter((f) => f !== 'producer').map((f): [string, keyof BeanOriginPatch] => [f, f])
];

const same = (kind: Kind, site: unknown, bq: unknown): boolean => {
  if (kind === 'num') return typeof bq === 'number' && Math.abs((site as number) - bq) < 0.005;
  if (kind === 'date') return bcRoastDate(bq) === site;
  if (kind === 'bool') return (bq === true) === site;
  return String(bq ?? '').trim() === String(site).trim();
};
const fieldValue = (kind: Kind, v: unknown) => (kind === 'date' ? bqDateFromLocal(v as string) : v);

export function buildPatchPlan(
  coffees: PatchCoffee[],
  main: Rec,
  keep: Record<string, string[]>
): { plan: PatchPlan; unexpected: string[]; untouchedBeans: string[] } {
  const bqBeans = new Map((main.BEANS as Rec[]).map((b) => [uuidOf(b)!, b]));
  const unexpected: string[] = [];
  const plan: PatchPlan = { beans: [], newBeans: [] };
  const linked = new Set<string>();
  const now = Math.floor(Date.now() / 1000);

  for (const c of coffees) {
    const label = `coffee ${c.id}`;
    if (c.roast_level && c.degrees_of_roast == null) unexpected.push(`${label}: roast level has no degree`);
    const skip = new Set(keep[String(c.id)] ?? []);
    const usable = FIELDS.filter((f) => !skip.has(f.keep) && !blank(f.get(c)));
    const originFields = ORIGIN.filter(([site]) => !skip.has(site) && !blank(c[site as keyof PatchCoffee]));

    if (c.bean_uuid) {
      if (linked.has(c.bean_uuid)) unexpected.push(`${label}: bean ${c.bean_uuid} is linked twice`);
      linked.add(c.bean_uuid);
      const bean = bqBeans.get(c.bean_uuid);
      if (!bean) {
        unexpected.push(`${label}: linked bean ${c.bean_uuid} is not in the export`);
        continue;
      }
      const set: Rec = {};
      for (const f of usable) {
        const v = f.get(c);
        if (!same(f.kind, v, bean[f.key])) set[f.key] = fieldValue(f.kind, v);
      }
      const info = ((bean.bean_information as Rec[]) ?? [])[0] ?? {};
      const origin: BeanOriginPatch = {};
      for (const [site, key] of originFields) {
        const v = c[site as keyof PatchCoffee] as string;
        if (String(info[key] ?? '').trim() !== v.trim()) origin[key] = v;
      }
      const p: BeanPatch = { uuid: c.bean_uuid };
      if (Object.keys(set).length) p.set = set;
      if (Object.keys(origin).length) p.origin = origin;
      if (c.photo) p.photo = c.photo;
      if (p.set || p.origin || p.photo) plan.beans.push(p);
      continue;
    }

    const uuid = coffeeBeanUuid(c.id);
    if (bqBeans.has(uuid)) {
      unexpected.push(`${label}: derived bean uuid ${uuid} is already in the export`);
      continue;
    }
    const bean = structuredClone(NEW_BEAN_TEMPLATE);
    bean.config = { uuid, unix_timestamp: now };
    bean.roaster = c.roaster;
    bean.bean_roasting_type = 'FILTER';
    bean.beanMix = /blend/i.test(c.coffee_name) ? 'BLEND' : 'SINGLE_ORIGIN';
    // every FIELDS value, keep or not: a new bean has nothing to protect
    for (const f of FIELDS) if (!blank(f.get(c))) bean[f.key] = fieldValue(f.kind, f.get(c));
    const info: Rec = {};
    for (const [site, key] of ORIGIN) if (!blank(c[site as keyof PatchCoffee])) info[key] = c[site as keyof PatchCoffee];
    if (Object.keys(info).length) bean.bean_information = [info];
    plan.newBeans.push(bean);
  }

  const untouchedBeans = [...bqBeans.keys()].filter((u) => !linked.has(u));
  return { plan, unexpected, untouchedBeans };
}
