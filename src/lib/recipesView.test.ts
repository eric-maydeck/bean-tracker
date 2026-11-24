import { describe, expect, it } from 'vitest';
import { parseRecipesView, recipesParams } from './recipesView';

const parse = (q: string) => parseRecipesView(new URLSearchParams(q));

describe('parseRecipesView', () => {
  it('reads a recipe id and a structure key (case-insensitive)', () => {
    expect(parse('brews=r12')).toEqual({ brews: { recipe: 12 } });
    expect(parse('brews=S2B-FFFS-17')).toEqual({ brews: { key: '2b-fffs-17' } });
  });
  it('accepts a 13-pour key and a 3-digit ratio', () => {
    expect(parse('brews=s2b-ffffffffffffs-120')).toEqual({ brews: { key: '2b-ffffffffffffs-120' } });
  });
  it('ignores anything else', () => {
    for (const q of ['brews=r0', 'brews=r-1', 'brews=s2b-fffz-17', 'brews=sx', 'brews=zzz', 'view=nope'])
      expect(parse(q), q).toEqual({});
  });
  it('reads view=hidden in any case', () => {
    expect(parse('view=HIDDEN')).toEqual({ view: 'hidden' });
  });
  it('reads order=top in any case and ignores other values', () => {
    expect(parse('order=TOP')).toEqual({ order: 'top' });
    expect(parse('brews=r1&order=top')).toEqual({ brews: { recipe: 1 }, order: 'top' });
    for (const q of ['order=latest', 'order=', 'order=best']) expect(parse(q), q).toEqual({});
  });
  it('round-trips and omits defaults', () => {
    for (const q of ['brews=r12', 'brews=s2b-fffs-17&view=hidden', 'view=hidden', 'brews=r3&order=top', 'brews=s1b-ss-16&order=top&view=hidden'])
      expect(recipesParams(parse(q)).toString()).toBe(q);
    expect(recipesParams(parse('')).toString()).toBe('');
    expect(recipesParams(parse('order=top')).toString()).toBe(''); // order only means something with brews=
  });
  it('reads brewnow as a lowercase slug and ignores junk', () => {
    expect(parse('brewnow=BBS')).toEqual({ brewnow: 'bbs' });
    for (const q of ['brewnow=', 'brewnow=a/b']) expect(parse(q), q).toEqual({});
  });
  it('writes brewnow next to brews and view', () => {
    expect(recipesParams({ brewnow: 'bbs' }).toString()).toBe('brewnow=bbs');
    expect(recipesParams(parse('brews=r3&view=hidden&brewnow=bbs')).toString()).toBe('brews=r3&view=hidden&brewnow=bbs');
  });
  it('reads the picker params (case-insensitive) only with brewnow, and round-trips them', () => {
    expect(parse('brewnow=bbs&bnq=%20Sey%20&bnsort=RATING&bndir=ASC&bnstatus=Backlog')).toEqual({ brewnow: 'bbs', bnq: 'Sey', bnsort: 'rating', bndir: 'asc', bnstatus: 'backlog' });
    expect(parse('bnq=sey&bnsort=name&bndir=asc&bnstatus=backlog')).toEqual({}); // no picker open: ignored
    expect(parse('brewnow=bbs&bnsort=nope&bndir=up&bnstatus=open&bnq=')).toEqual({ brewnow: 'bbs' });
    expect(recipesParams(parse('brewnow=bbs&bnstatus=backlog&bnq=sey&bnsort=grams&bndir=desc')).toString()).toBe('brewnow=bbs&bnstatus=backlog&bnq=sey&bnsort=grams&bndir=desc');
    expect(recipesParams({ bnq: 'x', bndir: 'asc' }).toString()).toBe(''); // dropped when the picker closes
    expect(parse(`brewnow=bbs&bnq=${'a'.repeat(300)}`).bnq).toHaveLength(100);
  });
});
