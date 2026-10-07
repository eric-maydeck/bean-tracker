// Side-by-side image Suggest results per provider, for the user to judge
// (spec "Provider comparison"). Runs against a DB COPY (it writes schema,
// the website backfill and Tavily usage rows into it). Run with vite-node
// (extensionless imports, no .ts-extension churn):
//   npx vite-node --config scripts/vite-node.config.mjs scripts/suggest-compare.ts <db copy> [n=8] [out=suggest-compare.html]
// Serve only the output's own directory: never the DB copy.
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const [dbPath, n = '8', out = 'suggest-compare.html'] = process.argv.slice(2);
if (!dbPath || resolve(dbPath) === resolve('data/bean-tracker.db')) {
  console.error('usage: suggest-compare.ts <db copy> [n] [out]  (a copy, never data/bean-tracker.db)');
  process.exit(1);
}
process.env.DB_PATH = dbPath; // before getDb(): Tavily's budget rows land in the copy
const { getDb } = await import('../src/lib/server/db');
const { backfillRoasterWebsites, getRoasterWebsite } = await import('../src/lib/server/roasterWebsites');
const { suggest, providers } = await import('../src/lib/server/imageSuggest/index');

const db = getDb();
backfillRoasterWebsites(db);
const coffees = db
  .prepare(
    `SELECT c.roaster, c.coffee_name, c.origin, c.roast_date, COALESCE(c.image_url, ri.image_url) AS current
     FROM coffees c LEFT JOIN roaster_images ri ON ri.roaster = c.roaster
     WHERE TRIM(c.roaster) <> '' AND TRIM(c.coffee_name) <> '' ORDER BY RANDOM() LIMIT ?`
  )
  .all(Number(n)) as { roaster: string; coffee_name: string; origin: string | null; roast_date: string | null; current: string | null }[];
const list = providers('shopify,tavily');
const esc = (s: string) => s.replace(/[&<>"']/g, (ch) => `&#${ch.charCodeAt(0)};`);
const thumb = (src: string, href?: string) =>
  `<a href="${esc(href ?? src)}" target="_blank" rel="noreferrer"><img src="${esc(src)}" loading="lazy"></a>`;

const rows: string[] = [];
for (const c of coffees) {
  const q = { roaster: c.roaster, name: c.coffee_name, origin: c.origin, roastDate: c.roast_date, site: getRoasterWebsite(db, c.roaster) };
  const cells: string[] = [];
  for (const p of list) {
    const r = await suggest(q, { providers: [p] });
    console.log(`${c.roaster} / ${c.coffee_name} [${p.name}]: ${r.status} ${r.candidates.length}`);
    const items = r.candidates.map(
      (x) =>
        `<figure>${thumb(x.image, x.pageUrl)}<figcaption>${x.closest ? '<b>closest</b> ' : ''}${esc(x.published ?? 'no date')}` +
        `${x.excerpt ? `<br>${esc(x.excerpt)}` : ''}</figcaption></figure>`
    );
    cells.push(`<td><b>${r.status}</b> ${esc(r.notes.join('; '))}<div class="g">${items.join('')}</div></td>`);
  }
  rows.push(
    `<tr><th>${esc(c.roaster)}<br>${esc(c.coffee_name)}<br><small>roasted ${esc(c.roast_date ?? '?')}<br>${esc(q.site ?? 'no site')}</small></th>` +
      `<td>${c.current ? thumb(c.current) : '—'}</td>${cells.join('')}</tr>`
  );
}
writeFileSync(
  out,
  `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Suggest comparison</title>
<style>body{font:14px system-ui;margin:16px}table{border-collapse:collapse}td,th{border:1px solid #ccc;padding:6px;vertical-align:top;text-align:left}
.g{display:flex;flex-wrap:wrap}figure{margin:2px;width:110px}figcaption{font-size:11px;overflow-wrap:anywhere}
img{width:96px;height:96px;object-fit:contain;background:#e6ddd2;margin:2px}</style>
<table><tr><th>Coffee</th><th>Current</th>${list.map((p) => `<th>${p.name}</th>`).join('')}</tr>${rows.join('\n')}</table>`
);
console.log(`wrote ${out}`);
