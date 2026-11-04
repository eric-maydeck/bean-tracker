// Builds tests/ui/fixtures/bq-tiny.zip: one water from the vitest export fixture, nothing else, so the
// account-upload UI state changes almost nothing in the UI test DB. Run: npx tsx scripts/make-ui-bq-zip.ts
import { writeFileSync } from 'node:fs';
import { fixtureFiles, zipOf } from '../src/lib/server/fixtures/beanconqueror/fixture';

const main = fixtureFiles().main as Record<string, unknown[]>;
const tiny = { ...main, BEANS: [], PREPARATION: [], MILL: [], BREWS: [], WATER: main.WATER.slice(0, 1) };
writeFileSync('tests/ui/fixtures/bq-tiny.zip', await zipOf({ 'Beanconqueror.json': JSON.stringify(tiny) }));
