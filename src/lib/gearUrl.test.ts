import { describe, expect, it } from 'vitest';
import { gearRedirect, parseGear, serializeGear, statsLink, type GearUrlState } from './gearUrl.ts';

describe('gear url state', () => {
  it('parses the three params', () => {
    expect(parseGear(new URLSearchParams('gear=grinder&retired=open&card=Grinder-ZP6-Special'))).toEqual({
      gear: ['grinder'], retired: ['dripper', 'filter', 'grinder'], card: 'grinder-zp6-special'
    });
    expect(parseGear(new URLSearchParams('gear=kettle&retired=yes'))).toEqual({});
  });
  it('reads kind lists in GEAR_KINDS order, dropping junk and repeats; all three kinds is the default', () => {
    expect(parseGear(new URLSearchParams('gear=Grinder,kettle,dripper,dripper&retired=filter,dripper')))
      .toEqual({ gear: ['dripper', 'grinder'], retired: ['dripper', 'filter'] });
    expect(parseGear(new URLSearchParams('gear=grinder,filter,dripper'))).toEqual({});
    expect(parseGear(new URLSearchParams('gear=&retired=,'))).toEqual({});
  });
  it('round-trips', () => {
    const states: GearUrlState[] = [{ gear: ['dripper'] }, { gear: ['dripper', 'grinder'], retired: ['filter'] }, { retired: ['dripper', 'filter', 'grinder'], card: 'filter-abc' }, { gear: ['grinder'], retired: ['grinder'], card: 'grinder-zp6-special' }];
    for (const s of states) expect(parseGear(serializeGear(s))).toEqual(s);
    expect(serializeGear({}).toString()).toBe('');
    expect(serializeGear({ gear: ['dripper', 'filter', 'grinder'] }).toString()).toBe('');
  });
  it('redirects old stats gear urls', () => {
    expect(gearRedirect(new URL('http://x/stats?tab=gear&period=2025&card=grinder-zp6-special&gear=grinder'))).toBe('/gear?gear=grinder&card=grinder-zp6-special');
    for (const u of ['/stats?tab=gear', '/stats?tab=overview&gear=dripper', '/stats?card=x']) expect(gearRedirect(new URL('http://x' + u))).toBeNull();
  });
  it('builds stats links', () => {
    expect(statsLink({ kind: 'grinder' })).toBe('/stats?tab=gear&gearBy=grinder#gear-eras');
    expect(statsLink({ kind: 'dripper' })).toBe('/stats?tab=gear#gear-drippers');
    expect(statsLink({ kind: 'filter' })).toBe('/stats?tab=gear#gear-filters');
  });
});
