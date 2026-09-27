import { describe, it, expect } from 'vitest';
import { toParams, fromParams, isUntouched, loadViewState, serializeViewState, VIEW_TTL_MS, type CoffeeViewState } from './coffeeViewState';
import type { Filter } from './coffeeFilters';

const roundTrip = (s: CoffeeViewState, known?: Parameters<typeof fromParams>[1]) =>
  fromParams(new URLSearchParams(toParams(s).toString()), known);

describe('toParams', () => {
  it('omits untouched fields entirely', () => {
    expect(toParams({ filters: [] }).toString()).toBe('');
    expect(toParams({ query: '', filters: [] }).toString()).toBe('');
  });
  it('writes explicit choices even when they equal a default', () => {
    const p = toParams({ status: 'backlog', view: 'compact', sort: { key: 'urgency', dir: 'desc' }, filters: [] });
    expect(p.get('status')).toBe('backlog');
    expect(p.get('view')).toBe('compact');
    expect(p.get('sort')).toBe('urgency.desc');
  });
  it('encodes every filter mode', () => {
    const filters: Filter[] = [
      { column: 'processing', mode: 'any', values: ['Washed', null] },
      { column: 'coffee_name', mode: 'contains', text: 'gesha' },
      { column: 'decaf', mode: 'bool', value: false },
      { column: 'roast_date', mode: 'range', op: '>=', a: '2026-09-01', b: '' },
      { column: 'cost_per_gram', mode: 'range', op: 'between', a: '0.1', b: '0.3' },
      { column: 'rest_window', mode: 'includes', a: '14' }
    ];
    const p = toParams({ filters });
    expect(p.getAll('processing')).toEqual(['Washed', '(none)']);
    expect(p.get('coffee_name')).toBe('~gesha');
    expect(p.get('decaf')).toBe('false');
    expect(p.get('roast_date')).toBe('>=2026-09-01');
    expect(p.get('cost_per_gram')).toBe('between:0.1..0.3');
    expect(p.get('rest_window')).toBe('includes:14');
    expect(toParams({ filters: [{ column: 'rest_window', mode: 'overlaps', a: '10', b: '20' }] }).get('rest_window')).toBe('overlaps:10..20');
  });
});

describe('fromParams', () => {
  it('round-trips a full state', () => {
    const s: CoffeeViewState = {
      status: 'archive', query: 'lume coffee', sort: { key: 'roast_date', dir: 'asc' }, view: 'list',
      filters: [
        { column: 'origin', mode: 'any', values: [null] },
        { column: 'processing', mode: 'any', values: ['Washed', 'Natural'] },
        { column: 'decaf', mode: 'bool', value: true },
        { column: 'roast_date', mode: 'range', op: 'between', a: '2026-09-01', b: '2026-09-10' }
      ]
    };
    expect(roundTrip(s)).toEqual(s);
  });
  it('escapes values that look like syntax', () => {
    const s: CoffeeViewState = { filters: [{ column: 'coffee_name', mode: 'any', values: ['~tilde', '\\slash', '(none)', 'a..b: c & d'] }] };
    expect(roundTrip(s)).toEqual(s);
  });
  it('maps any-values case-insensitively onto known values', () => {
    const s = fromParams(new URLSearchParams('processing=washed&processing=Mystery'), { processing: ['Washed', 'Natural'] });
    expect(s.filters).toEqual([{ column: 'processing', mode: 'any', values: ['Washed', 'Mystery'] }]);
  });
  it('accepts case-insensitive keywords', () => {
    const s = fromParams(new URLSearchParams('status=Archive&view=LIST&sort=Roast_Date.DESC&decaf=TRUE'));
    expect(s.status).toBe('archive');
    expect(s.view).toBe('list');
    expect(s.sort).toEqual({ key: 'roast_date', dir: 'desc' });
    expect(s.filters).toEqual([{ column: 'decaf', mode: 'bool', value: true }]);
  });
  it('ignores unknown and invalid params', () => {
    const s = fromParams(new URLSearchParams('status=nope&view=grid&sort=bogus.asc&edit=1&expanded=5&decaf=maybe&roast_date=soon&cost_per_gram=between:1&rest_window=near:3&zzz=1'));
    expect(s).toEqual({ filters: [] });
    expect(isUntouched(s)).toBe(true);
  });
});

describe('persistence', () => {
  const now = 1_000_000_000_000;
  it('round-trips within the TTL and expires after it', () => {
    const s: CoffeeViewState = { view: 'cards', status: 'open', filters: [{ column: 'decaf', mode: 'bool', value: false }] };
    const raw = serializeViewState(s, now);
    expect(loadViewState(raw, now + 1000)).toEqual(s);
    expect(loadViewState(raw, now + VIEW_TTL_MS + 1)).toEqual({ filters: [] });
  });
  it('drops invalid saved entries and garbage', () => {
    expect(loadViewState('not json', now)).toEqual({ filters: [] });
    expect(loadViewState(null, now)).toEqual({ filters: [] });
    const raw = JSON.stringify({ version: 2, lastUsed: now, params: 'view=grid&status=x&origin=>1' });
    expect(loadViewState(raw, now)).toEqual({ filters: [{ column: 'origin', mode: 'any', values: ['>1'] }] });
  });
});
