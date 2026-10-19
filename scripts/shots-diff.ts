// After a UI_SHOTS=all run: list new/changed/removed screenshots vs the last time this ran,
// then make the current set the new baseline (.ui-test/screenshots-prev/).
import { cpSync, existsSync, rmSync } from 'node:fs';
import { diffShots } from './shotsDiff.ts';

const cur = '.ui-test/screenshots';
const prev = '.ui-test/screenshots-prev';
if (!existsSync(cur)) {
  console.log('shots-diff: no screenshots (run with UI_SHOTS=all)');
  process.exit(0);
}
const d = diffShots(cur, prev);
for (const [label, list] of Object.entries(d)) {
  if (list.length) console.log(`${label} (${list.length}):\n${list.map((f) => `  ${cur}/${f}`).join('\n')}`);
}
if (!d.added.length && !d.changed.length && !d.removed.length) console.log('shots-diff: no screenshot changes');
rmSync(prev, { recursive: true, force: true });
cpSync(cur, prev, { recursive: true });
