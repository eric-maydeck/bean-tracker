// Husky pre-push gate: typecheck + unit tests for the pushed diff. Docs-only pushes run nothing.
// UI tests are not run here: CI runs them per PR and gates releases (ui-full).
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const ZERO = /^0+$/;
const lines = (stdin: string) => stdin.split('\n').map((l) => l.trim().split(/\s+/)).filter((p) => p.length === 4);
// Git's pre-push stdin lines `<local ref> <local sha> <remote ref> <remote sha>` -> diff ranges.
// Deleted branch (local all-zeros): nothing to test. New branch (remote all-zeros): vs origin/main.
export function diffRanges(stdin: string): string[] {
  return lines(stdin).filter((p) => !ZERO.test(p[1]))
    .map(([, local, , remote]) => (ZERO.test(remote) ? `origin/main...${local}` : `${remote}..${local}`));
}

const STEPS = ['svelte-kit sync', 'tsc', 'svelte-check', 'vitest-changed'];
const isDoc = (f: string) => f.startsWith('docs/') || f.endsWith('.md');
export const gateSteps = ({ files }: { files: string[] }): string[] => (files.every(isDoc) ? [] : STEPS);

const COMMANDS: Record<string, string[]> = {
  'svelte-kit sync': ['svelte-kit', 'sync'], // stale generated $types fail svelte-check after a branch fast-forward
  tsc: ['tsc', '--noEmit'],
  'svelte-check': ['svelte-check', '--threshold', 'error'],
  'vitest-changed': ['vitest', 'run', '--changed', 'origin/main']
};

if (import.meta.main) {
  const files = new Set<string>();
  for (const range of diffRanges(readFileSync(0, 'utf8'))) {
    const r = spawnSync('git', ['diff', '--name-only', range], { encoding: 'utf8' });
    // Unknown remote sha (not fetched): can't tell what changed, so treat it as code.
    if (r.status) files.add(`unresolved range ${range}`);
    else r.stdout.split('\n').filter(Boolean).forEach((f) => files.add(f));
  }
  for (const label of gateSteps({ files: [...files] })) {
    console.log(`\n=== pre-push: ${label} ===`);
    const code = spawnSync('npx', COMMANDS[label], { stdio: 'inherit' }).status ?? 1;
    if (code) {
      console.error(`\npre-push: ${label} failed. Deliberate escape hatch: git push --no-verify`);
      process.exit(code);
    }
  }
}
