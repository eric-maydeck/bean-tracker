import { describe, expect, it } from 'vitest';
import { gearRedirect, parseGear, serializeGear, statsLink, type GearUrlState } from './gearUrl.ts';

describe('gear url state', () => {
  it('parses the two params; a legacy gear= is ignored', () => {
    expect(parseGear(new URLSearchParams('gear=grinder&retired=open&card=Grinder-ZP6-Special'))).toEqual({
      retired: ['dripper', 'filter', 'grinder'], card: 'grinder-zp6-special'
    });
    expect(parseGear(new URLSearchParams('gear=kettle&retired=yes'))).toEqual({});
  });
  it('reads the retired kind list in GEAR_KINDS order, dropping junk and repeats', () => {
    expect(parseGear(new URLSearchParams('retired=filter,kettle,dripper,dripper'))).toEqual({ retired: ['dripper', 'filter'] });
    expect(parseGear(new URLSearchParams('retired=,'))).toEqual({});
  });
  it('round-trips', () => {
    const states: GearUrlState[] = [{ retired: ['filter'] }, { retired: ['dripper', 'filter', 'grinder'], card: 'filter-abc' }, { card: 'grinder-zp6-special' }];
    for (const s of states) expect(parseGear(serializeGear(s))).toEqual(s);
    expect(serializeGear({}).toString()).toBe('');
  });
  it('redirects old stats gear urls, dropping the gear kind filter', () => {
    expect(gearRedirect(new URL('http://x/stats?tab=gear&period=2025&card=grinder-zp6-special&gear=grinder'))).toBe('/gear?card=grinder-zp6-special');
    expect(gearRedirect(new URL('http://x/stats?tab=gear&gear=grinder'))).toBe('/gear');
    for (const u of ['/stats?tab=gear', '/stats?tab=overview&gear=dripper', '/stats?card=x']) expect(gearRedirect(new URL('http://x' + u))).toBeNull();
  });
  it('builds stats links', () => {
    expect(statsLink({ kind: 'grinder', key: 'grinder-zp6-special', name: 'ZP6 Special' })).toBe('/stats?tab=sweetspots&grinder=zp6-special');
    expect(statsLink({ kind: 'dripper', key: 'dripper-v60', name: 'V60 02' })).toBe('/stats?dripper=V60+02');
    expect(statsLink({ kind: 'filter', key: 'filter-x', name: 'Abc & D' })).toBe('/stats?filter=Abc+%26+D');
  });
});
