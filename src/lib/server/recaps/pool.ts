import { MON } from '$lib/insightsUrl';
import { fmtInt, fmtKg, fmtLitres, usd } from '$lib/recapFormat';
import { seeMoreHref } from '$lib/recapsUrl';
import type { BrewFact } from '$lib/server/insights/facts';
import { longestStreak } from '$lib/server/insights/habits';
import { leaderboard, country } from '$lib/server/insights/leaderboards';
import { bagStats } from '$lib/server/insights/records';
import { countsForRating } from '$lib/server/insights/ratings';
import type { Board } from '$lib/insightsUrl';
import { pick, RECORDS } from '$lib/server/insights/records';
import { addDays } from '$lib/server/insights/time';
import { sweetSpotsTab } from '$lib/server/insights/lab';
import { RATINGS_SETTLED_FROM } from '$lib/server/insights/ratings';
import { recipeBand } from '$lib/server/insights/pours';
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

// ---- Coffees: who the coffee came from -------------------------------------------------------
const poss = (n: string) => (n.endsWith('s') ? `${n}'` : `${n}'s`);
const nBags = (n: number) => `${n} bag${n === 1 ? '' : 's'}`;
const andList = (xs: string[]) => (xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs.at(-1)}`);
const grams = (y: YearCtx) => y.brews.reduce((s, b) => s + (b.dose ?? 0), 0); // unlinked brews count: "of your coffee"
const bagCount = (y: YearCtx) => new Set(y.brews.map((b) => b.coffeeId).filter((c) => c !== null)).size;
const MONTH = (m: number) => new Date(Date.UTC(2000, m, 1)).toLocaleString('en-US', { month: 'long', timeZone: 'UTC' });

// Share-of-coffee boards (roasters, origins, producers): [null] under 2 rows.
function shareFact(id: string, board: Board, lead: string, section: string, label: string, extra: { href?: Record<string, string>; context: (top: BoardRowLite, share: number, rows: BoardRowLite[], y: YearCtx) => string; texts: (r: BoardRowLite, share: number) => string[]; minBags?: number }): FactDef {
  return {
    id, category: 'coffees',
    run: (y) => {
      const rows = leaderboard(y.brews, y.bags, y.period, board, 'grams', 'current', 'raw', false);
      if (rows.length < 2 || bagCount(y) < (extra.minBags ?? 0)) return null;
      const all = grams(y), top = rows[0], share = top.value / all;
      return {
        id, category: 'coffees', lead, big: top.label, context: extra.context(top, share, rows, y),
        viz: { kind: 'hlist', rows: rows.slice(0, 5).map((r) => ({ label: r.label, value: r.value, texts: extra.texts(r, r.value / all) })) },
        link: { tab: 'Leaderboards', section: `Leaderboards · ${section}`, href: seeMoreHref(y.year, 'leaderboards', extra.href ?? { rank: 'grams' }) },
        card: { big: top.label, label }, score: share
      };
    }
  };
}
type BoardRowLite = { label: string; value: number; bags: number };

const roaster = shareFact('roaster', 'roasters', 'Top roaster', 'Roasters', 'top roaster', {
  minBags: 3,
  context: (top, share, rows) => {
    const bl = rows.reduce((a, r) => (r.bags > a.bags ? r : a), top); // ties keep the top roaster
    return `${pct(share)} of your coffee: ${fmtKg(top.value)} over ${nBags(top.bags)}.${bl === top ? '' : ` You went through more bags of ${bl.label} (${bl.bags}), but less coffee (${fmtKg(bl.value)}).`}`;
  },
  texts: (r, s) => [pct(s), fmtKg(r.value), nBags(r.bags)]
});
const origin = shareFact('origin', 'origins', 'Top origin', 'Origins', 'top origin', {
  href: { open: 'origins' },
  context: (top, share, rows) => `${pct(share)} of everything you brewed: ${fmtKg(top.value)} from ${nBags(top.bags)}, out of ${rows.length} origins.`,
  texts: (r) => [fmtKg(r.value)]
});
const producer = shareFact('producer', 'producers', 'Top producer', 'Producers', 'top producer', {
  context: (top, share) => `${pct(share)} of your coffee: ${fmtKg(top.value)} over ${nBags(top.bags)}.`,
  texts: (r) => [fmtKg(r.value)]
});

// producer -> roaster -> bags brewed in the year
function producerRoasterMap(y: YearCtx) {
  const m = new Map<string, Map<string, Set<number>>>();
  for (const b of y.brews) {
    const p = b.producer?.trim();
    if (!p || !b.roaster || b.coffeeId === null) continue;
    const rs = m.get(p) ?? m.set(p, new Map()).get(p)!;
    (rs.get(b.roaster) ?? rs.set(b.roaster, new Set()).get(b.roaster)!).add(b.coffeeId);
  }
  return m;
}
const byBags = (rs: Map<string, Set<number>>) => [...rs].map(([r, s]) => ({ r, n: s.size })).sort((a, b) => b.n - a.n || a.r.localeCompare(b.r));

const producerRoasters: FactDef = {
  id: 'producer-roasters', category: 'coffees',
  run: (y) => {
    const best = [...producerRoasterMap(y)].filter(([, rs]) => rs.size >= 2)
      .sort((a, b) => b[1].size - a[1].size || a[0].localeCompare(b[0]))[0];
    if (!best) return null;
    const [p, rs] = best, rows = byBags(rs);
    return {
      id: 'producer-roasters', category: 'coffees',
      lead: `One producer, ${rs.size} roasters`, big: p,
      context: `You bought ${poss(p)} coffee from ${andList(rows.map((x) => x.r))}.`,
      viz: { kind: 'hlist', rows: rows.map((x) => ({ label: x.r, value: x.n, texts: [nBags(x.n)] })) },
      link: { tab: 'Leaderboards', section: 'Leaderboards · Producers', href: seeMoreHref(y.year, 'leaderboards', { rank: 'grams' }) },
      card: { big: p, label: `from ${rs.size} roasters` }, score: Math.min(1, (rs.size - 1) / 3)
    };
  }
};

const turn: FactDef = {
  id: 'turn', category: 'coffees',
  run: (y) => {
    const m0 = Number(y.brews[0].localDate.slice(5, 7)) - 1, m1 = Number(y.brews.at(-1)!.localDate.slice(5, 7)) - 1;
    const n = m1 - m0 + 1;
    if (n < 6) return null;
    const k = Math.floor(n / 3);
    const inMonths = (a: number, z: number) => y.brews.filter((b) => { const m = Number(b.localDate.slice(5, 7)) - 1; return m >= a && m <= z; });
    const early = inMonths(m0, m0 + k - 1), late = inMonths(m1 - k + 1, m1);
    if (early.length < 30 || late.length < 30) return null;
    const share = (bs: readonly BrewFact[], key: (b: BrewFact) => string | null) => {
      const c = new Map<string, number>();
      for (const b of bs) { const v = key(b); if (v) c.set(v, (c.get(v) ?? 0) + 1); }
      return { c, of: bs.length, top: [...c].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])) };
    };
    const ke = share(early, (b) => country(b.origin)), kl = share(late, (b) => country(b.origin));
    const A = ke.top[0]?.[0], B = kl.top[0]?.[0];
    if (!A || !B || A === B) return null;
    const pe = (ke.c.get(B) ?? 0) / ke.of, pl = kl.c.get(B)! / kl.of;
    const win = (a: number, z: number) => `${MON[a]}–${MON[z]}`;
    const wE = win(m0, m0 + k - 1), wL = win(m1 - k + 1, m1);
    let context = `${A} was ${pct(ke.c.get(A)! / ke.of)} of ${wE} brews. ${wL}, ${B} leads at ${pct(pl)}.`;
    const group = (b: BrewFact) => (b.processGroup === 'Other / Unknown' ? null : b.processGroup);
    const g = share(y.brews, group).top[0]?.[0];
    if (g) {
      const ge = (share(early, group).c.get(g) ?? 0) / early.length, gl = (share(late, group).c.get(g) ?? 0) / late.length;
      if (Math.abs(gl - ge) >= 0.1) context += ` ${g} ${gl > ge ? 'rose' : 'fell'} from ${pct(ge)} to ${pct(gl)}.`;
    }
    const both = new Map<string, number>();
    for (const x of [ke, kl]) for (const [o, c] of x.c) both.set(o, (both.get(o) ?? 0) + c);
    const keys = [A, B, ...[...both].sort((a, b) => b[1] - a[1]).map(([o]) => o).filter((o) => o !== A && o !== B)].slice(0, 3);
    const seg = (name: string, x: ReturnType<typeof share>) => {
      const segs = keys.map((o) => ({ label: o, pct: Math.round(((x.c.get(o) ?? 0) / x.of) * 100) })).filter((s) => s.pct > 0).sort((a, b) => b.pct - a.pct);
      const rest = 100 - segs.reduce((s, x) => s + x.pct, 0);
      return { name, segs: rest > 0 ? [...segs, { label: 'Other', pct: rest }] : segs };
    };
    return {
      id: 'turn', category: 'coffees',
      lead: `Since ${MONTH(m1 - k + 1)}, your most brewed origin is`, big: B, context,
      viz: { kind: 'split', periods: [seg(wE, ke), seg(wL, kl)], keys },
      // ponytail: Leaderboards has no origin over-time view yet (VIEW_BOARDS), so this opens the Origins board.
      link: { tab: 'Leaderboards', section: 'Leaderboards · Origins', href: seeMoreHref(y.year, 'leaderboards', { open: 'origins' }) },
      wide: true, card: { big: B, label: `since ${MONTH(m1 - k + 1)}` }, score: pl - pe
    };
  }
};

const record: FactDef = {
  id: 'record', category: 'coffees',
  run: (y) => {
    const def = RECORDS.find((r) => r.key === 'bestBag')!;
    const cands = def.run({ brews: y.scored, bags: y.bags, ratings: 'current', today: y.today }).sort((a, b) => b.value - a.value);
    const win = pick(cands, 'max');
    if (!win) return null;
    const bagOf = (h: { href?: string; label: string; sub?: string }) =>
      y.bags.find((b) => (h.href ? h.href === `/coffees/${b.slug}` : b.name === h.label && b.roaster === h.sub));
    const stats = bagStats(y.scored, 'current');
    const bag = bagOf(win.holder);
    if (!bag) return null;
    const n = stats.get(bag.id)!.rated.length;
    const tens = y.scored.filter((b) => b.rating === 10 && countsForRating(b, 'current')).length;
    const proc = (bag.processing ?? '').toLowerCase();
    let context = `${poss(bag.roaster)} ${bag.name}${proc ? `, ${proc}` : ''}: average over ${n} brews.`;
    if (tens) context += ` ${tens} brew${tens === 1 ? '' : 's'} all year earned a 10.`;
    const others = bag.producer ? byBags(producerRoasterMap(y).get(bag.producer.trim()) ?? new Map()).map((x) => x.r).filter((r) => r !== bag.roaster) : [];
    if (others.length) context += ` ${poss(bag.producer!.trim())} coffee also came from ${andList(others)}.`;
    const top = cands.slice(0, 5), vals = top.map((c) => c.value);
    return {
      id: 'record', category: 'coffees', lead: 'Best bag of the year', big: win.value.toFixed(2), context,
      viz: {
        kind: 'dots', stack: true,
        rows: top.map((c) => { const b = bagOf(c.holder)!; return { label: `${b.roaster} · ${b.name}`, value: c.value, brews: stats.get(b.id)!.rated.length }; }),
        lo: Math.floor((Math.min(...vals) - 0.1) * 10) / 10, hi: Math.ceil((Math.max(...vals) + 0.05) * 10) / 10
      },
      link: { tab: 'Highlights', section: 'Highlights · Records', href: seeMoreHref(y.year, 'records') },
      card: { big: win.value.toFixed(2), label: 'best bag' }, score: Math.min(1, (win.value - (cands[1]?.value ?? 0)) / 0.5)
    };
  }
};
const price: FactDef = {
  id: 'price', category: 'money',
  run: (y) => {
    const priced = y.brews.filter((b) => b.costPerBrew !== null && b.coffeeId !== null);
    if (priced.length < 10) return null;
    const top = priced.reduce((a, b) => (b.costPerBrew! > a.costPerBrew! ? b : a));
    const avg = priced.reduce((s, b) => s + b.costPerBrew!, 0) / priced.length;
    const bag = y.bags.find((b) => b.id === top.coffeeId);
    const rated = countsForRating(top, 'current') ? ` You rated it ${top.rating}.` : '';
    const big = usd(top.costPerBrew!);
    return {
      id: 'price', category: 'money', lead: 'Priciest cup', big,
      context: `${top.dose}g of ${poss(bag?.roaster ?? top.roaster ?? '')} ${bag?.name ?? 'coffee'} on ${md(top.localDate)}.${rated} Your average cup costs ${usd(avg)}.`,
      viz: { kind: 'hlist', rows: [{ label: 'Priciest cup', value: top.costPerBrew!, texts: [big] }, { label: 'Average cup', value: avg, texts: [usd(avg)] }] },
      link: { tab: 'Habits', section: 'Habits · Spend', href: seeMoreHref(y.year, 'spend') },
      card: { big, label: 'priciest cup' }, score: Math.min(1, top.costPerBrew! / avg / 5)
    };
  }
};

// ---- Brewing: recipe, ratio, rest ------------------------------------------------------------
type Month = { m: number; bs: BrewFact[] };
const byMonth = (bs: readonly BrewFact[]): Month[] => {
  const g = new Map<number, BrewFact[]>();
  for (const b of bs) { const m = Number(b.localDate.slice(5, 7)) - 1; (g.get(m) ?? g.set(m, []).get(m)!).push(b); }
  return [...g].sort((a, b) => a[0] - b[0]).map(([m, bs]) => ({ m, bs }));
};
const avg = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;
const spark = (months: Month[], v: (m: Month) => number, text: (v: number) => string): Viz => {
  const values = months.map(v);
  return { kind: 'spark', values, labels: months.map((x) => MON[x.m]), texts: values.map(text) };
};
// Mean of `f` per month for months with at least `min` values.
const monthMeans = (y: YearCtx, f: (b: BrewFact) => number | null, min: number) =>
  byMonth(y.brews).map(({ m, bs }) => ({ m, bs: bs.filter((b) => f(b) !== null) })).filter((x) => x.bs.length >= min);

const recipe: FactDef = {
  id: 'recipe', category: 'brewing',
  run: (y) => {
    const band = recipeBand(y.pours.facts, y.pours.recipes);
    const label = (b: BrewFact) => { const l = band(b)?.label; return l && l !== 'No recipe' ? l : null; };
    const months = byMonth(y.brews).filter((x) => x.bs.length >= 20);
    if (months.length < 3) return null;
    const share = (x: Month, r: string) => x.bs.filter((b) => label(b) === r).length / x.bs.length;
    const names = new Set(y.brews.map(label).filter((l): l is string => l !== null));
    let best: { r: string; rise: number; peak: Month; first: number; top: number } | null = null;
    for (const r of [...names].sort()) {
      const shares = months.map((x) => share(x, r)), top = shares.indexOf(Math.max(...shares));
      const rise = shares[top] - shares[0];
      if (!best || rise > best.rise) best = { r, rise, peak: months[top], first: shares[0], top: shares[top] };
    }
    if (!best || best.rise < 0.3) return null;
    const { r, peak } = best;
    const counts = new Map<string, number>();
    for (const b of y.brews) { const l = label(b); if (l) counts.set(l, (counts.get(l) ?? 0) + 1); }
    const [topName, topN] = [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0];
    let context = `of ${MONTH(peak.m)}'s brews, from ${pct(best.first)} in ${MONTH(months[0].m)}.`;
    if (topName !== r) context += ` ${topName} is still the year's most-used recipe: ${pct(topN / y.brews.length)} of all brews (${fmtInt(topN)}).`;
    return {
      id: 'recipe', category: 'brewing', lead: `${r} took over:`, big: pct(best.top), context,
      viz: spark(months, (x) => Math.round(share(x, r) * 100), (v) => `${v}%`),
      link: { tab: 'Lab', section: 'Lab · Pours', href: seeMoreHref(y.year, 'pours') },
      wide: true, card: { big: pct(best.top), label: `${r} brews` }, score: best.rise
    };
  }
};

// The simplest of halves to fifths within 3 points of `s`: "2 in 3"; null when none is close.
const simpleFraction = (s: number) => {
  let best: [number, number] | null = null;
  for (let m = 2; m <= 5; m++) for (let k = 1; k < m; k++) if (Math.abs(k / m - s) <= 0.03 && (!best || Math.abs(k / m - s) < Math.abs(best[0] / best[1] - s) - 1e-9)) best = [k, m];
  return best;
};

const ratio: FactDef = {
  id: 'ratio', category: 'brewing',
  run: (y) => {
    const withRatio = y.brews.filter((b) => b.ratio !== null);
    if (withRatio.length < 30) return null;
    const c = new Map<number, number>();
    for (const b of withRatio) { const r = Math.round(b.ratio!); c.set(r, (c.get(r) ?? 0) + 1); }
    const [mode, n] = [...c].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0];
    const share = n / withRatio.length;
    if (share < 0.4) return null;
    const f = simpleFraction(share);
    let context = `1g of coffee to ${mode}g of water, in ${fmtInt(n)} of ${fmtInt(withRatio.length)} brews.`;
    let viz: Viz | undefined;
    const tm = monthMeans(y, (b) => b.tempC, 10);
    if (tm.length >= 3) {
      const t = tm.map((x) => avg(x.bs.map((b) => b.tempC!))), drift = t.at(-1)! - t[0];
      if (Math.abs(drift) >= 1) {
        context += ` And the kettle ${drift < 0 ? 'cooled off' : 'warmed up'} all year: ${t[0].toFixed(1)}°C on average in ${MONTH(tm[0].m)}, ${t.at(-1)!.toFixed(1)}°C in ${MONTH(tm.at(-1)!.m)}.`;
        viz = spark(tm, (x) => avg(x.bs.map((b) => b.tempC!)), (v) => `${v.toFixed(1)}°C`);
      }
    }
    return {
      id: 'ratio', category: 'brewing',
      lead: f ? `${f[0]} in ${f[1]} brews used a` : `${pct(share)} of brews used a`, big: `1:${mode}`, unit: 'brew ratio', context, ...(viz && { viz }),
      link: { tab: 'Lab', section: 'Lab · Brewing', href: seeMoreHref(y.year, 'brewing', { temp: 'exact' }) },
      card: { big: `1:${mode}`, label: 'brew ratio' }, score: share
    };
  }
};

const dLabel = (l: string) => l.replace(/(\d+)(\+)?$/, '$1d$2');

const rest: FactDef = {
  id: 'rest', category: 'brewing',
  run: (y) => {
    const link = { tab: 'Lab', section: 'Lab · Sweet spots', href: seeMoreHref(y.year, 'sweetspots') };
    const spot = sweetSpotsTab(y.scored, y.bags, { period: y.period, ratings: 'current', grinder: null, filters: {}, all: y.scored }).cards.find((c) => c.key === 'rest')?.spot;
    const bestBand = spot?.bands.find((b) => b.label === spot.best?.label);
    if (spot?.verdict === 'win' && spot.best && bestBand && !bestBand.sample.small) {
      // The card's own figures: tier 2 compares band means (best against the usual band, or the runner-up when best is
      // the usual one); tier 1's value is already a same-bag delta against the other rests.
      const cmp = spot.tier === 2 ? (spot.usual.label !== spot.best.label ? { label: spot.usual.label, v: spot.usual.mean } : spot.next && { label: spot.next.label, v: spot.next.value }) : null;
      const gap = spot.tier === 1 ? spot.best.value : cmp ? spot.best.value - cmp.v : null;
      if (gap !== null && gap > 0) {
        const since = `since ${MONTH(Number(RATINGS_SETTLED_FROM.slice(5, 7)) - 1)}`;
        const rows = spot.bands.filter((b) => b.value !== null).map((b) => ({ label: dLabel(b.label), value: b.value!, brews: b.brews }));
        const vals = rows.map((r) => r.value);
        const big = dLabel(spot.best.label);
        return {
          id: 'rest', category: 'brewing', lead: 'Rest sweet spot', big,
          context: cmp ? `${spot.best.value.toFixed(2)} average ${since}, against ${cmp.v.toFixed(2)} at ${dLabel(cmp.label)}.` : `+${gap.toFixed(2)} ${since}, against the same bags at other rests.`,
          viz: { kind: 'dots', rows, lo: Math.floor(Math.min(...vals) * 10) / 10, hi: Math.ceil(Math.max(...vals) * 10) / 10 },
          link, card: { big, label: 'rest sweet spot' }, score: Math.min(1, gap / 0.5)
        };
      }
    }
    const ms = monthMeans(y, (b) => b.restDays, 10);
    if (ms.length < 2) return null;
    const v = ms.map((x) => avg(x.bs.map((b) => b.restDays!))), shift = v.at(-1)! - v[0];
    if (Math.abs(shift) < 14) return null;
    const d = `${Math.round(v.at(-1)!)}d`;
    return {
      id: 'rest', category: 'brewing', lead: 'Your beans now wait', big: d,
      context: `on average, ${shift > 0 ? 'up' : 'down'} from ${Math.round(v[0])}d in ${MONTH(ms[0].m)}.`,
      viz: spark(ms, (x) => Math.round(avg(x.bs.map((b) => b.restDays!))), (n) => `${n}d`),
      link, card: { big: d, label: 'average rest' }, score: Math.min(1, Math.abs(shift) / 60)
    };
  }
};

export const POOL: FactDef[] = [total, streak, hour, decaf, roaster, origin, producer, producerRoasters, turn, record, price, recipe, ratio, rest];
export const fact = (id: string) => POOL.find((f) => f.id === id)!;
