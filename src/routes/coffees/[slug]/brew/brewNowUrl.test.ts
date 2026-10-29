import { describe, it, expect } from 'vitest';
import { parseBrewNowView, brewNowParams } from './brewNowUrl';

const opts = { grinders: ['Alpha', 'Beta'], drippers: ['Cone'], filters: ['Paper', 'Mesh'] };
const none = { grinder: null, dripper: null, filter: null };
const u = (q: string) => new URL('http://x/coffees/a/brew?' + q);

describe('brew-now url', () => {
  it('unknown gear and why become null', () => {
    expect(parseBrewNowView(u('grinder=Nope&dripper=x&filter=y&why=bogus'), opts)).toEqual({ ...none, why: null });
    expect(parseBrewNowView(u(''), opts)).toEqual({ ...none, why: null });
  });
  it('case-insensitive match returns the canonical name', () => {
    expect(parseBrewNowView(u('grinder=bETa&filter=mesh&why=GRIND'), opts)).toEqual({
      grinder: 'Beta', dripper: null, filter: 'Mesh', why: 'grind',
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
  it('round trips', () => {
    const v = { grinder: 'Beta', dripper: 'Cone', filter: null, why: 'water' as const };
    expect(parseBrewNowView(u(brewNowParams(v, none)), opts)).toEqual(v);
  });
});
