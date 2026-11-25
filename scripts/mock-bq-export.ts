// Writes a made-up Bean Conqueror export for an espresso-first person: <outDir>/Beanconqueror.zip and the flow
// files in <outDir>/brews/. Nothing real: every value is invented by mockEspresso.ts.
// Usage: node scripts/mock-bq-export.ts [small|full] [outDir]   (default outDir .preview-data/mock-bq/<size>)
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { mockEspressoExport, type MockSize } from '../src/lib/server/fixtures/beanconqueror/mockEspresso.ts';
import { zipOf } from '../src/lib/server/fixtures/beanconqueror/fixture.ts';

const size = (process.argv[2] ?? 'full') as MockSize;
if (size !== 'small' && size !== 'full') {
  console.error('Usage: node scripts/mock-bq-export.ts [small|full] [outDir]');
  process.exit(1);
}
const out = process.argv[3] ?? join('.preview-data', 'mock-bq', size);
const { zipFiles, flowFiles } = mockEspressoExport({ size });
rmSync(out, { recursive: true, force: true });
mkdirSync(join(out, 'brews'), { recursive: true });
writeFileSync(join(out, 'Beanconqueror.zip'), await zipOf(zipFiles));
for (const [name, text] of Object.entries(flowFiles)) writeFileSync(join(out, 'brews', name), text);
console.log(`mock-bq-export: ${size} -> ${out}/Beanconqueror.zip + ${Object.keys(flowFiles).length} flow files in brews/`);
