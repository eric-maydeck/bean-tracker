// npm run test:changed: unit tests, then only the test:ui route tags the change touches.
import { spawnSync } from 'node:child_process';
import { scopeFor } from './testScope.ts';
import { VIEWPORTS } from '../tests/ui/viewports.ts';

const run = (cmd: string, args: string[]) => spawnSync(cmd, args, { stdio: 'inherit', env: process.env }).status ?? 1;
const lines = (args: string[]) => spawnSync('git', args, { encoding: 'utf8' }).stdout.split('\n').filter(Boolean);
const files = [...new Set([
  ...lines(['diff', '--name-only', 'origin/main...HEAD']),
  ...lines(['diff', '--name-only', 'HEAD']),
  ...lines(['ls-files', '--others', '--exclude-standard'])
])];

const scope = scopeFor(files);
console.log('scope:', scope.kind === 'full' ? `full: ${scope.reason}` : scope.kind === 'tags' ? `tags: ${scope.tags.join(' ')}` : 'none (no UI tests)');

const pw = (args: string[]) => run('npx', ['playwright', 'test', ...args]);
const unit = run('npx', ['vitest', 'run']);
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
const tailTests = Number(count(tail)) - Number(count(['--project=setup']));
if (layoutTests + tailTests <= 0) {
  console.error(`no UI tests matched ${grep}`);
  process.exit(1);
}
const first = layoutTests > 0 ? pw([...viewports, '--grep', grep]) : 0;
if (first) process.exit(first);
process.exit(tailTests > 0 ? pw(tail) : 0);
