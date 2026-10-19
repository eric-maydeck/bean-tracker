import { describe, it, expect } from 'vitest';
import { profileFor, shotsOn } from './uiProfile.ts';
import { ALL_VIEWPORTS, pickViewports } from '../tests/ui/viewports.ts';

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

describe('shotsOn', () => {
  it('is off unless UI_SHOTS=all', () => {
    expect(shotsOn(undefined)).toBe(false);
    expect(shotsOn('')).toBe(false);
    expect(shotsOn('off')).toBe(false);
    expect(shotsOn('all')).toBe(true);
  });
  it('rejects unknown values', () => expect(() => shotsOn('on')).toThrow(/Unknown UI_SHOTS "on"/));
});

describe('pickViewports', () => {
  it('runs every viewport when unset', () => {
    expect(pickViewports(undefined)).toBe(ALL_VIEWPORTS);
    expect(pickViewports('')).toBe(ALL_VIEWPORTS);
  });
  it('keeps the listed names, in ALL_VIEWPORTS order', () => {
    expect(pickViewports('w1280, phone-portrait').map((v) => v.name)).toEqual(['w1280', 'phone-portrait']);
  });
  it('rejects unknown names and empty lists', () => {
    expect(() => pickViewports('w1280,w999')).toThrow(/Unknown UI_VIEWPORTS/);
    expect(() => pickViewports(',')).toThrow(/Unknown UI_VIEWPORTS/);
  });
});
