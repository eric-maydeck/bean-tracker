import { describe, it, expect } from 'vitest';
import { diffRanges, pushesRelease } from './pre-push.ts';

const Z = '0'.repeat(40);
describe('diffRanges', () => {
  it('maps update, new branch and delete lines', () => {
    expect(diffRanges(`refs/heads/main abc refs/heads/main def\nrefs/heads/x 123 refs/heads/x ${Z}\n` +
      `(delete) ${Z} refs/heads/y 456\n`)).toEqual(['def..abc', 'origin/main...123']);
  });
});

describe('pushesRelease', () => {
  it('is true only when a push updates refs/heads/release', () => {
    expect(pushesRelease(`refs/heads/main abc refs/heads/release def\n`)).toBe(true);
    expect(pushesRelease(`refs/heads/main abc refs/heads/main def\nrefs/heads/main abc refs/heads/release ${Z}\n`)).toBe(true);
    expect(pushesRelease(`refs/heads/main abc refs/heads/main def\n`)).toBe(false);
    expect(pushesRelease(`(delete) ${Z} refs/heads/release def\n`)).toBe(false);
    expect(pushesRelease('')).toBe(false);
  });
});
