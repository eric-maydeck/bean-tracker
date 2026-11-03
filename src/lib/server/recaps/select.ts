import type { FactResult, Tone } from './types';

export const THEME_VERSION = 1; // bump when TONES or the generator change (card cache key)

const TONES: Tone[] = ['espresso', 'red', 'sun', 'plum', 'brown', 'green', 'blue', 'teal', 'amber', 'violet', 'gold', 'ink'];

export function rng(seed: number): () => number { // mulberry32
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(xs: readonly T[], seed: number): T[] {
  const r = rng(seed), a = [...xs];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

// Only a lack of data leaves a fact out (its generator returned null): every other fact shows, total first, then by score.
export function select(facts: readonly FactResult[]): string[] {
  const total = facts.filter((f) => f.id === 'total');
  const ranked = facts.filter((f) => f.id !== 'total').sort((a, b) => b.score - a.score); // stable: ties keep POOL order
  return [...total, ...ranked].map((f) => f.id);
}

export function order(ids: readonly string[], year: number): string[] {
  const rest = ids.filter((id) => id !== 'total');
  return [...ids.filter((id) => id === 'total'), ...shuffle(rest, year)];
}

export function theme(year: number): Tone[] { return shuffle(TONES, year * 31 + THEME_VERSION); }

export function tonesFor(ids: readonly string[], year: number): Record<string, Tone> {
  const t = theme(year);
  return { ...Object.fromEntries(ids.map((id, i) => [id, t[i % t.length]])), you: 'cream' };
}

// The cover's tone: the theme's last tone, so it differs from the first slide's (theme[0]) and from year to year.
export const coverTone = (year: number): Tone => theme(year).at(-1)!;
