import type { FactResult, Tone } from './types';

export const FACT_SLOTS = 12; // total + 11 ranked (with personality: 13 cards, like the mockup)
export const CATEGORY_CAP = 3; // total counts toward amounts
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

export function select(facts: readonly FactResult[]): string[] {
  const total = facts.find((f) => f.id === 'total');
  const used: Record<string, number> = total ? { [total.category]: 1 } : {};
  const ids = total ? ['total'] : [];
  const ranked = facts.filter((f) => f.id !== 'total').sort((a, b) => b.score - a.score); // stable: ties keep POOL order
  for (const f of ranked) {
    if (ids.length >= FACT_SLOTS) break;
    if ((used[f.category] ?? 0) >= CATEGORY_CAP) continue;
    used[f.category] = (used[f.category] ?? 0) + 1;
    ids.push(f.id);
  }
  return ids;
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
