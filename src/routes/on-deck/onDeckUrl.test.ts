import { describe, it, expect } from 'vitest';
import { onDeckParams, parseGame, parseOnDeckView } from './onDeckUrl';

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
});
