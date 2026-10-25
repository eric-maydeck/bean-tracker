import { describe, it, expect } from 'vitest';
import { WORLD, WORLD_VIEWBOX } from './worldMap';
import { WORLD as WORLD50, WORLD_VIEWBOX as VIEWBOX50 } from './worldMap50';
import { isoCode, COUNTRY_NAMES } from './countryFlags';

// Every origin goes through countryFlags' table, so every country in it must land on a shape:
// adding a country there without one fails here. TOO_SMALL: too small for Natural Earth 110m;
// listed, not mapped (several do grow coffee).
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

const key = (c: { iso: string; name: string }) => c.iso || c.name;
const bbox = (d: string) => {
  const n = (d.match(/-?\d+(\.\d+)?/g) ?? []).map(Number);
  const xs = n.filter((_, i) => i % 2 === 0);
  const ys = n.filter((_, i) => i % 2 === 1);
  return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
};

describe('world maps', () => {
  it('share one viewBox', () => expect(VIEWBOX50).toBe(WORLD_VIEWBOX));
  it('have unique keys per file', () => {
    for (const w of [WORLD, WORLD50]) expect(new Set(w.map(key)).size).toBe(w.length);
  });
  it('50m has every 110m key', () => {
    const k50 = new Set(WORLD50.map(key));
    expect(WORLD.map(key).filter((k) => !k50.has(k))).toEqual([]);
  });
  it.each(['ET', 'RW', 'SV', 'BR', 'CO'])('%s bbox aligns across resolutions', (iso) => {
    const a = bbox(WORLD.find((c) => c.iso === iso)!.d);
    const b = bbox(WORLD50.find((c) => c.iso === iso)!.d);
    expect(Math.abs((a[0] + a[2]) / 2 - (b[0] + b[2]) / 2)).toBeLessThanOrEqual(1);
    expect(Math.abs((a[1] + a[3]) / 2 - (b[1] + b[3]) / 2)).toBeLessThanOrEqual(1);
    a.forEach((v, i) => expect(Math.abs(v - b[i])).toBeLessThanOrEqual(3));
  });
});
