// Dry run of the coffee data standards: prints what applyDataStandards would change, never writes.
//   node scripts/standards-report.ts <db-path>
import { DatabaseSync } from 'node:sqlite';
import { standardizeCoffee } from '../src/lib/server/standards.ts';

const path = process.argv[2];
if (!path) {
  console.error('usage: node scripts/standards-report.ts <db-path>');
  process.exit(1);
}
const db = new DatabaseSync(path, { readOnly: true });
const rows = db.prepare(`SELECT * FROM coffees ORDER BY id`).all() as Record<string, unknown>[];
const farms = [...new Set(rows.map((r) => String(r.farm ?? '').trim()).filter(Boolean))];
const out = { changes: [] as object[], review: [] as object[] };
for (const row of rows) {
  const who = { id: row.id, roaster: row.roaster, coffee_name: row.coffee_name };
  const r = standardizeCoffee(row, farms);
  out.changes.push(...r.changes.map((c) => ({ ...who, field: c.field, from: c.from, to: c.to })));
  out.review.push(...r.review.map((c) => ({ ...who, ...c })));
}
console.log(JSON.stringify(out, null, 1));
