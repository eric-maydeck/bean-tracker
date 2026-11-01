// One-time tool: rewrites only the BEANS key of a Bean Conqueror export (see scripts/bq-patch.ts).
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
    const index = (arr: unknown) =>
      new Map(((arr as unknown[]) ?? []).map((e, i) => [uuidOf(e) ?? `#${i}`, e]));
    const exp = index(expected[key]);
    const act = index(actual[key]);
    for (const [u, e] of exp) {
      if (!act.has(u)) out.push(`${key} ${u}: missing in actual`);
      else if (canon(e) !== canon(act.get(u))) out.push(`${key} ${u}: differs`);
    }
    for (const u of act.keys()) if (!exp.has(u)) out.push(`${key} ${u}: unexpected in actual`);
  }
  return out;
}
