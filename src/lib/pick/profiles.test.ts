import { describe, expect, it } from 'vitest';
import { cleanName, parseProfiles } from './profiles';
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
  });
});
