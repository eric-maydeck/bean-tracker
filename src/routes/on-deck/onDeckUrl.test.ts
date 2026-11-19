import { describe, it, expect } from 'vitest';
import { onDeckParams, parseDefaultRules, parseGame, parseOnDeckView, parseProfile } from './onDeckUrl';

const p = (q: string) => new URLSearchParams(q);

describe('on-deck view param', () => {
  it('only the non-default view is explicit', () => {
    expect(parseOnDeckView(p('view=next'))).toBe('next');
    expect(parseOnDeckView(p('view=NEXT'))).toBe('next');
    expect(parseOnDeckView(p('view=open'))).toBeUndefined(); // the default never rides the URL
    expect(parseOnDeckView(p('view=bogus'))).toBeUndefined();
    expect(parseOnDeckView(p(''))).toBeUndefined();
  });
  it('pick view and game', () => {
    expect(parseOnDeckView(p('view=pick'))).toBe('pick');
    expect(parseOnDeckView(p('view=PICK'))).toBe('pick');
    expect(parseGame(p('game=d20'))).toBe('d20');
    expect(parseGame(p('game=wheel'))).toBeUndefined();
    expect(parseGame(p('game=bogus'))).toBeUndefined();
    expect(parseGame(p(''))).toBeUndefined();
    expect(onDeckParams({ view: 'pick', game: 'd20' }).toString()).toBe('view=pick&game=d20');
    expect(onDeckParams({ view: 'next', game: 'd20' }).toString()).toBe('view=next');
    expect(onDeckParams({ game: 'd20' }).toString()).toBe('');
  });
  it('round trip, kept alongside show', () => {
    expect(onDeckParams({ show: 'decaf', view: 'next' }).toString()).toBe('show=decaf&view=next');
    expect(onDeckParams({ view: 'next' }).toString()).toBe('view=next');
    expect(onDeckParams({ show: 'all' }).toString()).toBe('show=all');
    expect(onDeckParams({}).toString()).toBe('');
  });
  it('profile: trimmed, case kept, empty or too long ignored, only written with the pick view', () => {
    expect(parseProfile(p('profile=Morning'))).toBe('Morning');
    expect(parseProfile(p('profile=%20Morning%20'))).toBe('Morning');
    expect(parseProfile(p('profile=Dark+Roast+%26+Co'))).toBe('Dark Roast & Co');
    expect(parseProfile(p('profile='))).toBeUndefined();
    expect(parseProfile(p('profile=%20%20'))).toBeUndefined();
    expect(parseProfile(p('profile=' + 'a'.repeat(61)))).toBeUndefined();
    expect(parseProfile(p('profile=' + 'a'.repeat(60)))).toBe('a'.repeat(60));
    expect(parseProfile(p(''))).toBeUndefined();
    expect(onDeckParams({ view: 'pick', game: 'd20', profile: 'Dark & Co' }).toString()).toBe('view=pick&game=d20&profile=Dark+%26+Co');
    expect(onDeckParams({ view: 'pick', profile: 'A' }).toString()).toBe('view=pick&profile=A');
    expect(onDeckParams({ view: 'next', profile: 'A' }).toString()).toBe('view=next');
    expect(onDeckParams({ profile: 'A' }).toString()).toBe('');
  });
  it('rules=default: only that value, only with the pick view, a profile wins', () => {
    expect(parseDefaultRules(p('rules=default'))).toBe(true);
    expect(parseDefaultRules(p('rules=DEFAULT'))).toBe(true);
    expect(parseDefaultRules(p('rules=other'))).toBe(false);
    expect(parseDefaultRules(p(''))).toBe(false);
    expect(onDeckParams({ view: 'pick', game: 'd20', defaultRules: true }).toString()).toBe('view=pick&game=d20&rules=default');
    expect(onDeckParams({ view: 'pick', profile: 'A', defaultRules: true }).toString()).toBe('view=pick&profile=A');
    expect(onDeckParams({ view: 'next', defaultRules: true }).toString()).toBe('view=next');
  });
});
