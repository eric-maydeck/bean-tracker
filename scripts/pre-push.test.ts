import { describe, it, expect } from 'vitest';
import { diffRanges, gateSteps } from './pre-push.ts';

const Z = '0'.repeat(40);
const ALL = ['svelte-kit sync', 'tsc', 'svelte-check', 'vitest-changed'];
describe('diffRanges', () => {
  it('maps update, new branch and delete lines', () => {
    expect(diffRanges(`refs/heads/main abc refs/heads/main def\nrefs/heads/x 123 refs/heads/x ${Z}\n` +
      `(delete) ${Z} refs/heads/y 456\n`)).toEqual(['def..abc', 'origin/main...123']);
  });
});

describe('gateSteps', () => {
  it('docs-only push runs nothing', () => {
    expect(gateSteps({ files: ['docs/notes.md', 'README.md', 'notes/x.md'] })).toEqual([]);
  });
  it('code push runs typecheck and changed unit tests', () => {
    expect(gateSteps({ files: ['docs/a.md', 'src/lib/x.ts'] })).toEqual(ALL);
  });
  it('release push runs no ui tests', () => {
    expect(gateSteps({ files: ['src/lib/x.ts', 'tests/ui/a.spec.ts'] })).toEqual(ALL);
    expect(gateSteps({ files: ['unresolved range abc..def'] })).toEqual(ALL);
  });
});
