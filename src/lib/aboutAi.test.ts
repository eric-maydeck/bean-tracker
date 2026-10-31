import { describe, it, expect } from 'vitest';
import { contactEmailFor, aboutAiOpen } from './aboutAi';

describe('contactEmailFor', () => {
  it('uses the fuhnoo.coffee address for the domain and its subdomains', () => {
    for (const h of ['fuhnoo.coffee', 'www.fuhnoo.coffee', 'a.b.FUHNOO.coffee', 'fuhnoo.coffee:443', 'fuhnoo.coffee.', 'www.fuhnoo.coffee.:443']) {
      expect(contactEmailFor(h)).toBe('contact@example.com');
    }
  });
  it('uses the personal address everywhere else', () => {
    for (const h of ['coffee.maydeck.net', '192.0.2.5:5199', 'localhost:5173', 'notfuhnoo.coffee', 'fuhnoo.coffee.evil.com', '']) {
      expect(contactEmailFor(h)).toBe('eric@maydeck.net');
    }
  });
});

describe('aboutAiOpen', () => {
  it('is true only for about=ai (case-insensitive)', () => {
    expect(aboutAiOpen(new URLSearchParams('about=ai'))).toBe(true);
    expect(aboutAiOpen(new URLSearchParams('about=AI'))).toBe(true);
    expect(aboutAiOpen(new URLSearchParams('about=x'))).toBe(false);
    expect(aboutAiOpen(new URLSearchParams(''))).toBe(false);
  });
});
