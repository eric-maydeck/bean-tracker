// npm run test:changed: unit tests (not in CI: the test job runs them), then only the test:ui route tags the change touches.
// `-- <files>` (pre-push) scopes to those files instead of this branch's diff + working tree.
import { spawnSync } from 'node:child_process';
import { scopeFor } from './testScope.ts';
import { PART, PARTS, TWO_VIEWPORTS, VIEWPORTS } from '../tests/ui/viewports.ts';

// Iterating wants pictures: screenshots on unless UI_SHOTS says otherwise.
const env = { ...process.env, UI_SHOTS: process.env.UI_SHOTS || 'all' };
// Whatever the exit path, end with the list of screenshots that changed since the last run.
if (env.UI_SHOTS === 'all') process.on('exit', () => { spawnSync('node', ['scripts/shots-diff.ts'], { stdio: 'inherit' }); });
const run = (cmd: string, args: string[]) => spawnSync(cmd, args, { stdio: 'inherit', env }).status ?? 1;
const lines = (args: string[]) => spawnSync('git', args, { encoding: 'utf8' }).stdout.split('\n').filter(Boolean);
const dash = process.argv.indexOf('--');
const files = dash >= 0 ? process.argv.slice(dash + 1) : [...new Set([
  ...lines(['diff', '--name-only', 'origin/main...HEAD']),
  ...lines(['diff', '--name-only', 'HEAD']),
  ...lines(['ls-files', '--others', '--exclude-standard'])
])];

const scope = scopeFor(files);
console.log('scope:', scope.kind === 'full' ? `full: ${scope.reason}` : scope.kind === 'tags' ? `tags: ${scope.tags.join(' ')}` : 'none (no UI tests)');

const pw = (args: string[]) => run('npx', ['playwright', 'test', ...args]);
const unit = process.env.CI ? 0 : run('npx', ['vitest', 'run']);
if (unit) process.exit(unit);

if (scope.kind === 'full') process.exit(pw([]));
if (scope.kind === 'none') process.exit(0);

// Playwright skips --grep for dependency projects and perf waits on every viewport, so a grep
// over all projects would run the whole layout suite: viewports first, perf/save separately.
const grep = scope.tags.join('|');
const viewports = VIEWPORTS.map((v) => `--project=${v.name}`);
const count = (args: string[]) => (spawnSync('npx', ['playwright', 'test', '--list', ...args], { encoding: 'utf8' }).stdout.match(/Total: (\d+) tests?/) ?? [])[1] ?? '0';
const layoutTests = Number(count([...viewports, '--grep', grep])) - Number(count(['--project=setup']));
const tail = ['--project=setup', '--project=perf', '--project=save', '--no-deps', '--workers=1', '--grep', `@setup|${grep}`];
// UI_PART > 1 has no perf/save projects (playwright.config.ts): part 1 runs the tail.
const tailTests = PART > 1 ? 0 : Number(count(tail)) - Number(count(['--project=setup']));
// A CI slice (one part, or no @two viewport) can rightly match nothing; the full layout set still catches a dead tag.
const slice = PARTS > 1 || !VIEWPORTS.some((v) => TWO_VIEWPORTS.includes(v.name));
if (layoutTests + tailTests <= 0 && slice) {
  console.log(`no UI tests matched ${grep} in this slice`);
  process.exit(0);
}
if (layoutTests + tailTests <= 0) {
  console.error(`no UI tests matched ${grep}`);
  process.exit(1);
}
const first = layoutTests > 0 ? pw([...viewports, '--grep', grep]) : 0;
if (first) process.exit(first);
process.exit(tailTests > 0 ? pw(tail) : 0);
