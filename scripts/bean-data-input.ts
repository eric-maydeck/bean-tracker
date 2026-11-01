// Input for the bean data backfill (spec docs/superpowers/specs/2026-11-01-bean-data-and-bq-patch-design.md,
// part 4). Reads a DB COPY and a BQ export, writes <out>/coffees.json, batches/batch-NN.json (10 coffees
// each) and keep.json. Real data: <out> must stay outside git (data/backfill-review/<pass>/ is ignored).
//   npx vite-node --config scripts/vite-node.config.mjs scripts/bean-data-input.ts \
//     --db <copy.db> --export <dir with Beanconqueror.zip> --out <pass dir>
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { conciseProcess } from '../src/lib/processGroups';
import { bcRoastDate, readBeanConquerorZip } from '../src/lib/server/beanConquerorJson';

const { values } = parseArgs({ args: process.argv.slice(2), options: { db: { type: 'string' }, export: { type: 'string' }, out: { type: 'string' } } });
const fail = (msg: string): never => {
  console.error(msg);
  process.exit(1);
};
if (!values.db || !values.export || !values.out) {
  fail('usage: bean-data-input.ts --db <db COPY, never data/bean-tracker.db> --export <dir> --out <pass dir>');
}
const real = (p: string) => {
  try {
    return realpathSync(p);
  } catch {
    return resolve(p);
  }
};
if (real(values.db!) === real('data/bean-tracker.db')) fail('refusing to read data/bean-tracker.db: pass a copy');
if (!existsSync(values.db!)) fail(`--db ${values.db} does not exist`);
try {
  execFileSync('git', ['check-ignore', '-q', join(values.out!, 'coffees.json')]);
} catch {
  fail(`--out ${values.out} is not git-ignored: real data must stay out of git`);
}
const { createDb } = await import('../src/lib/server/db');

type Row = Record<string, unknown>;
const db = createDb(values.db!);
const all = (sql: string) => db.prepare(sql).all() as Row[];
const degrees = new Map(all('SELECT roast_level, degrees_of_roast d FROM roast_levels').map((r) => [r.roast_level as string, r.d as number]));
const links = new Map(all('SELECT id, coffee_id FROM beanconqueror_beans WHERE coffee_id IS NOT NULL').map((r) => [r.coffee_id as number, r.id as string]));

const buf = readFileSync(join(values.export, 'Beanconqueror.zip'));
const { main } = await readBeanConquerorZip(buf);
const bqBeans = new Map<string, Row>();
for (const b of (main as { BEANS: Row[] }).BEANS) bqBeans.set(((b.config as Row)?.uuid as string) ?? '', b);

const t = (v: unknown) => (typeof v === 'string' || typeof v === 'number' ? String(v).trim() || null : null);
const norm = (v: unknown) => String(v ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
const same = (a: unknown, b: unknown) => norm(a) === norm(b);
const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null);

const coffees: Row[] = [];
const keep: Record<string, string[]> = {};
for (const c of all('SELECT * FROM coffees ORDER BY id')) {
  const id = c.id as number;
  const uuid = links.get(id) ?? null;
  const b = uuid ? bqBeans.get(uuid) : undefined;
  const site: Row = { ...c, roast_degree: degrees.get(c.roast_level as string) ?? null };
  let bq: Row | null = null;
  const diff: string[] = [];
  if (b) {
    const o = ((b.bean_information as Row[]) ?? [])[0] ?? {};
    bq = {
      coffee_name: t(b.name), roaster: t(b.roaster), roast_date: bcRoastDate(b.roastingDate), roast_degree: num(b.roast_range),
      amount_g: num(b.weight), cost: num(b.cost), decaf: b.decaffeinated === true ? 1 : 0, finished: b.finished === true,
      product_url: t(b.url), origin: t(o.country), processing: t(o.processing), producer: t(o.farmer), farm: t(o.farm),
      variety: t(o.variety), region: t(o.region), elevation: t(o.elevation), harvest_time: t(o.harvest_time),
      certification: t(o.certification)
    };
    if (!same(c.coffee_name, bq.coffee_name)) diff.push(`coffee_name: site "${c.coffee_name}" vs bq "${bq.coffee_name}"`);
    else if (c.coffee_name !== bq.coffee_name) keep[id] = ['coffee_name'];
    if (site.roast_degree !== bq.roast_degree) diff.push(`roast_level: site ${c.roast_level ?? 'blank'} (${site.roast_degree ?? '?'}) vs bq ${bq.roast_degree ?? 'blank'}`);
    if (Math.abs(((c.cost as number) ?? 0) - ((bq.cost as number) ?? 0)) > 0.005 || (c.cost == null) !== (bq.cost == null)) diff.push(`cost: site ${c.cost ?? 'blank'} vs bq ${bq.cost ?? 'blank'}`);
    if ((c.amount_g ?? null) !== bq.amount_g) diff.push(`amount_g: site ${c.amount_g ?? 'blank'} vs bq ${bq.amount_g ?? 'blank'}`);
    if (c.processing && bq.processing && !same(c.processing, bq.processing)) diff.push(`processing: site "${c.processing}" vs bq "${bq.processing}"`);
    if ((c.status === 'archive') !== bq.finished) diff.push(`status: site ${c.status} vs bq ${bq.finished ? 'finished' : 'not finished'}`);
    if ((c.decaf ? 1 : 0) !== bq.decaf) diff.push(`decaf: site ${c.decaf ? 1 : 0} vs bq ${bq.decaf}`);
    if (c.origin && bq.origin && !same(c.origin, bq.origin)) diff.push(`origin: site "${c.origin}" vs bq "${bq.origin}"`);
    // BQ stores UTC instants: bcRoastDate gives the local date, or ~108 false differences appear.
    if ((c.roast_date ?? null) !== bq.roast_date) diff.push(`roast_date: site ${c.roast_date ?? 'blank'} vs bq ${bq.roast_date ?? 'blank'}`);
  }
  if (c.processing && conciseProcess(c.processing as string) !== c.processing) {
    diff.push(`processing_long: "${c.processing}" would become "${conciseProcess(c.processing as string) ?? 'blank'}"`);
  }
  coffees.push({ id, slug: c.slug, roaster: c.roaster, coffee_name: c.coffee_name, status: c.status, site, bean_uuid: uuid, bq, differences: diff });
}

mkdirSync(join(values.out, 'batches'), { recursive: true });
writeFileSync(join(values.out, 'coffees.json'), JSON.stringify(coffees, null, 2));
writeFileSync(join(values.out, 'roast_levels.json'), JSON.stringify(Object.fromEntries(degrees), null, 2));
// keep.json also collects fields-export's decisions: merge, never drop an entry.
const keepPath = join(values.out, 'keep.json');
const prior: Record<string, string[]> = existsSync(keepPath) ? JSON.parse(readFileSync(keepPath, 'utf8')) : {};
for (const [id, fields] of Object.entries(prior)) keep[id] = [...new Set([...(keep[id] ?? []), ...fields])].sort();
writeFileSync(keepPath, JSON.stringify(keep, null, 2));
for (let i = 0; i * 10 < coffees.length; i++) {
  writeFileSync(join(values.out, 'batches', `batch-${String(i + 1).padStart(2, '0')}.json`), JSON.stringify(coffees.slice(i * 10, i * 10 + 10), null, 2));
}
const count: Record<string, number> = {};
for (const c of coffees) for (const d of c.differences as string[]) count[d.split(':')[0]] = (count[d.split(':')[0]] ?? 0) + 1;
console.log(`${coffees.length} coffees, ${coffees.filter((c) => c.bq).length} linked; kept names ${Object.keys(keep).length}`);
console.log(count);
