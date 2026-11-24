// One-time tool: patch the BEANS key (and, with --speeds, brew mill_speed) of a Bean Conqueror export without
// touching anything else.
//   apply  --export <dir> --out <dir> [--plan <file.json>] [--speeds <uuid-to-speed.json>] [--max-age-hours 24]
//   apply  --export <dir> --out <dir> --db <DB COPY> --images <images root> --keep <keep.json>
//          [--settled <settled.json>] [--dry-run]   (builds the plan from the site; --dry-run writes report.json and copies nothing)
//   verify --zip <zip> --dump <dump.json>
//   tools        --export <dir> --out <dir> --plan <plan.json>   (filters as tools: writes the converted JSON files + report.json)
//   verify-tools --export <dir> --out <dir> --plan <plan.json>   (prints failures, exit 1 on any)
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import {
  existsSync, mkdirSync, readdirSync, readFileSync, realpathSync, renameSync, writeFileSync
} from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import JSZip from 'jszip';
import sharp from 'sharp';
import {
  applyPatchPlan, buildPatchPlan, comparePatched, convertToTools, setBrewSpeeds, verifyTools,
  type PatchCoffee, type PatchPlan, type ToolPlan
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
    settled: { type: 'string' },
    speeds: { type: 'string' },
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
  const zip = await JSZip.loadAsync(readFileSync(zipPath));
  const names = Object.keys(zip.files);
  // File mtime says when the zip was copied; the entries say when BQ exported it.
  const newest = Math.max(...names.map((n) => zip.files[n].date.getTime()));
  const ageH = (Date.now() - newest) / 3.6e6;
  if (ageH > Number(a['max-age-hours'])) fail(`Export is ${ageH.toFixed(1)}h old; re-export first`);
  mkdirSync(out, { recursive: true });
  if (readdirSync(out).some((n) => n !== 'report.json')) fail(`${out} is not empty`); // a dry run leaves report.json
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
    extra = {
      unexpected: built.unexpected, warnings: built.warnings, untouchedBeans: built.untouchedBeans,
      created: plan.newBeans.map((nb) => ({
        uuid: (nb.config as { uuid: string }).uuid, name: nb.name, roaster: nb.roaster
      }))
    };
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
  // Brews are split: the first batch in Beanconqueror.json, the rest in Beanconqueror_Brews_N.json.
  const brewFiles = new Map<string, Record<string, unknown>[]>();
  if (a.speeds) {
    const speeds: Record<string, number> = JSON.parse(readFileSync(a.speeds, 'utf8'));
    for (const n of names.filter((n) => /^Beanconqueror_Brews_\d+\.json$/.test(n))) {
      brewFiles.set(n, JSON.parse(await zip.files[n].async('string')));
    }
    const set = [patched.BREWS as Record<string, unknown>[], ...brewFiles.values()].flatMap((b) => setBrewSpeeds(b, speeds));
    if (set.length !== Object.keys(speeds).length) fail(`--speeds lists ${Object.keys(speeds).length} brews, found ${set.length}`);
    changes.push(...set);
  }
  const counts: Record<string, number> = {};
  for (const c of changes) {
    const f = c.field.replace('bean_information[0].', 'origin.');
    counts[f] = (counts[f] ?? 0) + 1;
  }
  const summary = {
    changes: changes.length, perField: counts, newBeans: plan.newBeans.length, newBeanPhotos: newPhotos.size
  };
  const photoed = new Set(changes.filter((c) => c.field === 'attachments').map((c) => c.uuid));
  if (a.db || a['dry-run']) {
    writeFileSync(join(out, 'report.json'), JSON.stringify({ summary, ...extra, changes }, null, 2));
    console.log(JSON.stringify(summary, null, 1));
    const bad = (extra.unexpected as string[]) ?? [];
    const warnings = (extra.warnings as string[]) ?? [];
    for (const w of warnings) console.warn(`${a['dry-run'] ? 'warning' : 'missing'}: ${w}`);
    if (bad.length) fail(`Unexpected, refusing:\n${bad.join('\n')}`);
    if (a['dry-run']) return console.log(`dry run: report at ${join(out, 'report.json')}, nothing copied`);
    if (warnings.length) fail(`${warnings.length} own image file(s) missing (listed above); rsync the images first`);
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
      const bytes = n === 'Beanconqueror.json' ? JSON.stringify(patched)
        : brewFiles.has(n) ? JSON.stringify(brewFiles.get(n)) : await f.async('uint8array');
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
  if (real(dbPath) === real(fileURLToPath(new URL('../data/bean-tracker.db', import.meta.url)))) fail('refusing data/bean-tracker.db: pass a copy');
  if (!existsSync(dbPath)) fail(`--db ${dbPath} does not exist`);
  const images = resolve(need(a.images, 'images'));
  const keep = JSON.parse(readFileSync(need(a.keep, 'keep'), 'utf8'));
  if (!a.settled && !a['dry-run']) fail('--settled is required with --db unless --dry-run');
  const settled: string[] = a.settled ? JSON.parse(readFileSync(a.settled, 'utf8')) : [];
  const { createDb } = await import('../src/lib/server/db.ts');
  const db = createDb(dbPath);
  const rows = db
    .prepare(
      `SELECT c.*, rl.degrees_of_roast, b.id AS bean_uuid, ic.file AS image_file, rc.file AS roaster_image_file
       FROM coffees c
       LEFT JOIN roast_levels rl ON rl.roast_level = c.roast_level
       LEFT JOIN beanconqueror_beans b ON b.coffee_id = c.id
       LEFT JOIN image_copies ic ON ic.url = c.image_url AND ic.kind = 'coffees'
       LEFT JOIN roaster_images ri ON ri.roaster = c.roaster
       LEFT JOIN image_copies rc ON rc.url = ri.image_url AND rc.kind = 'roasters'
       ORDER BY c.id`
    )
    .all() as (PatchCoffee & { image_file: string | null; roaster_image_file: string | null })[];
  db.close();
  const warnings: string[] = [];
  const coffees = rows.map(({ image_file, roaster_image_file, ...c }) => {
    let photo: string | null = null;
    // No image of its own: the roaster's, as the site shows. ponytail: BQ then counts as having a
    // photo, so a later patch won't replace it (attachments are only written when empty).
    const kind = image_file ? 'coffees' : 'roasters';
    const file = image_file ?? roaster_image_file;
    if (file) {
      const p = copyPath(images, kind, file);
      if (existsSync(p)) photo = p;
      else warnings.push(`coffee ${c.id}: image file ${file} is missing, no photo`);
    }
    return { ...c, photo };
  });
  const built = buildPatchPlan(coffees, main, keep, settled);
  if (!a.settled) {
    // dry run without --settled: unsettled overwrites are warnings, not refusals
    const isUnsettled = (m: string) => m.endsWith('is not settled');
    warnings.push(...built.unexpected.filter(isUnsettled));
    built.unexpected = built.unexpected.filter((m) => !isUnsettled(m));
  }
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

// Beanconqueror.json plus Beanconqueror_Brews_N.json (in N order), from an export's zip or a converted output's folder.
async function readBq(dir: string) {
  const zipPath = join(dir, 'Beanconqueror.zip');
  const files: Record<string, string> = {};
  if (existsSync(zipPath)) {
    const zip = await JSZip.loadAsync(readFileSync(zipPath));
    for (const n of Object.keys(zip.files)) if (/^Beanconqueror(_Brews_\d+)?\.json$/.test(n)) files[n] = await zip.files[n].async('string');
  } else {
    for (const n of readdirSync(dir)) if (/^Beanconqueror(_Brews_\d+)?\.json$/.test(n)) files[n] = readFileSync(join(dir, n), 'utf8');
  }
  const brewNames = Object.keys(files).filter((n) => n !== 'Beanconqueror.json')
    .sort((x, y) => parseInt(x.replace(/\D/g, '')) - parseInt(y.replace(/\D/g, '')));
  return {
    main: JSON.parse(files['Beanconqueror.json'] ?? fail(`${dir}: no Beanconqueror.json`)),
    brewNames, brewFiles: brewNames.map((n) => JSON.parse(files[n]))
  };
}

async function tools() {
  const src = await readBq(need(a.export, 'export'));
  const out = resolve(need(a.out, 'out'));
  const plan: ToolPlan = JSON.parse(readFileSync(need(a.plan, 'plan'), 'utf8'));
  const r = convertToTools(src.main, src.brewFiles, plan);
  console.log(JSON.stringify(r.report, null, 1));
  if (r.report.problems.length) fail('Problems found, nothing written');
  mkdirSync(out, { recursive: true });
  if (readdirSync(out).length) fail(`${out} is not empty`);
  writeFileSync(join(out, 'Beanconqueror.json'), JSON.stringify(r.main));
  src.brewNames.forEach((n, i) => writeFileSync(join(out, n), JSON.stringify(r.brewFiles[i])));
  writeFileSync(join(out, 'report.json'), JSON.stringify(r.report, null, 2));
}

async function verifyToolsCmd() {
  const [o, n] = [await readBq(need(a.export, 'export')), await readBq(need(a.out, 'out'))];
  const plan: ToolPlan = JSON.parse(readFileSync(need(a.plan, 'plan'), 'utf8'));
  const fails = verifyTools(o.main, o.brewFiles, n.main, n.brewFiles, plan);
  console.log(fails.length ? fails.join('\n') : 'No failures');
  process.exit(fails.length ? 1 : 0);
}

if (positionals[0] === 'apply') await apply();
else if (positionals[0] === 'verify') await verify();
else if (positionals[0] === 'tools') await tools();
else if (positionals[0] === 'verify-tools') await verifyToolsCmd();
else fail('usage: bq-patch.ts apply|verify|tools|verify-tools ...');
