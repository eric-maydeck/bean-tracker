import { grindValue, MIXED_FILTER, type BrewFact } from './facts';

// Brewing lab bands (spec "Bands"): a brew's band for one variable, or null when the value isn't
// entered (facts already turn zeros into null) or the brew is outside the variable (another grinder).
export interface Band { label: string; order: number }
export type LabVar = 'temp' | 'tempExact' | 'ratio' | 'dose' | 'time' | 'bloom' | 'grind' | 'rest' | 'water' | 'dripper' | 'filter' | 'gh' | 'brewNo';

export const REST_LABELS = ['0–21 d', '22–30 d', '31–45 d', '46–60 d', '61–90 d', '91+ d'];
export const BREW_NO_LABELS = [...Array.from({ length: 9 }, (_, i) => `#${i + 1}`), '#10+'];

// Band i = how many edges x reaches.
const cut = (x: number | null | undefined, edges: number[], labels: string[]): Band | null => {
  if (x === null || x === undefined || !Number.isFinite(x)) return null;
  const i = edges.filter((e) => x >= e).length;
  return { label: labels[i], order: i };
};
const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
const TIME_EDGES = Array.from({ length: 14 }, (_, i) => 90 + 15 * i); // 1:30 … 4:45
const TIME_LABELS = ['< 1:30', ...TIME_EDGES.slice(0, -1).map((e) => `${mmss(e)}–${mmss(e + 14)}`), '4:45+'];
const cat = (s: string | null | undefined): Band | null => (s ? { label: s, order: 0 } : null);

export function bandOf(v: LabVar, b: BrewFact, grinder: string | null = null): Band | null {
  switch (v) {
    case 'temp': return cut(b.tempC, [90, 93, 95], ['< 90 °C', '90–92 °C', '93–94 °C', '95+ °C']);
    case 'tempExact': return b.tempC === null ? null : { label: `${Math.round(b.tempC)} °C`, order: Math.round(b.tempC) };
    case 'ratio': return cut(b.ratio, [15.5, 16.5, 17.5], ['< 1:15.5', '1:15.5–16.5', '1:16.5–17.5', '1:17.5+']);
    case 'dose': return cut(b.dose && b.dose > 0 ? b.dose : null, [16, 18, 20], ['< 16 g', '16–18 g', '18–20 g', '20+ g']);
    case 'time': return cut(b.brewTimeSeconds, TIME_EDGES, TIME_LABELS);
    case 'bloom': return b.bloomSeconds === null ? null : { label: `${b.bloomSeconds} s`, order: b.bloomSeconds };
    case 'grind': {
      const g = grinder && b.grinder === grinder ? grindValue(b.grind) : null;
      return g === null ? null : { label: b.grind!, order: g };
    }
    case 'rest': return b.restDays === null || b.restDays < 0 ? null : cut(b.restDays, [22, 31, 46, 61, 91], REST_LABELS);
    case 'water': return cat(b.water);
    case 'dripper': return cat(b.dripper);
    case 'filter': return b.filter === MIXED_FILTER ? null : cat(b.filter);
    case 'gh': return cut(b.waterProfile?.gh || null, [30, 60, 90], ['0–30 ppm', '30–60 ppm', '60–90 ppm', '90+ ppm']);
    case 'brewNo': return b.brewIndex < 1 ? null : { label: BREW_NO_LABELS[Math.min(b.brewIndex, 10) - 1], order: Math.min(b.brewIndex, 10) };
  }
}

// Water tab "Minerals vs rating" (plain adjusted means): each distinct value used. A mineral's 0 is
// a real recipe value (no potassium), unlike brew fields; null = not entered or no water profile.
export const MINERALS = [
  ['calcium', 'Ca'], ['magnesium', 'Mg'], ['potassium', 'K'], ['sodium', 'Na'], ['chloride', 'Chloride'], ['sulfate', 'Sulfate'],
  ['gh', 'GH'], ['kh', 'KH'], ['mgca', 'Mg:Ca'], ['mgk', 'Mg:K']
] as const;
export type Mineral = (typeof MINERALS)[number][0];
const round = (x: number, d: number) => Math.round(x * 10 ** d) / 10 ** d;
export function mineralOf(m: Mineral, b: BrewFact): number | null {
  const w = b.waterProfile;
  if (!w) return null;
  if (m === 'mgca') return w.magnesium !== null && w.calcium ? round(w.magnesium / w.calcium, 2) : null;
  if (m === 'mgk') return w.magnesium !== null && w.potassium ? round(w.magnesium / w.potassium, 2) : null;
  if (m === 'gh' || m === 'kh') return round(w[m], 0);
  return w[m] === null ? null : round(w[m]!, 1);
}
