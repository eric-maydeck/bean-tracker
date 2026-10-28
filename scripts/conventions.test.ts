// Grep-based repo rules that used to be prose in docs/gotchas. One failure line per violation.
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

function walk(dir: string, match: (f: string) => boolean): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = join(dir, e.name);
    return e.isDirectory() ? walk(p, match) : match(p) ? [p] : [];
  });
}

/** `file:line` of every non-comment line in tests/ui matching `re`. */
function uiTestHits(re: RegExp): string[] {
  return walk('tests/ui', (f) => f.endsWith('.ts')).flatMap((f) =>
    readFileSync(f, 'utf8').split('\n').flatMap((l, i) =>
      re.test(l) && !l.trim().startsWith('//') ? [`${f}:${i + 1}`] : []));
}

describe('conventions', () => {
  it('no networkidle in tests/ui (use gotoReady/reloadReady)', () => {
    expect(uiTestHits(/networkidle/)).toEqual([]);
  });

  it('no console.log in tests/ui', () => {
    expect(uiTestHits(/console\.log\(/)).toEqual([]);
  });

  it('every src/routes/api/**/+server.ts has a sibling authGate.test.ts', () => {
    const missing = walk('src/routes/api', (f) => f.endsWith('/+server.ts'))
      .map((f) => f.replace('+server.ts', 'authGate.test.ts'))
      .filter((t) => !existsSync(t));
    expect(missing).toEqual([]);
  });

  it('no seeded recipe names in src (tests and fixtures excepted)', () => {
    const hits = walk('src', (f) => /\.(ts|svelte)$/.test(f) && !f.endsWith('.test.ts') && !f.includes('/fixtures/')).filter(
      (f) => /\b(BBS|BBJ|BBF|4SY|5SY)\b/.test(readFileSync(f, 'utf8'))
    );
    expect(hits).toEqual([]);
  });

  it('no personal vocabulary (yeet, melodrip) in src (tests and fixtures excepted)', () => {
    const hits = walk('src', (f) => /\.(ts|svelte)$/.test(f) && !f.endsWith('.test.ts') && !f.includes('/fixtures/') && f !== 'src/lib/server/recipes.ts').filter(
      (f) => /\b(yeets?|melodrip)\b/i.test(readFileSync(f, 'utf8'))
    );
    expect(hits).toEqual([]);
  });
});
