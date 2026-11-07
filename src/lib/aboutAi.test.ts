import { describe, it, expect } from 'vitest';
import { aboutAiOpen } from './aboutAi';

describe('aboutAiOpen', () => {
  it('is true only for about=ai (case-insensitive)', () => {
    expect(aboutAiOpen(new URLSearchParams('about=ai'))).toBe(true);
    expect(aboutAiOpen(new URLSearchParams('about=AI'))).toBe(true);
    expect(aboutAiOpen(new URLSearchParams('about=x'))).toBe(false);
    expect(aboutAiOpen(new URLSearchParams(''))).toBe(false);
  });
});
