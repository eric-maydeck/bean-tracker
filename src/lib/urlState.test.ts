import { beforeEach, describe, expect, it, vi } from 'vitest';

const { goto, refreshAll, navigating } = vi.hoisted(() => ({
  goto: vi.fn(async (..._args: unknown[]) => {}),
  refreshAll: vi.fn(async () => {}),
  navigating: { to: null as object | null, complete: null as Promise<void> | null }
}));
vi.mock('$app/navigation', () => ({ goto, refreshAll }));
vi.mock('$app/state', () => ({ page: { state: {} }, navigating }));

import { refreshTracked, writeUrlParams } from './urlState.ts';

function at(search: string, hash = '') {
  vi.stubGlobal('location', { pathname: '/coffees', search, hash, href: `http://x/coffees${search}${hash}` });
}

describe('writeUrlParams', () => {
  beforeEach(() => {
    goto.mockClear();
    navigating.to = navigating.complete = null;
    at('');
  });

  it('mirrors params with a shallow replace (no history entry, no navigation)', () => {
    writeUrlParams(new URLSearchParams({ q: 'a' }));
    expect(goto).toHaveBeenCalledExactlyOnceWith('/coffees?q=a', { shallow: true, replace: true, state: {} });
  });

  it('keeps the hash', () => {
    at('?q=a', '#origin');
    writeUrlParams(new URLSearchParams({ q: 'ab' }));
    expect(goto.mock.calls[0][0]).toBe('/coffees?q=ab#origin');
  });

  it('keeps rapid successive writes in call order', () => {
    for (const q of ['a', 'ab', 'abc']) writeUrlParams(new URLSearchParams({ q }));
    expect(goto.mock.calls.map((c) => c[0])).toEqual(['/coffees?q=a', '/coffees?q=ab', '/coffees?q=abc']);
  });

  it('skips a write that matches the address bar', () => {
    at('?q=a', '#x');
    writeUrlParams(new URLSearchParams({ q: 'a' }));
    expect(goto).not.toHaveBeenCalled();
  });

  it('carries ?about=ai over unless asked not to', () => {
    at('?about=ai');
    writeUrlParams(new URLSearchParams({ q: 'a' }));
    expect(goto.mock.calls[0][0]).toBe('/coffees?q=a&about=ai');
    writeUrlParams(new URLSearchParams(), false);
    expect(goto.mock.calls[1][0]).toBe('/coffees');
  });

  it('warns when the mirror rejects (an unresolvable route)', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    goto.mockRejectedValueOnce(new Error('Not found'));
    writeUrlParams(new URLSearchParams({ q: 'a' }));
    await vi.waitFor(() => expect(warn).toHaveBeenCalledOnce());
    warn.mockRestore();
  });

  it('waits out a pending navigation, then writes only the latest', async () => {
    let done!: () => void;
    navigating.to = {};
    navigating.complete = new Promise<void>((r) => (done = r));
    writeUrlParams(new URLSearchParams({ q: 'a' }));
    writeUrlParams(new URLSearchParams({ q: 'ab' }));
    expect(goto).not.toHaveBeenCalled();
    navigating.to = navigating.complete = null;
    done();
    await vi.waitFor(() => expect(goto).toHaveBeenCalledOnce());
    expect(goto.mock.calls[0][0]).toBe('/coffees?q=ab');
  });

  it('drops a deferred write once another page has landed', async () => {
    let done!: () => void;
    navigating.to = {};
    navigating.complete = new Promise<void>((r) => (done = r));
    writeUrlParams(new URLSearchParams({ q: 'a' }));
    vi.stubGlobal('location', { pathname: '/stats', search: '', hash: '', href: 'http://x/stats' });
    navigating.to = navigating.complete = null;
    done();
    await new Promise((r) => setTimeout(r, 5));
    expect(goto).not.toHaveBeenCalled();
  });

  it('drops a deferred write when a navigation lands on the same path with another query', async () => {
    let done!: () => void;
    at('?tab=spend');
    navigating.to = {};
    navigating.complete = new Promise<void>((r) => (done = r));
    writeUrlParams(new URLSearchParams({ tab: 'spend', low: 'x' }));
    at('?tab=records');
    navigating.to = navigating.complete = null;
    done();
    await new Promise((r) => setTimeout(r, 5));
    expect(goto).not.toHaveBeenCalled();
  });

  it('a write back to the address bar clears a queued one', async () => {
    let finish!: () => void;
    at('?q=a');
    refreshAll.mockReturnValueOnce(new Promise<void>((r) => (finish = r)));
    const refreshing = refreshTracked();
    writeUrlParams(new URLSearchParams({ q: 'a', on: '1' }));
    writeUrlParams(new URLSearchParams({ q: 'a' }));
    finish();
    await refreshing;
    await new Promise((r) => setTimeout(r, 5));
    expect(goto).not.toHaveBeenCalled();
  });

  it('waits for a pending refresh, which a shallow goto would cancel', async () => {
    let finish!: () => void;
    refreshAll.mockReturnValueOnce(new Promise<void>((r) => (finish = r)));
    const refreshing = refreshTracked();
    writeUrlParams(new URLSearchParams({ q: 'a' }));
    expect(goto).not.toHaveBeenCalled();
    finish();
    await refreshing;
    await vi.waitFor(() => expect(goto).toHaveBeenCalledOnce());
  });
});
