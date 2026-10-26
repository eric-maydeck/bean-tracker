import { describe, it, expect } from 'vitest';
import { toParams, fromParams, isUntouched, resetView, loadViewState, serializeViewState, toggleStatus, litStatuses, VIEW_TTL_MS, type CoffeeViewState } from './coffeeViewState';
import type { Filter } from './coffeeFilters';

const roundTrip = (s: CoffeeViewState, known?: Parameters<typeof fromParams>[1]) =>
  fromParams(new URLSearchParams(toParams(s).toString()), known);

describe('toParams', () => {
  it('omits untouched fields entirely', () => {
    expect(toParams({ filters: [] }).toString()).toBe('');
    expect(toParams({ query: '', filters: [] }).toString()).toBe('');
  });
  it('writes explicit choices even when they equal a default', () => {
    const p = toParams({ status: ['backlog'], view: 'compact', sort: { key: 'urgency', dir: 'desc' }, filters: [] });
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
      status: ['archive'], query: 'lume coffee', sort: { key: 'roast_date', dir: 'asc' }, view: 'list',
      filters: [
        { column: 'origin', mode: 'any', values: [null] },
        { column: 'processing', mode: 'any', values: ['Washed', 'Natural'] },
        { column: 'decaf', mode: 'bool', value: true },
        { column: 'roast_date', mode: 'range', op: 'between', a: '2026-09-01', b: '2026-09-10' }
      ]
    };
    expect(roundTrip(s)).toEqual(s);
  });
  it('round-trips the Age and Rest window state filters; neither adds anything when unset', () => {
    const s: CoffeeViewState = {
      status: ['backlog'],
      filters: [
        { column: 'age', mode: 'range', op: 'between', a: '15', b: '30' },
        { column: 'rest_state', mode: 'any', values: ['Before rest window', 'No rest window'] }
      ]
    };
    expect(toParams(s).toString()).toBe('status=backlog&age=between%3A15..30&rest_state=Before+rest+window&rest_state=No+rest+window');
    expect(roundTrip(s)).toEqual(s);
    expect(roundTrip({ filters: [{ column: 'age', mode: 'range', op: '>=', a: '91', b: '' }] }).filters).toEqual([{ column: 'age', mode: 'range', op: '>=', a: '91', b: '' }]);
    expect(toParams({ filters: [] }).toString()).toBe('');
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
    expect(s.status).toEqual(['archive']);
    expect(s.view).toBe('list');
    expect(s.sort).toEqual({ key: 'roast_date', dir: 'desc' });
    expect(s.filters).toEqual([{ column: 'decaf', mode: 'bool', value: true }]);
  });
  it('parses the date-added and date-updated sorts, round-tripping', () => {
    expect(fromParams(new URLSearchParams('sort=Created_At.DESC')).sort).toEqual({ key: 'created_at', dir: 'desc' });
    const s = fromParams(new URLSearchParams('sort=updated_at.asc'));
    expect(s.sort).toEqual({ key: 'updated_at', dir: 'asc' });
    expect(toParams(s).get('sort')).toBe('updated_at.asc');
    expect(fromParams(new URLSearchParams('sort=created_at.sideways')).sort).toBeUndefined();
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
    const s: CoffeeViewState = { view: 'cards', status: ['open'], filters: [{ column: 'decaf', mode: 'bool', value: false }] };
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

describe('bc (In Bean Conqueror)', () => {
  it('writes yes/no and omits the default', () => {
    expect(toParams({ filters: [{ column: 'bc', mode: 'bool', value: true }] }).toString()).toBe('bc=yes');
    expect(toParams({ filters: [{ column: 'bc', mode: 'bool', value: false }] }).toString()).toBe('bc=no');
    expect(toParams({ filters: [] }).has('bc')).toBe(false);
  });
  it('reads yes/no case-insensitively and ignores bad values', () => {
    expect(fromParams(new URLSearchParams('bc=YES')).filters).toEqual([{ column: 'bc', mode: 'bool', value: true }]);
    expect(fromParams(new URLSearchParams('bc=No')).filters).toEqual([{ column: 'bc', mode: 'bool', value: false }]);
    expect(fromParams(new URLSearchParams('bc=maybe')).filters).toEqual([]);
    expect(fromParams(new URLSearchParams('bc=')).filters).toEqual([]);
  });
  it('round-trips through remembered state', () => {
    const s: CoffeeViewState = { filters: [{ column: 'bc', mode: 'bool', value: false }] };
    expect(loadViewState(serializeViewState(s, 1000), 2000)).toEqual(s);
  });
});

describe('resetView', () => {
  it('keeps the status tab and clears the rest', () => {
    const s = fromParams(new URLSearchParams('status=archive&q=gesha&view=list&sort=roast_date.asc&decaf=true'));
    expect(toParams(resetView(s)).toString()).toBe('status=archive');
  });
  it('leaves the default status out of the URL', () => {
    const s = fromParams(new URLSearchParams('q=gesha&view=list'));
    expect(toParams(resetView(s)).toString()).toBe('');
    expect(isUntouched(resetView(s))).toBe(true);
  });
});

describe('multi-status', () => {
  const st = (q: string) => fromParams(new URLSearchParams(q)).status;
  it('reads repeated status params, case-insensitive, in Backlog/Open/Archive order', () => {
    expect(st('status=Open&status=BACKLOG')).toEqual(['backlog', 'open']);
    expect(st('status=archive&status=open&status=open')).toEqual(['open', 'archive']);
  });
  it('all wins over the others; bad values are ignored', () => {
    expect(st('status=all&status=open')).toEqual(['all']);
    expect(st('status=x')).toBeUndefined();
    expect(st('status=x&status=open')).toEqual(['open']);
  });
  it('writes one param per lit status and round-trips', () => {
    expect(toParams({ status: ['backlog', 'open'], filters: [] }).toString()).toBe('status=backlog&status=open');
    expect(toParams({ status: ['all'], filters: [] }).toString()).toBe('status=all');
    expect(roundTrip({ status: ['open', 'archive'], filters: [] })).toEqual({ status: ['open', 'archive'], filters: [] });
  });
  it('a v2 remembered single status still loads (no version bump)', () => {
    const raw = JSON.stringify({ version: 2, lastUsed: 1000, params: 'status=open' });
    expect(loadViewState(raw, 2000).status).toEqual(['open']);
  });
  it('prev is remembered next to params, never in the URL, and only while All is lit', () => {
    const s: CoffeeViewState = { status: ['all'], prev: ['archive'], filters: [] };
    expect(toParams(s).toString()).toBe('status=all');
    expect(JSON.parse(serializeViewState(s, 1000)).prev).toEqual(['archive']);
    expect(loadViewState(serializeViewState(s, 1000), 2000)).toEqual(s);
    expect(loadViewState(serializeViewState({ ...s, status: ['open'] }, 1000), 2000).prev).toBeUndefined();
    const junk = JSON.stringify({ version: 2, lastUsed: 1000, params: 'status=all', prev: ['x', 'open'] });
    expect(loadViewState(junk, 2000).prev).toEqual(['open']);
    expect(resetView(s).prev).toEqual(['archive']);
  });
});

describe('toggleStatus', () => {
  it('toggles Backlog/Open/Archive on and off, kept in order', () => {
    expect(toggleStatus(['backlog'], 'open', null)).toEqual(['backlog', 'open']);
    expect(toggleStatus(['open', 'archive'], 'backlog', null)).toEqual(['backlog', 'open', 'archive']);
    expect(toggleStatus(['backlog', 'open'], 'backlog', null)).toEqual(['open']);
  });
  it('the last lit status stays on', () => expect(toggleStatus(['open'], 'open', null)).toEqual(['open']));
  it('three on stay three; they never become All', () =>
    expect(toggleStatus(['backlog', 'open'], 'archive', null)).toEqual(['backlog', 'open', 'archive']));
  it('All is exclusive: on lights only All, off restores the earlier selection or Backlog', () => {
    expect(toggleStatus(['backlog', 'open'], 'all', null)).toEqual(['all']);
    expect(toggleStatus(['all'], 'all', ['backlog', 'open'])).toEqual(['backlog', 'open']);
    expect(toggleStatus(['all'], 'all', null)).toEqual(['backlog']);
  });
  it('with All on, tapping one status gives just that one', () => expect(toggleStatus(['all'], 'archive', ['open'])).toEqual(['archive']));
});

describe('litStatuses', () => {
  it('maps the selection to the lists to show', () => {
    expect(litStatuses(undefined)).toEqual(['backlog']);
    expect(litStatuses(['all'])).toEqual(['backlog', 'open', 'archive']);
    expect(litStatuses(['open', 'archive'])).toEqual(['open', 'archive']);
  });
});

describe('subscription param', () => {
  const st = (value: 'any' | 'none' | number): CoffeeViewState => ({ filters: [{ column: 'subscription', mode: 'plan', value }] });
  it('round-trips any, none and an id', () => {
    for (const v of ['any', 'none', 12] as const) expect(roundTrip(st(v))).toEqual(st(v));
    expect(toParams(st(12)).toString()).toBe('subscription=12');
  });
  it('drops junk', () => {
    expect(fromParams(new URLSearchParams('subscription=bogus')).filters).toEqual([]);
    expect(fromParams(new URLSearchParams('subscription=0')).filters).toEqual([]);
  });
});
