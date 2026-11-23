import { describe, it, expect } from 'vitest';
import { parseBrewNowView, brewNowParams } from './brewNowUrl';

const opts = { grinders: ['Alpha', 'Beta'], drippers: ['Cone'], filters: ['Paper', 'Mesh'], doses: [15, 18], ratios: [16, 16.5] };
const none = { grinder: null, dripper: null, filter: null, dose: null, ratio: null };
const u = (q: string) => new URL('http://x/coffees/a/brew?' + q);

describe('brew-now url', () => {
  it('unknown gear and why become null', () => {
    expect(parseBrewNowView(u('grinder=Nope&dripper=x&filter=y&why=bogus'), opts)).toEqual({ ...none, why: null });
    expect(parseBrewNowView(u(''), opts)).toEqual({ ...none, why: null });
  });
  it('case-insensitive match returns the canonical name', () => {
    expect(parseBrewNowView(u('grinder=bETa&filter=mesh&why=GRIND'), opts)).toEqual({
      grinder: 'Beta', dripper: null, filter: 'Mesh', why: 'grind', dose: null, ratio: null,
    });
  });
  it('defaults never ride the URL', () => {
    const d = { grinder: 'Alpha', dripper: 'Cone', filter: 'Paper' };
    expect(brewNowParams({ ...d, why: null }, d)).toBe('');
    expect(brewNowParams({ grinder: null, dripper: null, filter: null, why: null }, d)).toBe('');
    expect(brewNowParams({ grinder: 'Beta', dripper: 'Cone', filter: 'Mesh', why: 'temp' }, d)).toBe(
      'grinder=Beta&filter=Mesh&why=temp',
    );
  });
  it('compares against the dripper-aware default filter', () => {
    const d = { grinder: 'Alpha', dripper: 'Cone', filter: 'Mesh' }; // Mesh is this dripper's default
    expect(brewNowParams({ grinder: 'Alpha', dripper: 'Cone', filter: 'Mesh', why: null }, d)).toBe('');
    expect(brewNowParams({ grinder: 'Alpha', dripper: 'Cone', filter: 'Paper', why: null }, d)).toBe('filter=Paper');
  });
  it('round trips', () => {
    const v = { grinder: 'Beta', dripper: 'Cone', filter: null, why: 'water' as const, dose: 18, ratio: 16.5 };
    expect(parseBrewNowView(u(brewNowParams(v, none)), opts)).toEqual(v);
  });
  it('dose and ratio must be on the saved lists; the suggestion (default) stays out of the URL', () => {
    expect(parseBrewNowView(u('dose=18&ratio=16.5'), opts)).toMatchObject({ dose: 18, ratio: 16.5 });
    expect(parseBrewNowView(u('dose=19&ratio=x'), opts)).toMatchObject({ dose: null, ratio: null });
    const d = { grinder: 'Alpha', dripper: 'Cone', filter: 'Paper', dose: 18, ratio: 16 };
    const v = { grinder: null, dripper: null, filter: null, why: null };
    expect(brewNowParams({ ...v, dose: 18, ratio: 16 }, d)).toBe('');
    expect(brewNowParams({ ...v, dose: 15, ratio: 16.5 }, d)).toBe('dose=15&ratio=16.5');
  });
  it('reads recipe (saved slugs only), from and amounts', () => {
    const o = { ...opts, recipes: ['bbs', '4sy'] };
    expect(parseBrewNowView(u('recipe=BBS'), o).recipe).toBe('bbs');
    expect(parseBrewNowView(u('recipe=gone'), o).recipe).toBeUndefined();
    expect(parseBrewNowView(u('recipe=bbs'), opts).recipe).toBeUndefined();
    expect(parseBrewNowView(u('from=recipe'), opts).from).toBe('recipe');
    expect(parseBrewNowView(u('from=x'), opts).from).toBeUndefined();
    expect(parseBrewNowView(u('amounts=POUR'), opts).amounts).toBe('pour');
    expect(parseBrewNowView(u('amounts=x'), opts).amounts).toBeUndefined();
  });
  it('writes a chosen recipe even when it is the suggested one (sticky); from and amounts when set', () => {
    const d = { grinder: 'Alpha', dripper: 'Cone', filter: 'Paper', recipe: 'bbs' };
    const v = { grinder: null, dripper: null, filter: null, why: null, recipe: 'bbs', from: null, amounts: null };
    expect(brewNowParams(v, d)).toBe('recipe=bbs');
    expect(brewNowParams(v, { ...d, recipe: '4sy' })).toBe('recipe=bbs');
    expect(brewNowParams({ ...v, recipe: null }, d)).toBe(''); // no choice: bare URL follows the suggestion
    expect(brewNowParams({ ...v, from: 'recipe', amounts: 'pour' }, d)).toBe('recipe=bbs&from=recipe&amounts=pour');
  });
  it('round trips the recipe fields', () => {
    const o = { ...opts, recipes: ['bbs', '4sy'] };
    const v = { grinder: null, dripper: null, filter: null, why: null, dose: null, ratio: null, recipe: 'bbs', from: 'recipe' as const, amounts: 'pour' as const };
    expect(parseBrewNowView(u(brewNowParams(v, { ...none, recipe: '4sy' })), o)).toEqual(v);
  });
});
