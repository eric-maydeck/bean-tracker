import { describe, it, expect } from 'vitest';
import { parseStatsTab } from './statsTab';

const p = (q: string) => new URLSearchParams(q);

describe('parseStatsTab', () => {
  it('omits the default', () => expect(parseStatsTab(p(''))).toBeUndefined());
  it('reads tab=bq', () => expect(parseStatsTab(p('tab=bq'))).toBe('bq'));
  it('value is case-insensitive', () => expect(parseStatsTab(p('tab=BQ'))).toBe('bq'));
  it('ignores a bad value', () => expect(parseStatsTab(p('tab=nope'))).toBeUndefined());
  it('bc= alone implies bq', () => expect(parseStatsTab(p('bc=brewing'))).toBe('bq'));
  it('an explicit tab wins over bc=', () => expect(parseStatsTab(p('tab=general&bc=brewing'))).toBe('general'));
  it('a bad bc= implies nothing', () => expect(parseStatsTab(p('bc=nope'))).toBeUndefined());
});
