// Per-issue ports and preview DB paths, so parallel worktrees don't collide.
// CLI: node scripts/ports.ts <port|uiport|db> [id]   (id: 142 or p12, p ids add 50)
import { execFileSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';

export const PREVIEW_BASE = 5173;
export const UI_BASE = 5200;

export function portFor(issue: number, base: number): number {
  return base + (issue % 100);
}

/** "142" -> 142, "p12" -> 62 (can't collide with public #12), anything else -> null. */
export function numFor(id: string | undefined): number | null {
  const m = /^(p?)(\d+)$/.exec(id ?? '');
  return m ? Number(m[2]) + (m[1] ? 50 : 0) : null;
}

/** Shared by all worktrees: resolved against the main checkout, not the current worktree. */
export function previewDbFor(issue: number | null): string {
  const common = execFileSync('git', ['rev-parse', '--path-format=absolute', '--git-common-dir']).toString().trim();
  return resolve(dirname(common), '.preview-data', issue == null ? 'prod-copy.db' : `prod-copy-${issue}.db`);
}

if (process.argv[1]?.endsWith('ports.ts')) {
  const [cmd, id] = process.argv.slice(2);
  const n = numFor(id);
  if (cmd === 'db') console.log(previewDbFor(n));
  else if (cmd === 'port') console.log(n == null ? PREVIEW_BASE + 26 : portFor(n, PREVIEW_BASE));
  else if (cmd === 'uiport') console.log(n == null ? 5198 : portFor(n, UI_BASE));
  else { console.error('usage: ports.ts <port|uiport|db> [id]'); process.exit(2); }
}
