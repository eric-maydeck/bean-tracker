import { describe, expect, it } from 'vitest';
import { gearRedirect, parseGear, serializeGear, statsLink, type GearUrlState } from './gearUrl.ts';

describe('gear url state', () => {
  it('parses the three params', () => {
    expect(parseGear(new URLSearchParams('gear=grinder&retired=open&card=Grinder-ZP6-Special'))).toEqual({
      gear: 'grinder', retired: 'open', card: 'grinder-zp6-special'
    });
    expect(parseGear(new URLSearchParams('gear=kettle&retired=yes'))).toEqual({});
  });
  it('round-trips', () => {
    const states: GearUrlState[] = [{ gear: 'dripper' }, { retired: 'open', card: 'filter-abc' }, { gear: 'grinder', retired: 'open', card: 'grinder-zp6-special' }];
    for (const s of states) expect(parseGear(serializeGear(s))).toEqual(s);
    expect(serializeGear({}).toString()).toBe('');
  });
  it('redirects old stats gear urls', () => {
    expect(gearRedirect(new URL('http://x/stats?tab=gear&period=2025&card=grinder-zp6-special&gear=grinder'))).toBe('/gear?gear=grinder&card=grinder-zp6-special');
    for (const u of ['/stats?tab=gear', '/stats?tab=overview&gear=dripper', '/stats?card=x']) expect(gearRedirect(new URL('http://x' + u))).toBeNull();
  });
  it('builds stats links', () => {
    expect(statsLink({ kind: 'grinder', key: 'grinder-zp6-special', name: 'ZP6 Special' })).toBe('/stats?tab=gear&grinder=zp6-special');
    expect(statsLink({ kind: 'dripper', key: 'dripper-v60', name: 'V60 02' })).toBe('/stats?tab=gear&dripper=V60+02');
    expect(statsLink({ kind: 'filter', key: 'filter-x', name: 'Abc & D' })).toBe('/stats?tab=gear&filter=Abc+%26+D');
  });
});
