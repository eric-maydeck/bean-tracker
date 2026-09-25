import { describe, it, expect } from 'vitest';
import { afterFailedFill } from './coffeeFormFill';

describe('afterFailedFill', () => {
  it('reverts to the last successfully filled URL and offers the tried one', () => {
    expect(afterFailedFill('https://b.coffee/p', 'https://a.coffee/p', 'https://saved.coffee/p')).toEqual({
      revertTo: 'https://a.coffee/p',
      offer: 'https://b.coffee/p'
    });
  });

  it("without a successful fill, reverts to the coffee's value, else empty", () => {
    expect(afterFailedFill('https://b.coffee/p', null, 'https://saved.coffee/p').revertTo).toBe('https://saved.coffee/p');
    expect(afterFailedFill('https://b.coffee/p', null, '')).toEqual({ revertTo: '', offer: 'https://b.coffee/p' });
  });

  it('offers nothing when the tried URL is what the field goes back to', () => {
    expect(afterFailedFill('https://saved.coffee/p', null, 'https://saved.coffee/p')).toEqual({
      revertTo: 'https://saved.coffee/p',
      offer: null
    });
  });
});
