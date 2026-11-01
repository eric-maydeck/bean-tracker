// One-time tool: patch the BEANS key of a Bean Conqueror export without touching anything else.
//   apply  --export <dir> --out <dir> [--plan <file.json>] [--max-age-hours 24]
//   apply  --export <dir> --out <dir> --db <DB COPY> --images <images root> --keep <keep.json>
//          [--dry-run]   (builds the plan from the site; --dry-run writes report.json and copies nothing)
//   verify --zip <zip> --dump <dump.json>
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import {
  existsSync, mkdirSync, readdirSync, readFileSync, realpathSync, renameSync, statSync, writeFileSync
} from 'node:fs';
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import JSZip from 'jszip';
import sharp from 'sharp';
import {
  applyPatchPlan, buildPatchPlan, comparePatched, type PatchCoffee, type PatchPlan
} from '../src/lib/server/bqPatch.ts';
import { coffeeBeanUuid } from '../src/lib/server/bqBeanUuid.ts';
import { copyPath } from '../src/lib/server/imageCopies.ts';

const { positionals, values: a } = parseArgs({
  allowPositionals: true,
  options: {
    export: { type: 'string' },
    out: { type: 'string' },
    plan: { type: 'string' },
    zip: { type: 'string' },
    dump: { type: 'string' },
    db: { type: 'string' },
    images: { type: 'string' },
    keep: { type: 'string' },
    'dry-run': { type: 'boolean' },
    'max-age-hours': { type: 'string', default: '24' }
  }
});
const fail = (msg: string): never => {
  console.error(msg);
  process.exit(1);
};
const need = (v: string | undefined, name: string) => v ?? fail(`--${name} is required`);

async function apply() {
  const src = need(a.export, 'export');
  const out = resolve(need(a.out, 'out'));
  const zipPath = join(src, 'Beanconqueror.zip');
  const ageH = (Date.now() - statSync(zipPath).mtimeMs) / 3.6e6;
  if (ageH > Number(a['max-age-hours'])) fail(`Export is ${ageH.toFixed(1)}h old; re-export first`);
  mkdirSync(out, { recursive: true });
  if (readdirSync(out).some((n) => n !== 'report.json')) fail(`${out} is not empty`); // a dry run leaves report.json

  const zip = await JSZip.loadAsync(readFileSync(zipPath));
  const names = Object.keys(zip.files);
  if (names.some((n) => /^Beanconqueror_Beans_\d+\.json$/.test(n))) {
    fail('Export has Beanconqueror_Beans_N.json entries; BEANS is split and not supported');
  }
  const main = JSON.parse(await zip.file('Beanconqueror.json')!.async('string'));
  let plan: PatchPlan = a.plan ? JSON.parse(readFileSync(a.plan, 'utf8')) : { beans: [], newBeans: [] };
  let extra: Record<string, unknown> = {};
  const newPhotos = new Map<string, string>(); // new bean uuid -> local photo
  if (a.db) {
    const built = await planFromSite(main);
    plan = built.plan;
    for (const [u, p] of built.newPhotos) newPhotos.set(u, p);
    extra = { unexpected: built.unexpected, warnings: built.warnings, untouchedBeans: built.untouchedBeans };
  }

  const photoNames: Record<string, string> = {};
  for (const b of plan.beans) if (b.photo) photoNames[b.uuid] = `photo_${randomUUID()}.jpg`;
  for (const nb of plan.newBeans) {
    const u = (nb.config as { uuid: string }).uuid;
    if (newPhotos.has(u)) {
      photoNames[u] = `photo_${randomUUID()}.jpg`;
      nb.attachments = [photoNames[u]];
    }
  }
  const { main: patched, changes } = applyPatchPlan(main, plan, photoNames);
  const counts: Record<string, number> = {};
  for (const c of changes) {
    const f = c.field.replace('bean_information[0].', 'origin.');
    counts[f] = (counts[f] ?? 0) + 1;
  }
  const summary = {
    changes: changes.length, perField: counts, newBeans: plan.newBeans.length, newBeanPhotos: newPhotos.size
  };
  const photoed = new Set(changes.filter((c) => c.field === 'attachments').map((c) => c.uuid));
  if (a.db) {
    writeFileSync(join(out, 'report.json'), JSON.stringify({ summary, ...extra, changes }, null, 2));
    console.log(JSON.stringify(summary, null, 1));
    const bad = (extra.unexpected as string[]) ?? [];
    for (const w of (extra.warnings as string[]) ?? []) console.warn(`warning: ${w}`);
    if (bad.length) fail(`Unexpected, refusing:\n${bad.join('\n')}`);
    if (a['dry-run']) return console.log(`dry run: report at ${join(out, 'report.json')}, nothing copied`);
  }

  execFileSync('cp', ['-c', '-R', `${src}/.`, out]); // APFS clone; copies flow files and photos too
  for (const b of plan.beans) {
    if (b.photo && photoed.has(b.uuid)) await sharp(b.photo).jpeg({ quality: 90 }).toFile(join(out, photoNames[b.uuid]));
  }
  for (const [u, p] of newPhotos) await sharp(p).jpeg({ quality: 90 }).toFile(join(out, photoNames[u]));

  const next = new JSZip();
  for (const n of names) {
    const f = zip.files[n];
    if (f.dir) next.folder(n);
    else {
      const bytes = n === 'Beanconqueror.json' ? JSON.stringify(patched) : await f.async('uint8array');
      next.file(n, bytes, { date: f.date });
    }
  }
  writeFileSync(
    join(out, 'Beanconqueror.zip'),
    await next.generateAsync({ type: 'uint8array', compression: 'DEFLATE' })
  );
  writeFileSync(join(out, 'report.json'), JSON.stringify({ summary, ...extra, changes }, null, 2));

  const tmp = `${out}.tmp.zip`; // outside out so the archive does not contain itself
  execFileSync('ditto', ['-c', '-k', out, tmp]);
  renameSync(tmp, join(out, 'bq-patched.zip'));
  console.log(`${changes.length} changes, ${plan.newBeans.length} new beans -> ${out}`);
}

async function planFromSite(main: Record<string, unknown>) {
  const dbPath = need(a.db, 'db');
  const real = (p: string) => (existsSync(p) ? realpathSync(p) : resolve(p));
  if (real(dbPath) === real('data/bean-tracker.db')) fail('refusing data/bean-tracker.db: pass a copy');
  if (!existsSync(dbPath)) fail(`--db ${dbPath} does not exist`);
  const images = resolve(need(a.images, 'images'));
  const keep = JSON.parse(readFileSync(need(a.keep, 'keep'), 'utf8'));
  const { createDb } = await import('../src/lib/server/db.ts');
  const db = createDb(dbPath);
  const rows = db
    .prepare(
      `SELECT c.*, rl.degrees_of_roast, b.id AS bean_uuid, ic.file AS image_file
       FROM coffees c
       LEFT JOIN roast_levels rl ON rl.roast_level = c.roast_level
       LEFT JOIN beanconqueror_beans b ON b.coffee_id = c.id
       LEFT JOIN image_copies ic ON ic.url = c.image_url AND ic.kind = 'coffees'
       ORDER BY c.id`
    )
    .all() as (PatchCoffee & { image_file: string | null })[];
  db.close();
  const warnings: string[] = [];
  const coffees = rows.map(({ image_file, ...c }) => {
    let photo: string | null = null;
    if (image_file) {
      const p = copyPath(images, 'coffees', image_file);
      if (existsSync(p)) photo = p;
      else warnings.push(`coffee ${c.id}: image file ${image_file} is missing, no photo`);
    }
    return { ...c, photo };
  });
  const built = buildPatchPlan(coffees, main, keep);
  const newPhotos = new Map<string, string>();
  for (const c of coffees) if (!c.bean_uuid && c.photo) newPhotos.set(coffeeBeanUuid(c.id), c.photo);
  return { ...built, warnings, newPhotos };
}

async function verify() {
  const zip = await JSZip.loadAsync(readFileSync(need(a.zip, 'zip')));
  const expected = JSON.parse(await zip.file('Beanconqueror.json')!.async('string'));
  // Brews live in Beanconqueror_Brews_N.json too; a dump holds all of them.
  for (const f of zip.file(/^Beanconqueror_Brews_\d+\.json$/)) {
    expected.BREWS.push(...JSON.parse(await f.async('string')));
  }
  const diffs = comparePatched(expected, JSON.parse(readFileSync(need(a.dump, 'dump'), 'utf8')));
  console.log(diffs.length ? diffs.join('\n') : 'No differences');
  process.exit(diffs.length ? 1 : 0);
}

if (positionals[0] === 'apply') await apply();
else if (positionals[0] === 'verify') await verify();
else fail('usage: bq-patch.ts apply|verify ...');
