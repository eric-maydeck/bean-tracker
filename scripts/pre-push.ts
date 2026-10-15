// Husky pre-push gate: vitest, then the full test:ui and test:ui:prod unless the push is docs-only.
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { scopeFor } from './testScope.ts';

const ZERO = /^0+$/;
// Git's pre-push stdin lines `<local ref> <local sha> <remote ref> <remote sha>` -> diff ranges.
// Deleted branch (local all-zeros): nothing to test. New branch (remote all-zeros): vs origin/main.
export function diffRanges(stdin: string): string[] {
  return stdin.split('\n').map((l) => l.trim().split(/\s+/)).filter((p) => p.length === 4 && !ZERO.test(p[1]))
    .map(([, local, , remote]) => (ZERO.test(remote) ? `origin/main...${local}` : `${remote}..${local}`));
}

if (import.meta.main) {
  const files = new Set<string>();
  for (const range of diffRanges(readFileSync(0, 'utf8'))) {
    const r = spawnSync('git', ['diff', '--name-only', range], { encoding: 'utf8' });
    // Unknown remote sha (not fetched): can't tell what changed, so run everything.
    if (r.status) files.add(`unresolved range ${range}`);
    else r.stdout.split('\n').filter(Boolean).forEach((f) => files.add(f));
  }
  const env = { ...process.env, UI_PROFILE: process.env.UI_PROFILE || 'performance' };
  const step = (label: string, args: string[], extra: Record<string, string> = {}) => {
    console.log(`\n=== pre-push: ${label} ===`);
    const code = spawnSync('npx', args, { stdio: 'inherit', env: { ...env, ...extra } }).status ?? 1;
    if (code) {
      console.error(`\npre-push: ${label} failed. Deliberate escape hatch: git push --no-verify`);
      process.exit(code);
    }
  };
  step('vitest', ['vitest', 'run']);
  const scope = scopeFor([...files]);
  if (scope.kind === 'none') {
    console.log('pre-push: docs/unit-test-only push, UI suites skipped');
    process.exit(0);
  }
  step(`test:ui (${env.UI_PROFILE})`, ['playwright', 'test']);
  step(`test:ui:prod (${env.UI_PROFILE})`, ['playwright', 'test'], { UI_BUILD: 'prod' });
}
