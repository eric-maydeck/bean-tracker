import { describe, it, expect } from 'vitest';
import { loadInsightsState, serializeInsightsState, withoutDeepLinks } from './insightsMemory';
import { CHOICE_TTL_MS } from './rememberedChoice';

describe('remembered /insights state', () => {
  const t0 = 1_760_000_000_000;
  it('round-trips the query string', () =>
    expect(loadInsightsState(serializeInsightsState('range=1w&tab=habits', t0), t0 + 1000)).toBe('range=1w&tab=habits'));
  it('12 h since last use, then gone', () => {
    const raw = serializeInsightsState('dial=all', t0);
    expect(loadInsightsState(raw, t0 + CHOICE_TTL_MS)).toBe('dial=all');
    expect(loadInsightsState(raw, t0 + CHOICE_TTL_MS + 1)).toBeNull();
  });
  it('loadInsightsState rejects broken, old-version, empty and odd shapes', () => {
    for (const raw of [null, '', '{', 'null', '[]', '"x"', JSON.stringify({ version: 0, params: 'a=b', lastUsed: t0 }),
      JSON.stringify({ version: 1, params: '', lastUsed: t0 }), JSON.stringify({ version: 1, params: 5, lastUsed: t0 }),
      JSON.stringify({ version: 1, params: 'a=b' })])
      expect(loadInsightsState(raw, t0)).toBeNull();
  });
});

describe('memory version', () => {
  it('memory v1 ignored, v2 loads', () => {
    expect(loadInsightsState(JSON.stringify({ version: 1, params: 'a=b', lastUsed: 5 }), 5)).toBeNull();
    expect(loadInsightsState(serializeInsightsState('a=b', 5), 5)).toBe('a=b');
  });
});

describe('withoutDeepLinks', () => {
  it('drops card= and chart=', () => {
    expect(withoutDeepLinks('tab=gear&card=grinder-niche&range=1w')).toBe('tab=gear&range=1w');
    expect(withoutDeepLinks('card=grinder-niche')).toBe('');
    expect(withoutDeepLinks('tab=gear&card=grinder-niche&chart=gear-eras&range=1w')).toBe('tab=gear&range=1w');
    expect(withoutDeepLinks('chart=x')).toBe('');
  });
});
