import { MON } from '$lib/insightsUrl';
import { fmtInt, fmtKg, fmtLitres } from '$lib/recapFormat';
import { seeMoreHref } from '$lib/recapsUrl';
import type { BrewFact } from '$lib/server/insights/facts';
import { longestStreak } from '$lib/server/insights/habits';
import { pick, RECORDS } from '$lib/server/insights/records';
import { addDays } from '$lib/server/insights/time';
import type { FactDef, Viz } from './types';
import type { YearCtx } from './year';

const md = (d: string) => `${MON[Number(d.slice(5, 7)) - 1]} ${Number(d.slice(8))}`;
const h12 = (h: number) => `${h % 12 || 12}${h < 12 ? 'am' : 'pm'}`;
const pct = (n: number) => `${Math.round(n * 100)}%`;
const dow = (d: string) => (new Date(`${d}T00:00:00Z`).getUTCDay() + 6) % 7; // Monday = 0
const sorted = (xs: string[]) => [...new Set(xs)].sort();

// Clock time of a records value (minutes; 00:00-04:00 are shifted +1440 so the night runs on).
const clockText = (v: number) => { const m = v % 1440; return `${Math.floor(m / 60) % 12 || 12}:${String(m % 60).padStart(2, '0')}${m < 720 ? 'am' : 'pm'}`; };
const clockHolder = (y: YearCtx, key: string) => {
  const d = RECORDS.find((r) => r.key === key)!;
  return pick(d.run({ brews: y.brews, bags: y.bags, ratings: 'current', today: y.today }), d.dir);
};

const total: FactDef = {
  id: 'total', category: 'amounts',
  run: (y) => {
    const first = y.brews[0].localDate, last = y.brews.at(-1)!.localDate;
    const m0 = Number(first.slice(5, 7)) - 1, m1 = Number(last.slice(5, 7)) - 1;
    const counts = Array<number>(m1 - m0 + 1).fill(0);
    for (const b of y.brews) counts[Number(b.localDate.slice(5, 7)) - 1 - m0]++;
    const hi = counts.indexOf(Math.max(...counts));
    const values = counts.map((n) => Math.round(n / y.per));
    const grams = y.brews.reduce((s, b) => s + (b.dose ?? 0), 0) / y.per;
    const water = y.brews.reduce((s, b) => s + (b.waterG ?? 0), 0) / y.per;
    const labels = values.map((_, i) => MON[m0 + i]);
    const big = fmtInt(y.brews.length / y.per);
    return {
      id: 'total', category: 'amounts',
      lead: y.preview ? `Your ${y.year} so far` : `Your ${y.year}`, big, unit: 'brews',
      context: `${fmtKg(grams)} of coffee through ${fmtLitres(water)} of water, ${md(first)} to ${md(last)}. ${labels[hi]} was the peak at ${values[hi]}.`,
      viz: { kind: 'bars', values, labels, tips: values.map((v, i) => `${labels[i]}: ${v} brews`), hi, hiText: String(values[hi]) },
      link: { tab: 'Summary', section: 'Summary · Overview', href: seeMoreHref(y.year, 'overview') },
      wide: true, perPerson: true, card: { big, label: 'brews' }, score: 1
    };
  }
};

const streak: FactDef = {
  id: 'streak', category: 'habits',
  run: (y) => {
    const days = sorted(y.brews.map((b) => b.localDate));
    const best = longestStreak(days);
    if (best.length < 7) return null;
    const from = best.from!, to = best.to!, first = days[0], last = days.at(-1)!;
    const have = new Set(days);
    const span: string[] = [];
    for (let d = first; d <= last; d = addDays(d, 1)) span.push(d);
    // The year's first run of 7+ days, then the days missed since.
    let s = 0, runStart = first;
    for (const d of span) {
      if (!have.has(d)) { s = 0; continue; }
      if (s === 0) runStart = d;
      if (++s === 7) break;
    }
    const missed = span.filter((d) => d >= runStart && !have.has(d));
    const going = to === y.period.end || (y.preview && to === addDays(y.period.end, -1));
    let context = going ? `Unbroken since ${md(from)} and still going.` : `Unbroken from ${md(from)} to ${md(to)}.`;
    if (missed.length) context += ` Since ${md(runStart)} you have missed ${missed.length === 1 ? 'exactly 1 day' : `${missed.length} days`}${missed.length === 1 ? `: ${md(missed[0])}` : ''}.`;
    else if (runStart !== from) context += ` Since ${md(runStart)} you have not missed a day.`;
    const cells = span.map((d) => (d >= from && d <= to ? 'streak' : have.has(d) ? 'on' : 'miss') as 'streak' | 'on' | 'miss');
    return {
      id: 'streak', category: 'habits',
      lead: 'Brewed every day for', big: String(best.length), unit: 'days', context,
      viz: { kind: 'calendar', start: addDays(first, -dow(first)), days: [...Array<'none'>(dow(first)).fill('none'), ...cells] },
      link: { tab: 'Highlights', section: 'Highlights · Milestones', href: seeMoreHref(y.year, 'milestones') },
      wide: true, card: { big: String(best.length), label: 'days in a row' },
      score: best.length / span.length
    };
  }
};

// Brews with a real time of day (backfilled ones were typed in later).
const timed = (y: YearCtx): BrewFact[] => y.brews.filter((b) => !b.backfilled);
const hourOf = (b: BrewFact) => Number(b.localTime.slice(11, 13));

const hour: FactDef = {
  id: 'hour', category: 'habits',
  run: (y) => {
    const bs = timed(y);
    if (bs.length < 50) return null;
    const by = Array<number>(24).fill(0);
    for (const b of bs) by[hourOf(b)]++;
    const top = by.indexOf(Math.max(...by)), n = by[top];
    const lo = by.findIndex((v) => v), hiH = by.findLastIndex((v) => v);
    const early = clockHolder(y, 'earlyBird'), late = clockHolder(y, 'nightOwl');
    if (!early || !late) return null;
    const values = by.slice(lo, hiH + 1);
    const hrs = values.map((_, i) => lo + i);
    const labels = hrs.map((h, i) => (i === 0 || i === hrs.length - 1 || (h % 6 === 0 && i > 1 && i < hrs.length - 2) ? h12(h) : ''));
    return {
      id: 'hour', category: 'habits',
      lead: 'Your coffee hour is', big: h12(top),
      context: `${fmtInt(n)} brews: that's 1 in ${Math.round(bs.length / n)} brews at ${h12(top)}. Your brew day spans anywhere from ${clockText(early.value)} to ${clockText(late.value)}.`,
      viz: { kind: 'bars', values, labels, tips: hrs.map((h, i) => `${h12(h)}: ${values[i]} brews`), hi: top - lo, hiText: String(n) },
      link: { tab: 'Habits', section: 'Habits · Brew clock', href: seeMoreHref(y.year, 'habits') },
      card: { big: h12(top), label: 'coffee hour' },
      score: Math.min(1, (n / bs.length) * 3)
    };
  }
};

const decaf: FactDef = {
  id: 'decaf', category: 'habits',
  run: (y) => {
    const bs = timed(y);
    const eve = bs.filter((b) => hourOf(b) >= 19), day = bs.filter((b) => hourOf(b) < 19);
    const eveDecaf = eve.filter((b) => b.decaf).length;
    if (eve.length < 10 || bs.filter((b) => b.decaf).length < 5) return null;
    const after = eveDecaf / eve.length, before = day.length ? day.filter((b) => b.decaf).length / day.length : 0;
    if (after - before < 0.3) return null;
    return {
      id: 'decaf', category: 'habits',
      lead: 'After 7pm,', big: pct(after), unit: 'decaf',
      context: `${eveDecaf} of your ${eve.length} evening brews skipped the caffeine. Before 7pm, decaf is ${pct(before)}.`,
      viz: { kind: 'hlist', rows: [{ label: 'After 7pm', value: after * 100, texts: [pct(after)] }, { label: 'Before 7pm', value: before * 100, texts: [pct(before)] }] } satisfies Viz,
      link: { tab: 'Habits', section: 'Habits · Brew clock', href: seeMoreHref(y.year, 'habits') },
      card: { big: pct(after), label: 'decaf after 7pm' },
      score: after - before
    };
  }
};

export const POOL: FactDef[] = [total, streak, hour, decaf];
export const fact = (id: string) => POOL.find((f) => f.id === id)!;
