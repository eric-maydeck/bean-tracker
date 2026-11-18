import { beforeEach, describe, expect, it, vi } from 'vitest';

const { goto } = vi.hoisted(() => ({ goto: vi.fn(async (..._args: unknown[]) => {}) }));
vi.mock('$app/navigation', () => ({ goto }));
vi.mock('$app/state', () => ({ page: { state: {} } }));

import { writeUrlParams } from './urlState.ts';

function at(search: string, hash = '') {
  vi.stubGlobal('location', { pathname: '/coffees', search, hash });
}

describe('writeUrlParams', () => {
  beforeEach(() => {
    goto.mockClear();
    at('');
  });

  it('mirrors params with a shallow replace (no history entry, no navigation)', () => {
    writeUrlParams(new URLSearchParams({ q: 'a' }));
    expect(goto).toHaveBeenCalledExactlyOnceWith('/coffees?q=a', { shallow: true, replace: true, state: {} });
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
});
