import { describe, it, expect } from 'vitest';
import { loadChoice, serializeChoice, CHOICE_TTL_MS } from './rememberedChoice';

const now = 1_000_000_000_000;
describe('remembered choice', () => {
  it('round-trips within 12h', () => {
    expect(loadChoice(serializeChoice('list', now), ['compact', 'list'] as const, now + 5)).toBe('list');
  });
  it('expires after 12h', () => {
    expect(loadChoice(serializeChoice('list', now), ['compact', 'list'] as const, now + CHOICE_TTL_MS + 1)).toBeUndefined();
  });
  it('never expires with ttlMs = Infinity', () => {
    const yearLater = now + 365 * 24 * 60 * 60 * 1000;
    expect(loadChoice(serializeChoice('list', now), ['compact', 'list'] as const, yearLater, Infinity)).toBe('list');
  });
  it('rejects values outside the allowed list and garbage', () => {
    expect(loadChoice(serializeChoice('grid', now), ['compact', 'list'] as const, now)).toBeUndefined();
    expect(loadChoice('list', ['compact', 'list'] as const, now)).toBeUndefined(); // legacy bare value
    expect(loadChoice(null, ['compact', 'list'] as const, now)).toBeUndefined();
  });
});
