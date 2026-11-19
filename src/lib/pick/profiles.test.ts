import { describe, expect, it } from 'vitest';
import { cleanName, parseProfiles, restoreSelected } from './profiles';
import { DEFAULT_RULES } from './rules';

describe('pick profiles', () => {
  it('migrates the old saved copy to a profile named Saved, only when no profiles exist', () => {
    expect(parseProfiles(null, { sort: 'name' }).Saved.sort).toBe('name');
    expect(parseProfiles(null, null)).toEqual({});
    expect(parseProfiles({}, { sort: 'name' })).toEqual({});
  });
  it('parses each profile per field, drops bad names and junk', () => {
    const p = parseProfiles({ Morning: { sort: 'name' }, '': {}, ['x'.repeat(41)]: {}, ' pad ': {}, Bad: 5 });
    expect(Object.keys(p).sort()).toEqual(['Bad', 'Morning']);
    expect(p.Morning.sort).toBe('name');
    expect(p.Bad).toEqual(DEFAULT_RULES);
    expect(parseProfiles('junk')).toEqual({});
    expect(parseProfiles([1])).toEqual({});
  });
  it('cleanName trims and bounds 1-40', () => {
    expect(cleanName('  Weekend ')).toBe('Weekend');
    expect(cleanName('   ')).toBeNull();
    expect(cleanName('a'.repeat(40))).toBe('a'.repeat(40));
    expect(cleanName('a'.repeat(41))).toBeNull();
    expect(cleanName('__proto__')).toBeNull();
    expect(Object.keys(parseProfiles(JSON.parse('{"__proto__":{},"Ok":{}}')))).toEqual(['Ok']);
  });
});

describe('restoreSelected', () => {
  const mine = { ...DEFAULT_RULES, sort: 'name' as const };
  const profiles = { Mine: mine, Other: DEFAULT_RULES };
  it('keeps a profile that exists and whose rules equal the restored rules', () => {
    expect(restoreSelected('Mine', profiles, mine)).toBe('Mine');
    expect(restoreSelected('Other', profiles, DEFAULT_RULES)).toBe('Other');
  });
  it('drops it when the rules changed since, or the profile was renamed or deleted', () => {
    expect(restoreSelected('Mine', profiles, { ...mine, includeDecaf: true })).toBe('');
    expect(restoreSelected('Mine', profiles, DEFAULT_RULES)).toBe('');
    expect(restoreSelected('Mine', { Renamed: mine }, mine)).toBe('');
    expect(restoreSelected('Mine', {}, mine)).toBe('');
  });
  it('treats nothing stored, garbage and prototype names as no selection', () => {
    for (const v of [null, undefined, '', 5, {}, ['Mine'], '__proto__', 'constructor', 'toString']) expect(restoreSelected(v, profiles, mine)).toBe('');
  });
});
