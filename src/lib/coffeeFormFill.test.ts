import { describe, it, expect } from 'vitest';
import { afterFailedFill, suggestRest, canReplaceRest, REST_DEFAULTS, type RestHistoryRow } from './coffeeFormFill';

describe('afterFailedFill', () => {
  it('reverts to the last successfully filled URL and offers the tried one', () => {
    expect(afterFailedFill('https://b.coffee/p', 'https://a.coffee/p', 'https://saved.coffee/p')).toEqual({
      revertTo: 'https://a.coffee/p',
      offer: 'https://b.coffee/p'
    });
  });

  it("without a successful fill, reverts to the coffee's value, else empty", () => {
    expect(afterFailedFill('https://b.coffee/p', null, 'https://saved.coffee/p').revertTo).toBe('https://saved.coffee/p');
    expect(afterFailedFill('https://b.coffee/p', null, '')).toEqual({ revertTo: '', offer: 'https://b.coffee/p' });
  });

  it('offers nothing when the tried URL is what the field goes back to', () => {
    expect(afterFailedFill('https://saved.coffee/p', null, 'https://saved.coffee/p')).toEqual({
      revertTo: 'https://saved.coffee/p',
      offer: null
    });
  });
});

const r = (id: number, roaster: string, roast_level: string | null, low: number | null, high: number | null): RestHistoryRow => ({
  id, roaster, roast_level, rest_days_low: low, rest_days_high: high
});

describe('suggestRest', () => {
  it("takes the most common complete pair among this roaster's coffees at this level", () => {
    const history = [
      r(1, 'XLIII', 'Hyperlight', 180, 365), r(2, 'XLIII', 'Hyperlight', 180, 365), r(3, 'XLIII', 'Hyperlight', 180, 365),
      r(4, 'XLIII', 'Hyperlight', 70, 365), r(5, 'XLIII', 'Hyperlight', 70, 365), r(6, 'XLIII', 'Hyperlight', null, 365),
      r(7, 'XLIII', 'Ultralight', 30, 60), r(8, 'Sey', 'Hyperlight', 30, 60)
    ];
    expect(suggestRest('XLIII', 'Hyperlight', history)).toEqual({
      low: 180, high: 365, note: 'rest 180–365 from 3 of 6 XLIII Hyperlight coffees'
    });
  });

  it('says "from N" when they all agree', () => {
    const history = [r(1, 'Sey', 'Nordic', 21, 60), r(2, 'Sey', 'Nordic', 21, 60)];
    expect(suggestRest('Sey', 'Nordic', history)?.note).toBe('rest 21–60 from 2 Sey Nordic coffees');
  });

  it('breaks a tie with the newest coffee (highest id)', () => {
    expect(suggestRest('H&S', 'Ultralight', [r(1, 'H&S', 'Ultralight', 30, 90), r(2, 'H&S', 'Ultralight', 45, 120)])).toMatchObject({ low: 45, high: 120 });
    expect(suggestRest('H&S', 'Ultralight', [r(3, 'H&S', 'Ultralight', 30, 90), r(2, 'H&S', 'Ultralight', 45, 120)])).toMatchObject({ low: 30, high: 90 });
  });

  it('falls back to the roast-level default with no usable history, or no roaster', () => {
    expect(REST_DEFAULTS).toEqual({
      Hyperlight: [70, 365], Ultralight: [42, 150], 'Nordic Light': [28, 120], Nordic: [28, 90], Light: [14, 60]
    });
    expect(suggestRest('Newcomer', 'Ultralight', [])).toEqual({ low: 42, high: 150, note: 'rest 42–150 (Ultralight default)' });
    expect(suggestRest('XLIII', 'Ultralight', [r(1, 'XLIII', 'Ultralight', null, null)])?.note).toBe('rest 42–150 (Ultralight default)');
    expect(suggestRest(null, 'Hyperlight', [])).toMatchObject({ low: 70, high: 365 });
  });

  it('returns null without a roast level, or for a level with no default and no history', () => {
    expect(suggestRest('Sey', null, [])).toBeNull();
    expect(suggestRest('Sey', 'Medium', [])).toBeNull();
  });
});

describe('canReplaceRest', () => {
  it('fills when both are empty', () => expect(canReplaceRest('', '', null)).toBe(true));
  it('replaces its own untouched previous suggestion', () => expect(canReplaceRest('42', '150', { low: 42, high: 150 })).toBe(true));
  it('never touches typed or saved values, even one of the two', () => {
    expect(canReplaceRest('14', '60', null)).toBe(false);
    expect(canReplaceRest('42', '160', { low: 42, high: 150 })).toBe(false);
    expect(canReplaceRest('', '60', null)).toBe(false);
  });
});
