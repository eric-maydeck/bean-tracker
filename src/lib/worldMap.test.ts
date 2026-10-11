import { describe, it, expect } from 'vitest';
import { WORLD, WORLD_VIEWBOX } from './worldMap';
import { isoCode, COUNTRY_NAMES } from './countryFlags';

// Every origin goes through countryFlags' table, so every country in it must land on a shape:
// adding a country there without one fails here. TOO_SMALL: countries absent from Natural Earth
// 110m: microstates and small island nations too small to draw. None grows coffee commercially.
const TOO_SMALL = new Set<string>([
  'andorra',
  'antigua and barbuda',
  'bahrain',
  'barbados',
  'cabo verde',
  'cape verde',
  'comoros',
  'dominica',
  'grenada',
  'kiribati',
  'liechtenstein',
  'maldives',
  'malta',
  'marshall islands',
  'mauritius',
  'micronesia',
  'monaco',
  'nauru',
  'palau',
  'saint kitts and nevis',
  'saint lucia',
  'saint vincent and the grenadines',
  'samoa',
  'san marino',
  'sao tome and principe',
  'seychelles',
  'singapore',
  'tonga',
  'tuvalu',
  'vatican city'
]);
const ORIGINS = COUNTRY_NAMES.filter((n) => !TOO_SMALL.has(n));
const ISOS = new Set(WORLD.map((c) => c.iso));

describe('world map', () => {
  it.each(ORIGINS)('%s lands on a country shape', (o) => expect(ISOS.has(isoCode(o) ?? '?')).toBe(true));
  it('N/A is no country', () => expect(isoCode('N/A')).toBeNull());
  it('matches names loosely', () => expect(isoCode(' kenya ')).toBe('KE'));
  it('has well-formed paths and a viewBox', () => {
    expect(WORLD.length).toBeGreaterThan(150);
    for (const c of WORLD) expect(c.d).toMatch(/^M[-\d.,LMZ]+Z$/);
    expect(WORLD_VIEWBOX).toMatch(/^0 0 \d+ \d+$/);
  });
  it('no Antarctica', () => expect(ISOS.has('AQ')).toBe(false));
});
