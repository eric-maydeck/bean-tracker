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
  'decaffeinated', 'finished', 'frozenDate', 'unfrozenDate', 'beanMix', 'aromatics'
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

/** Sets `mill_speed` on unset brews from a reviewed uuid -> speed map (in place). Refuses a brew that already has one. */
export function setBrewSpeeds(brews: Rec[], speeds: Record<string, number>): BeanChange[] {
  const changes: BeanChange[] = [];
  for (const b of brews) {
    const u = uuidOf(b);
    const to = u === undefined ? undefined : speeds[u];
    if (to === undefined) continue;
    if (b.mill_speed) throw new Error(`Brew ${u} already has mill_speed ${b.mill_speed}`);
    changes.push({ uuid: u!, name: 'brew', field: 'mill_speed', from: b.mill_speed, to });
    b.mill_speed = to;
  }
  return changes;
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
  blend: number; // 1 = BLEND, 0 = SINGLE_ORIGIN
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
  tasting_notes: string | null;
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
// fillOnly: only written into a blank BQ value, never over one.
// settledFree: the site is authoritative, so overwriting a filled BQ value needs no settled/keep.
const FIELDS: { keep: string; key: string; kind: Kind; get: (c: PatchCoffee) => unknown; settledFree?: true; fillOnly?: true }[] = [
  { keep: 'coffee_name', key: 'name', kind: 'str', get: (c) => c.coffee_name },
  { keep: 'product_url', key: 'url', kind: 'str', get: (c) => c.product_url },
  { keep: 'roast_date', key: 'roastingDate', kind: 'date', get: (c) => c.roast_date },
  { keep: 'roast_level', key: 'roast_range', kind: 'num', get: (c) => c.degrees_of_roast },
  { keep: 'amount_g', key: 'weight', kind: 'num', get: (c) => c.amount_g },
  { keep: 'cost', key: 'cost', kind: 'num', get: (c) => c.cost },
  { keep: 'decaf', key: 'decaffeinated', kind: 'bool', get: (c) => (c.decaf == null ? null : c.decaf === 1) },
  { keep: 'blend', key: 'beanMix', kind: 'str', settledFree: true, get: (c) => (c.blend === 1 ? 'BLEND' : 'SINGLE_ORIGIN') },
  // BQ's Flavour profile; ponytail: plain comma string until BQ's hand-entered format is confirmed (change only here)
  { keep: 'tasting_notes', key: 'aromatics', kind: 'str', fillOnly: true, get: (c) => c.tasting_notes },
  { keep: 'status', key: 'finished', kind: 'bool', get: (c) => c.status === 'archive' },
  { keep: 'frozen_start_date', key: 'frozenDate', kind: 'date', get: (c) => c.frozen_start_date },
  { keep: 'frozen_end_date', key: 'unfrozenDate', kind: 'date', get: (c) => c.frozen_end_date }
];
// Site origin field -> bean_information[0] key.
const ORIGIN: [string, keyof BeanOriginPatch][] = [
  ['origin', 'country'], ['processing', 'processing'], ['producer', 'farmer'],
  ...COFFEE_ORIGIN_FIELDS.filter((f) => f !== 'producer' && f !== 'tasting_notes').map((f): [string, keyof BeanOriginPatch] => [f, f])
];

// A BQ value that is only the Bean constructor's default counts as blank.
const bqBlank = (v: unknown) => blank(v) || v === 0 || v === false;
const normName = (v: unknown) => String(v ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');

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
  keep: Record<string, string[]>,
  settled: Iterable<string> = []
): { plan: PatchPlan; unexpected: string[]; untouchedBeans: string[] } {
  const bqBeans = new Map((main.BEANS as Rec[]).map((b) => [uuidOf(b)!, b]));
  const settledKeys = new Set(settled);
  const unexpected: string[] = [];
  const plan: PatchPlan = { beans: [], newBeans: [] };
  const linked = new Set<string>();
  const newFor: PatchCoffee[] = [];
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
      // Overwriting a value BQ already has needs a review decision (settled) or a keep.
      const guard = (site: string, bq: unknown) => {
        if (!bqBlank(bq) && !settledKeys.has(`${c.id}:${site}`)) {
          unexpected.push(`${label}: ${site} overwrites a Bean Conqueror value that is not settled`);
        }
      };
      const set: Rec = {};
      for (const f of usable) {
        const v = f.get(c);
        if (same(f.kind, v, bean[f.key])) continue;
        if (f.fillOnly && !bqBlank(bean[f.key])) continue;
        if (!f.settledFree) guard(f.keep, bean[f.key]);
        set[f.key] = fieldValue(f.kind, v);
      }
      const info = ((bean.bean_information as Rec[]) ?? [])[0] ?? {};
      const origin: BeanOriginPatch = {};
      for (const [site, key] of originFields) {
        const v = c[site as keyof PatchCoffee] as string;
        if (String(info[key] ?? '').trim() === v.trim()) continue;
        guard(site, info[key]);
        origin[key] = v;
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
    newFor.push(c);
    const bean = structuredClone(NEW_BEAN_TEMPLATE);
    bean.config = { uuid, unix_timestamp: now };
    bean.roaster = c.roaster;
    bean.bean_roasting_type = 'FILTER';
    // every FIELDS value, keep or not: a new bean has nothing to protect
    for (const f of FIELDS) if (!blank(f.get(c))) bean[f.key] = fieldValue(f.kind, f.get(c));
    const info: Rec = {};
    for (const [site, key] of ORIGIN) if (!blank(c[site as keyof PatchCoffee])) info[key] = c[site as keyof PatchCoffee];
    if (Object.keys(info).length) bean.bean_information = [info];
    plan.newBeans.push(bean);
  }

  const untouchedBeans = [...bqBeans.keys()].filter((u) => !linked.has(u));
  // A new bean next to an unlinked export bean of the same roaster and name is likely a duplicate.
  // Unknown (null) roast dates match anything; two known dates must be equal.
  for (const c of newFor) {
    for (const u of untouchedBeans) {
      const b = bqBeans.get(u)!;
      const d = bcRoastDate(b.roastingDate);
      if (normName(b.roaster) === normName(c.roaster) && normName(b.name) === normName(c.coffee_name)
        && (d === null || c.roast_date === null || d === c.roast_date)) {
        unexpected.push(`coffee ${c.id}: new bean would duplicate unlinked export bean ${u}`);
      }
    }
  }
  return { plan, unexpected, untouchedBeans };
}

// ---- Filters as tools (#184): one method per dripper, the filter ticked on each brew ----

export interface ToolPlan {
  methodRenames?: Record<string, string>; // old method name -> new, applied first
  drippers: Record<string, string>; // old dripper -> target method name (after renames)
  filters?: Record<string, string>; // old filter -> tool name
  // methods converted in place, keyed by method name; byDate.before = local wall time YYYY-MM-DDTHH:mm, earliest
  // first, brews at or after the last one get `tool`
  assign?: Record<string, { tool?: string; byDate?: { before: string; tool: string }[] }>;
  overrides?: Record<string, string>; // brew uuid -> tool name, applied last
}
export type ToolReport = { converted: number; untouched: number; dropped: string[]; problems: string[] };

const toolKey = (s: unknown) => String(s ?? '').trim().toLowerCase().replace(/ filters$/, '');
const toolsOf = (m: Rec) => (m.tools as Rec[]) ?? [];
const ticksOf = (b: Rec) => (Array.isArray(b.method_of_preparation_tools) ? b.method_of_preparation_tools : []);
const wallOf = (b: Rec) => bcTimestamp(Number((b.config as Rec).unix_timestamp)).slice(0, 16);

// The site's pairing rule as of 2026-11-24 (parseMethod in insights/facts.ts, minus the Gabi hardcode, which `assign`
// covers). Copied, not imported: facts.ts pulls in extensionless imports that plain `node scripts/*.ts` cannot load,
// and the conversion must keep reading old names this way after the site's rule changes (#184).
function parseMethod(name: string, tools: string): { dripper: string; filter: string | null } {
  const i = name.indexOf(' - ');
  if (i >= 0) return { dripper: name.slice(0, i).trim(), filter: name.slice(i + 3).trim() || null };
  return { dripper: name.trim(), filter: tools.replace(/ filters$/i, '').trim() || null };
}

// Where a brew belongs under the plan: target method name and tool name (either may be missing).
function wanted(b: Rec, origMethods: Map<unknown, Rec>, plan: ToolPlan): { method?: string; tool?: string; err?: string } {
  const om = origMethods.get(b.method_of_preparation);
  if (!om) return { err: `brew ${uuidOf(b)}: method ${b.method_of_preparation} not in PREPARATION` };
  const old = String(om.name);
  const cur = plan.methodRenames?.[old] ?? old;
  const over = plan.overrides?.[uuidOf(b)!];
  if (ticksOf(b).length) return { method: cur, tool: over }; // already ticked: left alone unless overridden
  const e = plan.assign?.[cur];
  if (e) return { method: cur, tool: over ?? e.byDate?.find((d) => wallOf(b) < d.before)?.tool ?? e.tool };
  const { dripper, filter } = parseMethod(old, toolsOf(om).map((t) => t.name).join(', '));
  const method = plan.drippers[dripper];
  if (!method) return { err: `brew ${uuidOf(b)}: no target method for dripper ${dripper} (${old})` };
  return { method, tool: over ?? (filter ? plan.filters?.[filter] ?? filter : undefined) };
}

/** Moves each unticked brew to its dripper's method with its filter ticked, then drops methods no brew uses any more. */
export function convertToTools(
  main: Rec,
  brewFiles: Rec[][],
  plan: ToolPlan
): { main: Rec; brewFiles: Rec[][]; report: ToolReport } {
  const out = structuredClone(main);
  const files = structuredClone(brewFiles);
  const brews = [out.BREWS as Rec[], ...files].flat();
  const methods = out.PREPARATION as Rec[];
  const origMethods = new Map(methods.map((m) => [uuidOf(m), structuredClone(m)]));
  const usedMethods = () => new Set(brews.map((b) => b.method_of_preparation));
  const before = usedMethods();
  const problems: string[] = [];
  for (const m of methods) m.name = plan.methodRenames?.[String(m.name)] ?? m.name;
  const byName = (n: string) => methods.filter((m) => m.name === n);
  for (const n of new Set([...Object.values(plan.drippers), ...Object.keys(plan.assign ?? {})])) {
    if (byName(n).length !== 1) problems.push(`method "${n}": ${byName(n).length} found, need exactly 1`);
  }
  const brewIds = new Set(brews.map(uuidOf));
  for (const u of Object.keys(plan.overrides ?? {})) if (!brewIds.has(u)) problems.push(`override ${u}: no such brew`);
  for (const [n, e] of Object.entries(plan.assign ?? {})) {
    const bs = e.byDate?.map((d) => d.before) ?? [];
    if (bs.some((x, i) => i && x <= bs[i - 1])) problems.push(`assign "${n}": byDate must be in ascending order`);
  }

  const changed = new Set<unknown>();
  let untouched = 0;
  for (const b of brews) {
    const w = wanted(b, origMethods, plan);
    if (w.err) { problems.push(w.err); continue; }
    if (!w.tool && ticksOf(b).length) { untouched++; continue; }
    const m = byName(w.method!)[0];
    const tool = m && toolsOf(m).find((t) => toolKey(t.name) === toolKey(w.tool));
    if (!tool) { problems.push(`brew ${uuidOf(b)}: method "${w.method}" has no tool "${w.tool}"`); continue; }
    b.method_of_preparation = uuidOf(m);
    b.method_of_preparation_tools = [uuidOf(tool)];
    changed.add(uuidOf(b));
  }

  const after = usedMethods();
  const gone = methods.filter((m) => before.has(uuidOf(m)) && !after.has(uuidOf(m)));
  out.PREPARATION = methods.filter((m) => !gone.includes(m));
  const rest = JSON.stringify([out, files]);
  for (const m of gone) if (rest.includes(uuidOf(m)!)) problems.push(`dropped method "${m.name}" ${uuidOf(m)} is still referenced`);

  const report = { converted: changed.size, untouched, dropped: gone.map((m) => String(m.name)), problems };
  return problems.length ? { main, brewFiles, report } : { main: out, brewFiles: files, report };
}

/** Failures (empty = pass) of a converted export against the original under the plan. */
export function verifyTools(origMain: Rec, origBrews: Rec[][], newMain: Rec, newBrews: Rec[][], plan: ToolPlan): string[] {
  const fails: string[] = [];
  const ob = [origMain.BREWS as Rec[], ...origBrews].flat();
  const nb = [newMain.BREWS as Rec[], ...newBrews].flat();
  const newByUuid = new Map(nb.map((b) => [uuidOf(b), b]));
  if (ob.length !== nb.length || newByUuid.size !== nb.length || ob.some((b) => !newByUuid.has(uuidOf(b)))) {
    fails.push(`brews: ${ob.length} expected, ${nb.length} actual, or uuids differ`);
  }
  const origMethods = new Map((origMain.PREPARATION as Rec[]).map((m) => [uuidOf(m), m]));
  const newMethods = new Map((newMain.PREPARATION as Rec[]).map((m) => [uuidOf(m), m]));
  const strip = ({ method_of_preparation: _m, method_of_preparation_tools: _t, ...r }: Rec) => canon(r);
  for (const o of ob) {
    const u = uuidOf(o);
    const n = newByUuid.get(u);
    if (!n) continue;
    if (strip(o) !== strip(n)) fails.push(`brew ${u}: a field other than method and ticks changed`);
    const m = newMethods.get(n.method_of_preparation as string);
    const ticks = ticksOf(n);
    const tool = ticks.length === 1 ? toolsOf(m ?? {}).find((t) => uuidOf(t) === ticks[0]) : undefined;
    if (!m || !tool) { fails.push(`brew ${u}: ${ticks.length} ticks, need exactly 1 of its own method's tools`); continue; }
    const w = wanted(o, origMethods, plan);
    if (w.err) { fails.push(w.err); continue; }
    if (!w.tool && ticksOf(o).length) {
      if (canon([o.method_of_preparation, ticksOf(o)]) !== canon([n.method_of_preparation, ticks])) fails.push(`brew ${u}: a ticked brew was changed`);
    } else if (m.name !== w.method || toolKey(tool.name) !== toolKey(w.tool)) {
      fails.push(`brew ${u}: is ${m.name} / ${tool.name}, expected ${w.method} / ${w.tool}`);
    }
  }
  const used = new Set(nb.map((b) => b.method_of_preparation));
  const origUsed = new Set(ob.map((b) => b.method_of_preparation));
  for (const [id, m] of newMethods) {
    const o = origMethods.get(id);
    if (!o) fails.push(`method ${id}: not in the original`);
    else if (canon({ ...o, name: plan.methodRenames?.[String(o.name)] ?? o.name }) !== canon(m)) fails.push(`method "${m.name}": changed beyond a planned rename`);
    if (origUsed.has(id) && !used.has(id)) fails.push(`method "${m.name}": no brew uses it any more, drop it`);
  }
  const everything = JSON.stringify([newMain, newBrews]);
  for (const [id, m] of origMethods) {
    if (!newMethods.has(id) && everything.includes(id as string)) fails.push(`dropped method "${m.name}" is still referenced`);
  }
  for (const k of Object.keys({ ...origMain, ...newMain }).filter((k) => k !== 'BREWS' && k !== 'PREPARATION')) {
    if (canon(origMain[k]) !== canon(newMain[k])) fails.push(`key ${k}: differs`);
  }
  return fails;
}
