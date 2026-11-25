// Imports the full mock espresso export into a DB through the real import path (zip reader, parser, importer),
// then stores each flow's weight curve like BQ's Visualizer upload would. Creates the DB if it is new.
// Used by `scripts/preview.sh --mock`. Usage: npx vite-node --config scripts/vite-node.config.mjs scripts/mock-bq-import.ts <db>
import { createDb } from '../src/lib/server/db.ts';
import { importBeanConquerorData } from '../src/lib/server/beanconqueror.ts';
import { parseBeanConquerorJson, readBeanConquerorZip } from '../src/lib/server/beanConquerorJson.ts';
import { FLOW_STEP_MS, compactFlow } from '../src/lib/server/bcFlow.ts';
import { mockEspressoExport } from '../src/lib/server/fixtures/beanconqueror/mockEspresso.ts';
import { zipOf } from '../src/lib/server/fixtures/beanconqueror/fixture.ts';

const path = process.argv[2];
if (!path?.startsWith('.preview-data/') && !path?.startsWith('.ui-test/')) {
  console.error('mock-bq-import: db path must be under .preview-data/ or .ui-test/');
  process.exit(1);
}
const { zipFiles, flowFiles } = mockEspressoExport({ size: 'full' });
const db = createDb(path);
const parsed = parseBeanConquerorJson(await readBeanConquerorZip(await zipOf(zipFiles)));
const changes = importBeanConquerorData(db, parsed);
const insert = db.prepare(`INSERT OR REPLACE INTO beanconqueror_brew_flows (bc_uuid, format, step_ms, points, weights, uploaded_at) VALUES (?, 1, ${FLOW_STEP_MS}, ?, ?, ?)`);
const now = new Date().toISOString();
let flows = 0;
for (const [name, text] of Object.entries(flowFiles)) {
  const c = compactFlow(JSON.parse(text));
  if (c) { insert.run(name.replace('_flow_profile.json', ''), c.w.length, JSON.stringify(c.w), now); flows++; }
}
db.close();
console.log(`mock-bq-import: ${parsed.brews.length} brews, ${parsed.beans.length} beans read, ${flows} flows, into ${path}`, changes);
