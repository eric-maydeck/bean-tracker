import type { YearCtx } from './year';

export type Category = 'amounts' | 'habits' | 'coffees' | 'brewing' | 'money';
export type Tone = 'espresso' | 'red' | 'sun' | 'plum' | 'brown' | 'green' | 'blue' | 'teal' | 'amber' | 'violet' | 'gold' | 'ink' | 'cream';
export type Viz =
  | { kind: 'bars'; values: number[]; labels: string[]; tips: string[]; hi: number; hiText: string }
  | { kind: 'spark'; values: number[]; labels: string[]; texts: string[] } // texts: per-point display
  | { kind: 'hlist'; rows: { label: string; value: number; texts: string[] }[] } // texts: 1-3 value columns
  | { kind: 'split'; periods: { name: string; segs: { label: string; pct: number }[] }[]; keys: string[] }
  | { kind: 'calendar'; start: string; days: ('on' | 'miss' | 'streak' | 'none')[] } // start = a Monday
  | { kind: 'dots'; rows: { label: string; value: number; brews: number }[]; lo: number; hi: number; stack?: true };
export interface Trait { value: string; label: string; strength: number; adj?: string; noun?: string; phrase: string }
export interface Slide {
  id: string; category: Category | 'personality';
  lead: string; big: string; unit?: string; sub?: string; context: string; // sub: a secondary value line under big
  viz?: Viz; traits?: Trait[];
  link: { tab: string; section: string; href: string }; // "Habits · Brew clock" + seeMoreHref
  wide?: true; perPerson?: true;
  card: { big: string; label: string }; // the preview card's text (Part 3)
  tone?: Tone; // set by assembly
}
export interface FactResult extends Slide { score: number } // 0..1 for ranked facts; total/personality ignore it
export interface FactDef { id: string; category: Category; run: (y: YearCtx) => FactResult | null }
