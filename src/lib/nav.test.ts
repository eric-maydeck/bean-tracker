import { describe, expect, it } from 'vitest';
import { MAIN_ROWS, isCurrent, panelFor, statsGroups, statsViewHref, icon } from './nav';

describe('nav model', () => {
  it('panelFor opens the stats panel only on /stats', () => {
    expect(panelFor('/stats')).toBe('stats');
    expect(panelFor('/coffees')).toBe('main');
    expect(panelFor('/statsx')).toBe('main');
  });
  it('isCurrent counts a recipe page as Recipes', () => {
    expect(isCurrent('/recipes', '/recipes/v60-hoffmann')).toBe(true);
    expect(isCurrent('/stats', '/coffees')).toBe(false);
  });
  it('statsViewHref swaps the remembered tab', () => {
    expect(statsViewHref('habits', 'tab=gear&range=1w')).toBe('/stats?tab=habits&range=1w');
    expect(statsViewHref('habits', null)).toBe('/stats?tab=habits');
    expect(statsViewHref('overview', null)).toBe('/stats?tab=overview');
    expect(statsViewHref('overview', 'tab=gear')).toBe('/stats?tab=overview');
    const r = statsViewHref('overview', 'range=1w');
    expect(r).toContain('range=1w');
    expect(r).not.toContain('tab=gear');
  });
  it('statsGroups shows Recaps only when asked', () => {
    expect(statsGroups(false).some((g) => g.label === 'Recaps')).toBe(false);
    expect(statsGroups(true).at(-1)?.label).toBe('Recaps');
  });
  it('MAIN_ROWS order and children', () => {
    expect(MAIN_ROWS.map((r) => r.label)).toEqual(['Coffees', 'On Deck', 'Subscriptions', 'Stats', 'Gear', 'Water', 'Recipes']);
    expect(MAIN_ROWS.filter((r) => r.children).map((r) => r.label)).toEqual(['Stats']);
  });
  it('icon picks the fill variant when current', () => {
    const gear = MAIN_ROWS.find((r) => r.label === 'Gear')!;
    expect(icon(gear, true)).toBe('gear-fill');
    expect(icon(gear, false)).toBe('gear');
  });
});
