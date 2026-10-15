import { describe, it, expect } from 'vitest';
import { diffRanges } from './pre-push.ts';

const Z = '0'.repeat(40);
describe('diffRanges', () => {
  it('maps update, new branch and delete lines', () => {
    expect(diffRanges(`refs/heads/main abc refs/heads/main def\nrefs/heads/x 123 refs/heads/x ${Z}\n` +
      `(delete) ${Z} refs/heads/y 456\n`)).toEqual(['def..abc', 'origin/main...123']);
  });
});
