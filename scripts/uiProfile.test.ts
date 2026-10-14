import { describe, it, expect } from 'vitest';
import { profileFor } from './uiProfile.ts';

describe('profileFor', () => {
  it('defaults to balanced', () => {
    expect(profileFor(undefined).name).toBe('balanced');
    expect(profileFor('').name).toBe('balanced');
  });
  it('maps each profile to its priority', () => {
    expect(profileFor('performance')).toMatchObject({ nice: 0, background: false });
    expect(profileFor('balanced')).toMatchObject({ nice: 10, background: false });
    expect(profileFor('background')).toMatchObject({ background: true });
  });
  it('rejects unknown names', () => {
    expect(() => profileFor('fast')).toThrow(/Unknown UI_PROFILE "fast"/);
    expect(() => profileFor('constructor')).toThrow(/Unknown UI_PROFILE "constructor"/);
  });
});
