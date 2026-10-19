// Husky pre-push gate, all on the prod build and all 7 viewports, screenshots off.
// Every push first runs tsc + svelte-check (must be clean). Push to `release` (promotion = deploy): vitest + the full test:ui. Any other push: test:changed
// (vitest + the UI tags the pushed diff reaches; docs-only runs vitest alone).
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
export const pushesRelease = (stdin: string) =>
  lines(stdin).some(([, local, remote]) => remote === 'refs/heads/release' && !ZERO.test(local));

if (import.meta.main) {
  const stdin = readFileSync(0, 'utf8');
  // The gate always runs every viewport: UI_VIEWPORTS (an iteration filter) is dropped here.
  const env = { ...process.env, UI_PROFILE: process.env.UI_PROFILE || 'performance', UI_BUILD: 'prod', UI_SHOTS: 'off' };
  delete env.UI_VIEWPORTS;
  const step = (label: string, cmd: string, args: string[]) => {
    console.log(`\n=== pre-push: ${label} ===`);
    const code = spawnSync(cmd, args, { stdio: 'inherit', env }).status ?? 1;
    if (code) {
      console.error(`\npre-push: ${label} failed. Deliberate escape hatch: git push --no-verify`);
      process.exit(code);
    }
  };
  // Typecheck must stay clean (zero errors): cheap, so it runs first on every push.
  step('tsc', 'npx', ['tsc', '--noEmit']);
  step('svelte-check', 'npx', ['svelte-check', '--threshold', 'error']);
  if (pushesRelease(stdin)) {
    step('vitest', 'npx', ['vitest', 'run']);
    step(`test:ui:prod, full (${env.UI_PROFILE})`, 'npx', ['playwright', 'test']);
  } else {
    const files = new Set<string>();
    for (const range of diffRanges(stdin)) {
      const r = spawnSync('git', ['diff', '--name-only', range], { encoding: 'utf8' });
      // Unknown remote sha (not fetched): can't tell what changed, so run everything.
      if (r.status) files.add(`unresolved range ${range}`);
      else r.stdout.split('\n').filter(Boolean).forEach((f) => files.add(f));
    }
    step(`test:changed, prod (${env.UI_PROFILE})`, 'node', ['scripts/test-changed.ts', '--', ...files]);
  }
}
