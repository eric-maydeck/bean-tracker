import { describe, it, expect } from 'vitest';
import { pickOne, pickMany } from './pageUrlState';

const allowed = ['backlog', 'open', 'archived'] as const;
describe('pickOne', () => {
  it('is case-insensitive and whitelisted', () => {
    expect(pickOne(new URLSearchParams('show=Decaf'), 'show', ['caffeinated', 'decaf'] as const)).toBe('decaf');
    expect(pickOne(new URLSearchParams('show=all'), 'show', ['caffeinated', 'decaf'] as const)).toBeUndefined();
    expect(pickOne(new URLSearchParams(''), 'show', ['caffeinated', 'decaf'] as const)).toBeUndefined();
  });
});
describe('pickMany', () => {
  it('dedupes, drops unknowns, keeps canonical order', () => {
    expect(pickMany(new URLSearchParams('status=open&status=BACKLOG&status=x&status=open'), 'status', allowed)).toEqual(['backlog', 'open']);
  });
  it('is undefined when nothing valid', () => {
    expect(pickMany(new URLSearchParams('status=x'), 'status', allowed)).toBeUndefined();
  });
});
