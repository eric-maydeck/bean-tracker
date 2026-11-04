import { describe, it, expect } from 'vitest';
import { parseAccount, accountQuery } from './accountUrl';

describe('account url state', () => {
  it('bare is capped; untracked=all opens (case-insensitive); junk is ignored', () => {
    expect(parseAccount(new URLSearchParams('')).untracked).toBeUndefined();
    expect(parseAccount(new URLSearchParams('untracked=all')).untracked).toBe('all');
    expect(parseAccount(new URLSearchParams('untracked=ALL')).untracked).toBe('all');
    expect(parseAccount(new URLSearchParams('untracked=lots')).untracked).toBeUndefined();
  });
  it('round-trips', () => {
    for (const a of [{}, { untracked: 'all' as const }]) {
      expect(parseAccount(new URLSearchParams(accountQuery(a)))).toEqual({ untracked: a.untracked });
    }
  });
});
