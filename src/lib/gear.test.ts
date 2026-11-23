import { describe, it, expect } from 'vitest';
import { GEAR_KINDS, fieldsFor, parseGearValues, OWN_DATA_ONLY, shownTrophies, topSpecs, type GearKind } from './gear';

const t = (kind: GearKind, name: string, key: string, retired = false) => ({ kind, name, key, retired });
const list = [t('dripper', 'V60', 'dripper-v60'), t('dripper', 'Old', 'dripper-old', true), t('grinder', 'ZP6', 'grinder-zp6', true), t('filter', 'Abaca', 'filter-abaca')];

describe('shownTrophies', () => {
  it('retired cards go to the shelf', () => {
    const r = shownTrophies(list);
    expect(r.active.map((x) => x.key)).toEqual(['dripper-v60', 'filter-abaca']);
    expect(r.retired.map((x) => x.key)).toEqual(['dripper-old', 'grinder-zp6']);
  });
});

describe('parseGearValues', () => {
  it('keeps known keys, trims, drops blanks and unknown keys', () => {
    expect(parseGearValues('dripper', { brand: ' Hario ', shape: '', bogus: 'x', coneAngle: '60' }))
      .toEqual({ values: { brand: 'Hario', coneAngle: 60 } });
  });
  it('money rounds to cents; numbers respect their range', () => {
    expect(parseGearValues('grinder', { cost: '199.999', burrSize: '48' })).toEqual({ values: { cost: 200, burrSize: 48 } });
    expect(parseGearValues('grinder', { burrSize: '500' })).toEqual({ error: 'Burr size must be 10–150mm' });
    expect(parseGearValues('grinder', { burrSize: 'abc' })).toEqual({ error: 'Burr size must be 10–150mm' });
  });
  it('website must be http(s)', () => {
    expect(parseGearValues('filter', { website: 'javascript:alert(1)' })).toEqual({ error: "Official website isn't a web address" });
    expect(parseGearValues('filter', { website: 'https://a.co/x' })).toEqual({ values: { website: 'https://a.co/x' } });
  });
  it('text is capped at 120 characters and the input must be an object', () => {
    expect(parseGearValues('filter', { brand: 'x'.repeat(121) })).toEqual({ error: 'Brand is too long (120 characters at most)' });
    expect(parseGearValues('filter', { brand: 'x'.repeat(120) })).toHaveProperty('values');
    expect(parseGearValues('filter', null)).toEqual({ error: 'Details must be an object' });
  });
  it('every kind has its own fields on top of the common ones', () => {
    expect(fieldsFor('grinder').map((f) => f.key)).toContain('burrSize');
    expect(fieldsFor('filter').map((f) => f.key)).not.toContain('burrSize');
    for (const k of GEAR_KINDS) expect(fieldsFor(k).slice(0, 4).map((f) => f.key)).toEqual(['brand', 'website', 'model', 'cost']);
  });
  it('adjustment is a select; the step size is kept only on a Stepped grinder', () => {
    expect(parseGearValues('grinder', { adjustment: 'Stepped', stepSize: '12' })).toEqual({ values: { adjustment: 'Stepped', stepSize: 12 } });
    expect(parseGearValues('grinder', { adjustment: 'Stepless', stepSize: '12' })).toEqual({ values: { adjustment: 'Stepless' } });
    expect(parseGearValues('grinder', { stepSize: '12' })).toEqual({ values: {} });
    expect(parseGearValues('grinder', { adjustment: 'Clicky' })).toEqual({ error: 'Adjustment must be one of Stepped, Stepless' });
  });
});

describe('ownData', () => {
  it('is a select on dripper and filter only', () => {
    expect(parseGearValues('dripper', { ownData: OWN_DATA_ONLY })).toEqual({ values: { ownData: OWN_DATA_ONLY } });
    expect('error' in parseGearValues('filter', { ownData: 'bogus' })).toBe(true);
    expect(parseGearValues('grinder', { ownData: OWN_DATA_ONLY })).toEqual({ values: {} });
  });
});

describe('grinder RPM', () => {
  const conv = { rpmConvert: 'Yes', dialMin: 1, dialMax: 9, rpmMin: 200, rpmMax: 1700 };
  it('keeps a full dial conversion', () => {
    expect(parseGearValues('grinder', conv)).toEqual({ values: conv });
  });
  it('requires every conversion field and a dial max above the min', () => {
    expect(parseGearValues('grinder', { ...conv, rpmMax: '' })).toEqual({ error: 'Speed at dial max is required to convert the dial to RPM' });
    expect(parseGearValues('grinder', { ...conv, dialMin: 1, dialMax: 1 })).toEqual({ error: 'Dial max must be above dial min' });
  });
  it('drops the dial fields unless converting, and rpm on a hand grinder', () => {
    expect(parseGearValues('grinder', { ...conv, rpmConvert: 'No' })).toEqual({ values: { rpmConvert: 'No' } });
    expect(parseGearValues('grinder', { type: 'Hand', rpm: 60 })).toEqual({ values: { type: 'Hand' } });
    expect(parseGearValues('grinder', { type: 'Electric', rpm: 60 })).toEqual({ values: { type: 'Electric', rpm: 60 } });
  });
  it('fieldsFor shows rpm or the conversion set by adjustable speed', () => {
    const keys = (o?: { adjustableSpeed?: boolean }) => fieldsFor('grinder', o).map((f) => f.key);
    expect(keys({ adjustableSpeed: true })).toContain('rpmConvert');
    expect(keys({ adjustableSpeed: true })).not.toContain('rpm');
    expect(keys()).toContain('rpm');
    expect(keys()).not.toContain('rpmConvert');
  });
  it('pairs each dial value with its RPM on one two-column form row', () => {
    const keys = fieldsFor('grinder', { adjustableSpeed: true }).map((f) => f.key);
    for (const [dial, rpm] of [['dialMin', 'rpmMin'], ['dialMax', 'rpmMax']]) {
      expect(keys.indexOf(dial) % 2).toBe(0);
      expect(keys.indexOf(rpm)).toBe(keys.indexOf(dial) + 1);
    }
  });
});

describe('topSpecs', () => {
  it('leads with the brand and skips the model (the name carries it)', () => {
    const rows = topSpecs({ kind: 'dripper', adjustableSpeed: false, values: { model: 'V60 Ceramic', brand: 'Hario' } }, 3);
    expect(rows[0][0]).toBe('Brand');
    expect(rows.map(([l]) => l)).not.toContain('Model');
  });
});
