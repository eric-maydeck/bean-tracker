import { DOSE_BANDS } from '$lib/insightsUrl';
import { grindKey, grindValue, MIXED_FILTER, type BrewFact } from './facts';

// Brewing lab bands (spec "Bands"): a brew's band for one variable, or null when the value isn't
// entered (facts already turn zeros into null) or the brew is outside the variable (another grinder).
// `range`: a band's span when its label names only its first value (grind bands: "1.3.0" = 1.3.0 – 1.3.9).
export interface Band { label: string; order: number; range?: string }
// `<var>Exact`: the chart's Exact mode (preview round 1, G10); the bare name is its Bands mode.
export type LabVar = 'temp' | 'tempExact' | 'ratio' | 'ratioExact' | 'dose' | 'doseExact' | 'time' | 'timeExact' | 'bloom' | 'bloomExact'
  | 'grind' | 'grindExact' | 'rest' | 'water' | 'dripper' | 'filter' | 'gh' | 'brewNo';

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
const exact = (x: number | null | undefined, step: number, label: (v: number) => string): Band | null => {
  if (x === null || x === undefined || !Number.isFinite(x)) return null;
  const v = Math.round(x / step) * step;
  return { label: label(v), order: v };
};
// B10: a bloom within 2 s of a multiple of 5 counts as that multiple (31 → 30, 43 → 45).
export const bloomRound = (s: number) => (Math.abs(s - Math.round(s / 5) * 5) <= 2 ? Math.round(s / 5) * 5 : s);
// B7: an a.b.c setting (A4Z) bands to a.b, labeled by its first setting "a.b.0" (range a.b.0 – a.b.9); a
// plain number (ZP6) to half-number bands labeled "4.5" (range 4.5 – 4.9; "5" = "5.0"); any other format
// stays exact. Exact: the raw setting, a whole number written as "5.0".
function grindBand(grind: string, bands: boolean): Band | null {
  const k = grindKey(grind);
  if (!k) return null;
  if (bands && k.length === 3) {
    const ab = k.slice(0, 2).join('.');
    return { label: `${ab}.0`, order: grindValue(`${ab}.0`)!, range: `${ab}.0 – ${ab}.9` };
  }
  if (k.length > 2 || !bands) {
    const short = k.length === 1 ? `${k[0]}.0` : grind.trim();
    return { label: short, order: grindValue(short)! };
  }
  const lo = Math.floor(Number(grind) * 2) / 2;
  return { label: lo.toFixed(1), order: lo, range: `${lo.toFixed(1)} – ${(lo + 0.4).toFixed(1)}` };
}

// Bands mode (round 3, M-6): every grind band step from the lowest band present to the highest, in order, so a
// chart never skips a step inside its range (the user). A.b.c bands step by b ("0.9.0", "1.0.0"); half-number
// bands by 0.5. Null when a label is in neither form (an exact-only setting): then nothing is filled.
export function grindSteps(labels: string[]): Band[] | null {
  if (!labels.length) return [];
  const abc = labels.map((l) => /^(\d+)\.(\d)\.0$/.exec(l));
  if (abc.every(Boolean)) {
    const ns = abc.map((m) => +m![1] * 10 + +m![2]);
    return Array.from({ length: Math.max(...ns) - Math.min(...ns) + 1 }, (_, i) => {
      const n = Math.min(...ns) + i, ab = `${Math.floor(n / 10)}.${n % 10}`;
      return { label: `${ab}.0`, order: grindValue(`${ab}.0`)!, range: `${ab}.0 – ${ab}.9` };
    });
  }
  if (labels.every((l) => /^\d+\.[05]$/.test(l))) {
    const ns = labels.map((l) => Math.round(+l * 2));
    return Array.from({ length: Math.max(...ns) - Math.min(...ns) + 1 }, (_, i) => {
      const lo = (Math.min(...ns) + i) / 2;
      return { label: lo.toFixed(1), order: lo, range: `${lo.toFixed(1)} – ${(lo + 0.4).toFixed(1)}` };
    });
  }
  return null;
}

export function bandOf(v: LabVar, b: BrewFact, grinder: string | null = null): Band | null {
  switch (v) {
    case 'temp': return cut(b.tempC, [90, 93, 95], ['< 90°C', '90–92°C', '93–94°C', '95+°C']);
    case 'tempExact': return b.tempC === null ? null : { label: `${Math.round(b.tempC)}°C`, order: Math.round(b.tempC) };
    case 'ratio': return cut(b.ratio, [15.5, 16.5, 17.5], ['< 1:15.5', '1:15.5–16.5', '1:16.5–17.5', '1:17.5+']);
    case 'ratioExact': return exact(b.ratio, 0.5, (v) => `1:${v}`);
    case 'dose': return cut(b.dose && b.dose > 0 ? b.dose : null, [16, 18, 20], ['< 16g', '16–18g', '18–20g', '20+g']);
    case 'doseExact': return exact(b.dose && b.dose > 0 ? b.dose : null, 0.5, (v) => `${v}g`);
    case 'time': return cut(b.brewTimeSeconds, TIME_EDGES, TIME_LABELS);
    case 'timeExact': return exact(b.brewTimeSeconds, 5, mmss);
    case 'bloom': return b.bloomSeconds === null ? null : cut(bloomRound(b.bloomSeconds), [30, 45, 60], ['0–29s', '30–44s', '45–59s', '60s+']);
    case 'bloomExact': return b.bloomSeconds === null ? null : exact(bloomRound(b.bloomSeconds), 1, (v) => `${v}s`);
    case 'grind': case 'grindExact':
      return grinder && b.grinder === grinder && b.grind ? grindBand(b.grind, v === 'grind') : null;
    case 'rest': return b.restDays === null || b.restDays < 0 ? null : cut(b.restDays, [22, 31, 46, 61, 91], REST_LABELS);
    case 'water': return cat(b.water);
    case 'dripper': return cat(b.dripper);
    case 'filter': return b.filter === MIXED_FILTER ? null : cat(b.filter);
    case 'gh': return exact(profileOf(b)?.gh || null, 1, (v) => `${v}ppm`); // W5: one band per GH value used
    case 'brewNo': return b.brewIndex < 1 ? null : { label: BREW_NO_LABELS[Math.min(b.brewIndex, 10) - 1], order: Math.min(b.brewIndex, 10) };
  }
}

// Water tab "Recipe mineral map" and GH: a recipe profile's amounts. A mineral's 0 is
// a real recipe value (no potassium), unlike brew fields; null = not entered or no water profile.
// A profile whose six minerals are all 0 or empty was never filled in (user, 2026-10-12): its brews
// count in no mineral, GH, KH or ratio chart.
const SIX = ['calcium', 'magnesium', 'potassium', 'sodium', 'chloride', 'sulfate'] as const;
const profileOf = (b: BrewFact) => (b.waterProfile && SIX.some((k) => b.waterProfile![k]) ? b.waterProfile : null);
export const MINERALS = [
  ['calcium', 'Ca'], ['magnesium', 'Mg'], ['potassium', 'K'], ['sodium', 'Na'], ['chloride', 'Chloride'], ['sulfate', 'Sulfate'],
  ['gh', 'GH'], ['kh', 'KH'], ['mgca', 'Mg:Ca'], ['mgk', 'Mg:K']
] as const;
export type Mineral = (typeof MINERALS)[number][0];
const round = (x: number, d: number) => Math.round(x * 10 ** d) / 10 ** d;
export function mineralOf(m: Mineral, b: BrewFact): number | null {
  const w = profileOf(b);
  if (!w) return null;
  if (m === 'mgca') return w.magnesium !== null && w.calcium ? round(w.magnesium / w.calcium, 2) : null;
  if (m === 'mgk') return w.magnesium !== null && w.potassium ? round(w.magnesium / w.potassium, 2) : null;
  if (m === 'gh' || m === 'kh') return round(w[m], 0);
  return w[m] === null ? null : round(w[m]!, 1);
}

// The brew Dose filter's band slug (spec 2026-10-21): 11 / 13.5 / 16.5 / 19 / 21 g edges; no dose → null.
export const doseBand = (dose: number | null): string | null =>
  cut(dose && dose > 0 ? dose : null, [11, 13.5, 16.5, 19, 21], DOSE_BANDS.map((d) => d.slug))?.label ?? null;
