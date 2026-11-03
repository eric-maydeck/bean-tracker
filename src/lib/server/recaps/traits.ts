import { MON } from '$lib/insightsUrl';
import { seeMoreHref } from '$lib/recapsUrl';
import { country } from '$lib/server/insights/leaderboards';
import { recipeBand } from '$lib/server/insights/pours';
import { countsForRating } from '$lib/server/insights/ratings';
import { pooled } from '$lib/sample';
import { andList, avg, boardRows, evening, grams, monthMeans, pct, ratioMode } from './pool';
import type { FactResult, Trait } from './types';
import type { YearCtx } from './year';

export const PERSONALITY_TILES = 6;

// strength only picks the title's words. Share traits: min(1, (share - floor) / floor). Traits floored by a count
// rather than a share get a fixed weight: a settled habit (rest, perDay) outranks a mild share, gear sits below one.
const share = (v: number, floor: number) => Math.min(1, (v - floor) / floor);
const W = { rest: 0.7, perDay: 0.5, gear: 0.4, other: 0.3 };

const top = <T>(xs: T[]) => {
  const c = new Map<T, number>();
  for (const x of xs) c.set(x, (c.get(x) ?? 0) + 1);
  const [k, n] = [...c].sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0])))[0] ?? [undefined, 0];
  return { k: k as T | undefined, n: n as number, of: xs.length, size: c.size };
};
const Cap = (s: string) => s[0].toUpperCase() + s.slice(1);

// Pool order is tile order (the first 6 non-null show); strength then chooses title words.
export const TRAITS: { id: string; run: (y: YearCtx) => Trait | null }[] = [
  { id: 'process', run: (y) => {
    const t = top(y.brews.map((b) => b.processGroup as string | null).filter((g): g is string => !!g && g !== 'Other / Unknown'));
    if (t.of < 20 || t.n / t.of < 0.4) return null;
    const s = t.n / t.of, g = t.k!.toLowerCase();
    return { value: pct(s), label: g, strength: share(s, 0.4), adj: g, ...(s >= 0.6 && { noun: 'purist' }), phrase: `${g} coffee` };
  } },
  { id: 'setup', run: (y) => {
    const t = top(y.brews.map((b) => b.dripper).filter((d): d is string => d !== null));
    if (t.size < 2 || t.n / t.of < 0.25) return null;
    return { value: pct(t.n / t.of), label: `on the ${t.k}`, strength: share(t.n / t.of, 0.25), phrase: `mostly the ${t.k}` };
  } },
  { id: 'rest', run: (y) => {
    const m = monthMeans(y, (b) => b.restDays, 10).at(-1);
    if (!m) return null;
    const d = Math.round(avg(m.bs.map((b) => b.restDays!))), mon = MON[m.m];
    return { value: `${d}d`, label: `average rest in ${mon}`, strength: W.rest, ...(d >= 45 ? { adj: 'patient' } : d <= 14 ? { adj: 'eager' } : {}), phrase: `${d}d of rest in ${mon}` };
  } },
  { id: 'decafNight', run: (y) => {
    const e = evening(y);
    if (e.eve < 10 || e.decaf / e.eve < 0.5) return null;
    return { value: pct(e.decaf / e.eve), label: 'decaf after 7pm', strength: share(e.decaf / e.eve, 0.5), phrase: 'decaf after dark' };
  } },
  { id: 'gear', run: (y) => {
    const n = new Set(y.brews.filter((b) => b.brewerType === 'pourover').map((b) => b.dripper).filter((d) => d !== null)).size;
    return n < 3 ? null : { value: String(n), label: 'brewers', strength: W.gear, ...(n >= 6 && { noun: 'tinkerer' }), phrase: `${n} brewers` };
  } },
  { id: 'temp', run: (y) => {
    const ts = y.brews.map((b) => b.tempC).filter((t): t is number => t !== null);
    if (ts.length < 20) return null;
    const t = avg(ts).toFixed(1);
    return { value: `${t}°C`, label: 'average brew temp', strength: W.other, phrase: `${t}°C water` };
  } },
  { id: 'origin', run: (y) => {
    const r = boardRows(y, 'origins')[0];
    if (!r || r.value / grams(y) < 0.3) return null;
    const s = r.value / grams(y);
    return { value: pct(s), label: `from ${r.label}`, strength: share(s, 0.3), phrase: `${country(r.label) ?? r.label} beans` };
  } },
  { id: 'ratio', run: (y) => {
    const m = ratioMode(y);
    if (!m || m.share < 0.4) return null;
    return { value: `1:${m.mode}`, label: 'brew ratio', strength: share(m.share, 0.4), ...(m.share >= 0.6 && { adj: 'steady' }), phrase: `1:${m.mode}` };
  } },
  { id: 'recipe', run: (y) => {
    const band = recipeBand(y.pours.facts, y.pours.recipes);
    const t = top(y.brews.map((b) => band(b)?.label).filter((l): l is string => !!l && l !== 'No recipe'));
    if (!t.k || t.n / y.brews.length < 0.2) return null;
    return { value: pct(t.n / y.brews.length), label: t.k, strength: share(t.n / y.brews.length, 0.2), phrase: `a ${t.k} recipe` };
  } },
  { id: 'roast', run: (y) => {
    const t = top(y.brews.map((b) => b.roastLevel).filter((l): l is string => l !== null));
    if (!t.k || t.n / t.of < 0.4) return null;
    return { value: pct(t.n / t.of), label: `${t.k.toLowerCase()} roasts`, strength: share(t.n / t.of, 0.4), phrase: `${t.k.toLowerCase()} roasts` };
  } },
  { id: 'perDay', run: (y) => {
    const d = new Set(y.brews.map((b) => b.localDate)).size, v = y.brews.length / d;
    if (d < 30) return null;
    return { value: v.toFixed(1), label: 'brews a brew day', strength: W.perDay, ...(v >= 5 && { adj: 'devoted' }), phrase: `${v.toFixed(1)} brews a brew day` };
  } },
  { id: 'rating', run: (y) => {
    const rated = y.scored.filter((b) => countsForRating(b, 'current'));
    if (!rated.length || pooled(new Set(rated.map((b) => b.coffeeId)).size, rated.length).small) return null;
    const a = avg(rated.map((b) => b.rating!)).toFixed(1);
    return { value: a, label: 'average rating', strength: W.other, phrase: `a ${a} average` };
  } }
];

const title = (ts: Trait[]) => {
  const by = (k: 'adj' | 'noun') => ts.filter((t) => t[k]).sort((a, b) => b.strength - a.strength);
  const adjs = by('adj').slice(0, 2).map((t) => t.adj!), noun = by('noun')[0]?.noun;
  return adjs.length || noun ? `The ${[...adjs, noun ?? 'brewer'].join(' ')}` : 'Your coffee year';
};

export function personality(y: YearCtx): FactResult | null {
  const all = TRAITS.map((t) => t.run(y)).filter((t): t is Trait => t !== null);
  if (all.length < 2) return null;
  const shown = all.slice(0, PERSONALITY_TILES), ph = shown.map((t) => t.phrase);
  const big = title(all);
  const context = [`${Cap(ph.slice(0, 3).join(', '))}.`, ph.length > 3 ? `${Cap(andList(ph.slice(3)))}.` : ''].filter(Boolean).join(' ');
  return {
    id: 'you', category: 'personality', lead: 'Your coffee personality is', big, context, traits: shown,
    link: { tab: 'Highlights', section: 'Highlights · Insights', href: seeMoreHref(y.year, 'insights') },
    tone: 'cream', wide: true, card: { big, label: 'coffee personality' }, score: 1
  };
}
