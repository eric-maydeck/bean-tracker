// One-time tool: patch the BEANS key of a Bean Conqueror export without touching anything else.
//   apply  --export <dir> --out <dir> [--plan <file.json>] [--max-age-hours 24]
//   verify --zip <zip> --dump <dump.json>
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdirSync, readdirSync, readFileSync, renameSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import JSZip from 'jszip';
import sharp from 'sharp';
import { applyPatchPlan, comparePatched, type PatchPlan } from '../src/lib/server/bqPatch.ts';

const { positionals, values: a } = parseArgs({
  allowPositionals: true,
  options: {
    export: { type: 'string' },
    out: { type: 'string' },
    plan: { type: 'string' },
    zip: { type: 'string' },
    dump: { type: 'string' },
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
  if (readdirSync(out).length) fail(`${out} is not empty`);

  const zip = await JSZip.loadAsync(readFileSync(zipPath));
  const names = Object.keys(zip.files);
  if (names.some((n) => /^Beanconqueror_Beans_\d+\.json$/.test(n))) {
    fail('Export has Beanconqueror_Beans_N.json entries; BEANS is split and not supported');
  }
  const main = JSON.parse(await zip.file('Beanconqueror.json')!.async('string'));
  const plan: PatchPlan = a.plan
    ? JSON.parse(readFileSync(a.plan, 'utf8'))
    : { beans: [], newBeans: [] };

  const photoNames: Record<string, string> = {};
  for (const b of plan.beans) if (b.photo) photoNames[b.uuid] = `photo_${randomUUID()}.jpg`;
  const { main: patched, changes } = applyPatchPlan(main, plan, photoNames);

  execFileSync('cp', ['-c', '-R', `${src}/.`, out]); // APFS clone; copies flow files and photos too
  for (const b of plan.beans) {
    if (b.photo) await sharp(b.photo).jpeg({ quality: 90 }).toFile(join(out, photoNames[b.uuid]));
  }

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
  writeFileSync(join(out, 'report.json'), JSON.stringify({ changes }, null, 2));

  const tmp = `${out}.tmp.zip`; // outside out so the archive does not contain itself
  execFileSync('ditto', ['-c', '-k', out, tmp]);
  renameSync(tmp, join(out, 'bq-patched.zip'));
  console.log(`${changes.length} changes, ${plan.newBeans.length} new beans -> ${out}`);
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
