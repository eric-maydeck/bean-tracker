import { describe, it, expect } from 'vitest';
import { loadInsightsState, serializeInsightsState } from './insightsMemory';
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
