import { BREWER_TYPES, type Avg, type Board, type BrewerType, type Caffeine, type Ratings } from '$lib/insightsUrl';
import { grindKey, restDays, type BrewFact, type BagFact } from './facts';
import { BREW_KEY, leaderboard } from './leaderboards';
import { isFinished } from './overview';
import { countsForRating } from './ratings';
import { daysBetween, inPeriod, type Period } from './time';

export interface Holder { label: string; sub?: string; href?: string; date: string }
// mean / per100: a Best value pick's parts (its value is their ratio), for display. A "less your
// style" pick ranks by its adjusted delta (value) and shows its raw one (mean).
export interface Candidate { value: number; holder: Holder; detail?: string; mean?: number; per100?: number }
export interface RecordPick { value: number; holder: Holder; detail?: string; mean?: number; per100?: number; ties: Holder[] }
export type Section = 'taste' | 'volume' | 'freshness' | 'money' | 'extremes' | 'gentle';
export type Fmt = 'rating' | 'count' | 'grams' | 'days' | 'gpd' | 'money' | 'per100' | 'clock'
  | 'seconds' | 'ratio' | 'sd' | 'grind' | 'ml' | 'value' | 'delta';
export interface RecordDef {
  key: string; section: Section; label: string; fmt: Fmt;
  dir: 'max' | 'min';
  rating?: true; // follows Current/All (tile carries the switch)
  perDay?: true; // divided by household size under people=person
  scope?: 'alltime' | 'now'; // ignores Period (badge "All-time" / "Now")
  extremes?: true; // follows the brewer switch
  bought?: true; // bag-level money: only bags purchased in the window
  run: (c: RecCtx) => Candidate[];
}
export interface RecCtx {
  brews: readonly BrewFact[]; // already filtered to the window, brewer and nothing else
  bags: readonly BagFact[];
  ratings: Ratings;
  today: string;
}
export interface RecordTile extends RecordPick {
  key: string; section: Section; label: string; fmt: Fmt; rating: boolean; perDay: boolean;
  scope?: 'alltime' | 'now';
  allTime: RecordPick | null; // null = the period holder IS the all-time record (show the badge)
  was: RecordPick | null; // compare window's holder (null without Compare or when it had none)
}
export interface RecordsTab {
  sections: { key: Section; tiles: RecordTile[] }[]; // empty sections omitted
  topBrews: { rating: number; holder: Holder; brewer: string | null }[]; // ≤ 50, best first (10 shown, or top=20|50)
  topCoffees: { mean: number; brews: number; holder: Holder }[]; // ≤ 50 bags by mean rating, like Best bag (topc)
  perfectTens: { holder: Holder; count: number }[]; // every bag with a counted 10 in the period, most first
  brewerTypes: BrewerType[]; // types present in all-time data, for the switch
  coversAll: boolean; // the period starts on or before the first (filtered) brew: every record is all-time
}
export interface BagStat {
  coffeeId: number; rated: number[]; brews: BrewFact[]; // in brew order
  mean: number | null; sd: number | null; grams: number; first: string; last: string;
}

export function pick(cands: readonly Candidate[], dir: 'max' | 'min'): RecordPick | null {
  if (!cands.length) return null;
  const better = (a: number, b: number) => (dir === 'max' ? a > b : a < b);
  let best = cands[0].value;
  for (const c of cands) if (better(c.value, best)) best = c.value;
  // Float noise (means) mustn't split a tie.
  const tied = cands.filter((c) => Math.abs(c.value - best) < 1e-9).sort((a, b) => a.holder.date.localeCompare(b.holder.date));
  return { ...tied[0], value: best, ties: tied.slice(1).map((c) => c.holder) };
}

export const bagHolder = (bags: readonly BagFact[], id: number | null, date: string, sub?: string): Holder => {
  const b = bags.find((x) => x.id === id);
  return { label: b?.name ?? `Bag ${id}`, sub: sub ?? b?.roaster, ...(b?.slug ? { href: `/coffees/${b.slug}` } : {}), date };
};
const brewHolder = (c: RecCtx, b: BrewFact): Holder =>
  bagHolder(c.bags, b.coffeeId, b.localDate, [b.roaster, b.brewer].filter(Boolean).join(' · ') || undefined);
const minutes = (lt: string) => Number(lt.slice(11, 13)) * 60 + Number(lt.slice(14, 16));
const mean = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;
const sd = (xs: number[]) => { const m = mean(xs); return Math.sqrt(mean(xs.map((x) => (x - m) ** 2))); };
const groupBy = <T>(xs: readonly T[], key: (x: T) => string | number | null) => {
  const m = new Map<string | number, T[]>();
  for (const x of xs) { const k = key(x); if (k !== null) (m.get(k) ?? m.set(k, []).get(k)!).push(x); }
  return m;
};
const distinct = (xs: (string | null)[]) => new Set(xs.filter((x) => x !== null)).size;

export function bagStats(brews: readonly BrewFact[], ratings: Ratings): Map<number, BagStat> {
  const out = new Map<number, BagStat>();
  for (const [id, bs] of groupBy(brews, (b) => b.coffeeId)) {
    const rated = bs.filter((b) => countsForRating(b, ratings)).map((b) => b.rating!);
    out.set(id as number, {
      coffeeId: id as number, rated, brews: bs,
      mean: rated.length ? mean(rated) : null, sd: rated.length ? sd(rated) : null,
      grams: bs.reduce((s, b) => s + (b.dose && b.dose > 0 ? b.dose : 0), 0),
      first: bs[0].localDate, last: bs[bs.length - 1].localDate
    });
  }
  return out;
}

// Date of the bag's last counted rated brew: the moment its rating record was set.
const lastRatedDate = (s: BagStat, ratings: Ratings) =>
  [...s.brews].reverse().find((b) => countsForRating(b, ratings))?.localDate ?? s.last;

// One candidate per bag with at least `min` counted rated brews.
const perBag = (c: RecCtx, min: number, f: (s: BagStat, id: number) => Omit<Candidate, 'holder'> | null, only: (b: BrewFact) => boolean = () => true): Candidate[] =>
  [...bagStats(c.brews.filter(only), c.ratings).values()].flatMap((s) => {
    if (s.rated.length < min) return [];
    const r = f(s, s.coffeeId);
    return r ? [{ ...r, holder: bagHolder(c.bags, s.coffeeId, lastRatedDate(s, c.ratings)) }] : [];
  });

const usd = (n: number) => `$${n.toFixed(2)}`;
const g = (n: number) => `${n < 100 ? +n.toFixed(1) : Math.round(n)}g`;
const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`;
const rangeOf = (xs: number[]) => `${Math.min(...xs)}–${Math.max(...xs)}`;

// Bags with at least one counted 10, by how many (holder date = the bag's latest counted rating).
const tens = (c: RecCtx): Candidate[] => perBag(c, 1, (s) => {
  const n = s.rated.filter((x) => x === 10).length;
  return n ? { value: n } : null;
});

const dialed = (xs: number[]) => mean([...xs].sort((a, b) => b - a).slice(0, Math.ceil(xs.length / 2)));

// Per-day groups of brews, as candidates (day record holders are the day itself).
const perDay = (c: RecCtx, f: (bs: BrewFact[], day: string) => Omit<Candidate, 'holder'> | null): Candidate[] =>
  [...groupBy(c.brews, (b) => b.localDate)].flatMap(([day, bs]) => {
    const r = f(bs, day as string);
    return r ? [{ ...r, holder: { label: day as string, date: day as string } }] : [];
  });

// Rolling 24 h windows starting at each brew (start inclusive, +24 h exclusive).
const rolling = (c: RecCtx, f: (w: BrewFact[]) => number): Candidate[] => {
  const t = (b: BrewFact) => Date.parse(`${b.localTime}:00Z`);
  const bs = [...c.brews].sort((a, b) => a.localTime.localeCompare(b.localTime));
  const out: Candidate[] = [];
  let j = 0;
  bs.forEach((b, i) => {
    if (j < i) j = i;
    while (j < bs.length && t(bs[j]) - t(b) < 864e5) j++;
    if (b.coffeeId !== null) out.push({ value: f(bs.slice(i, j)), holder: brewHolder(c, b) });
  });
  return out;
};

// Brews that can name a bag: brew-held records skip the rest.
const held = (c: RecCtx) => c.brews.filter((b) => b.coffeeId !== null);

const clock = (c: RecCtx, only: (b: BrewFact) => boolean): Candidate[] =>
  held(c).filter((b) => !b.backfilled && only(b)).map((b) => ({ value: minutes(b.localTime), holder: brewHolder(c, b) }));

const bagCount = (c: RecCtx, f: (s: BagStat) => number): Candidate[] =>
  [...bagStats(c.brews, c.ratings).values()].map((s) => ({ value: f(s), holder: bagHolder(c.bags, s.coffeeId, s.last) }));

const taste = (key: string, label: string, dir: 'max' | 'min', fmt: Fmt, run: RecordDef['run']): RecordDef =>
  ({ key, section: 'taste', label, fmt, dir, rating: true, run });
const volume = (key: string, label: string, dir: 'max' | 'min', fmt: Fmt, run: RecordDef['run'], extra: Partial<RecordDef> = {}): RecordDef =>
  ({ key, section: 'volume', label, fmt, dir, run, ...extra });

const dayMean = (c: RecCtx) => perDay(c, (bs) => {
  const r = bs.filter((b) => countsForRating(b, c.ratings)).map((b) => b.rating!);
  return r.length >= 3 ? { value: mean(r), detail: plural(r.length, 'rated brew') } : null;
});

const bestBag = (only?: (b: BrewFact) => boolean) => (c: RecCtx) =>
  perBag(c, 3, (s) => ({ value: s.mean!, detail: plural(s.rated.length, 'rated brew') }), only);

// Pour-over floors: a 1:6.7 "ratio" or a 30 s "brew" is a typo or a different drink.
export const FLOORS: Partial<Record<BrewerType, { ratio: number; seconds: number }>> = { pourover: { ratio: 12, seconds: 60 } };

const sec = (section: Section, base: Partial<RecordDef> = {}) =>
  (key: string, label: string, dir: 'max' | 'min', fmt: Fmt, run: RecordDef['run'], extra: Partial<RecordDef> = {}): RecordDef =>
    ({ key, section, label, fmt, dir, run, ...base, ...extra });
const fresh = sec('freshness'), money = sec('money'), extreme = sec('extremes', { extremes: true }), gentle = sec('gentle', { rating: true });

// Bags with brews in the window, by first → last brew day (inclusive); `finished` keeps archived bags only.
const lifeSpans = (c: RecCtx, finished: boolean): Candidate[] =>
  [...bagStats(c.brews, c.ratings).values()].flatMap((s) => {
    const bag = c.bags.find((x) => x.id === s.coffeeId);
    return bag?.firstBrew && bag.lastBrew && (!finished || isFinished(bag))
      ? [{ value: daysBetween(bag.firstBrew, bag.lastBrew) + 1, detail: 'First to last brew', holder: bagHolder(c.bags, s.coffeeId, bag.lastBrew) }] : [];
  });
const restPick = (c: RecCtx): Candidate[] =>
  held(c).filter((b) => b.restDays !== null && b.restDays >= 0)
    .map((b) => ({ value: b.restDays!, ...(b.rating !== null ? { detail: `Rated: ${b.rating}` } : {}), holder: brewHolder(c, b) }));
const per100 = (c: RecCtx): Candidate[] =>
  c.bags.flatMap((b) => b.purchaseDate && b.cost && b.cost > 0 && b.amountG && b.amountG > 0
    ? [{ value: (b.cost / b.amountG) * 100, detail: `${usd(b.cost)} for ${g(b.amountG)}`, holder: bagHolder(c.bags, b.id, b.purchaseDate) }] : []);
// Cost per brew = dose × the bag's price per gram.
const cups = (c: RecCtx): Candidate[] =>
  held(c).filter((b) => b.costPerBrew !== null).map((b) => {
    const bag = c.bags.find((x) => x.id === b.coffeeId);
    const per100 = bag?.cost && bag.amountG ? `${usd((bag.cost / bag.amountG) * 100)}/100\u00a0g` : null;
    return { value: b.costPerBrew!, ...(per100 && b.dose ? { detail: `${g(b.dose)} at ${per100}` } : {}), holder: brewHolder(c, b) };
  });
// Mean rating ÷ $ per 100 g, for bags with ≥3 counted rated brews and a known price.
const value = (c: RecCtx): Candidate[] =>
  perBag(c, 3, (s, id) => {
    const bag = c.bags.find((x) => x.id === id);
    if (!bag?.cost || bag.cost <= 0 || !bag.amountG || bag.amountG <= 0) return null;
    const p = (bag.cost / bag.amountG) * 100;
    return { value: s.mean! / p, mean: s.mean!, per100: p, detail: `${s.mean!.toFixed(2)} at $${p.toFixed(2)}/100\u00a0g` };
  });
const spent = (bs: BagFact[]) => bs.reduce((s, b) => s + (b.cost ?? 0), 0);
const roasters = (c: RecCtx, f: (bs: BagFact[]) => number, detail: (bs: BagFact[]) => string): Candidate[] =>
  [...groupBy(c.bags.filter((b) => b.purchaseDate), (b) => b.roaster)].map(([r, bs]) => ({
    value: f(bs), detail: detail(bs), holder: { label: r as string, date: bs.map((b) => b.purchaseDate!).sort().pop()! }
  }));
const brewMetric = (c: RecCtx, get: (b: BrewFact) => number | null, ok: (b: BrewFact, v: number) => boolean = () => true,
  detail?: (b: BrewFact) => string | null): Candidate[] =>
  held(c).flatMap((b) => {
    const v = get(b), d = detail?.(b);
    return v !== null && v > 0 && ok(b, v) ? [{ value: v, ...(d ? { detail: d } : {}), holder: brewHolder(c, b) }] : [];
  });
// A ratio's inputs: dose to water.
const ratioIn = (b: BrewFact) => (b.dose && b.waterG ? `${g(b.dose)} to ${g(b.waterG)}` : null);
// Rated board groups with ≥3 bags, lowest adjusted rating, vs your average (the mean of the board's
// bag means, which the adjustment shrinks toward); shown as the group's raw mean vs it (spec: Eymen
// −2.51). The group's latest brew is its date.
const least = (board: Board) => (c: RecCtx): Candidate[] => {
  const lb = (avg: Avg) => leaderboard(c.brews, c.bags, { start: null, end: c.today }, board, 'rating', c.ratings, avg);
  const raw = lb('raw'), avg = raw.reduce((s, r) => s + r.value * r.bags, 0) / raw.reduce((s, r) => s + r.bags, 0);
  const rawMean = new Map(raw.map((r) => [r.key, r.value]));
  const rows = lb('adjusted').filter((r) => r.bags >= 3);
  // One group is the average itself: nothing to be lowest against.
  return rows.length < 2 ? [] : rows
    .map((r) => ({
      value: r.value - avg, mean: rawMean.get(r.key)! - avg,
      holder: {
        label: r.label, ...(r.href ? { href: r.href } : {}),
        date: c.brews.filter((b) => BREW_KEY[board](b) === r.key).map((b) => b.localDate).sort().pop()!
      }
    }));
};

export const RECORDS: RecordDef[] = [
  taste('bestBag', 'Best bag', 'max', 'rating', bestBag()),
  taste('bestBagDialed', 'Best bag, dialed in', 'max', 'rating', (c) =>
    perBag(c, 3, (s) => ({ value: dialed(s.rated), detail: `Best ${Math.ceil(s.rated.length / 2)} of ${s.rated.length} brews` }))),
  taste('dialJump', 'Biggest dial-in jump', 'max', 'rating', (c) => perBag(c, 2, (s) => {
    let best: Omit<Candidate, 'holder'> | null = null;
    for (let i = 1; i < s.rated.length; i++) {
      const d = s.rated[i] - s.rated[i - 1];
      if (d > 0 && (!best || d > best.value)) best = { value: d, detail: `${s.rated[i - 1]} → ${s.rated[i]}` };
    }
    return best;
  })),
  taste('climb', 'Biggest rating climb', 'max', 'rating', (c) => perBag(c, 2, (s) => {
    const top = Math.max(...s.rated);
    return top > s.rated[0] ? { value: top - s.rated[0], detail: `First ${s.rated[0]} → Best ${top} (brew ${s.rated.indexOf(top) + 1} of ${s.rated.length})` } : null;
  })),
  taste('holeInOne', 'Best on first brew', 'max', 'count', (c) => {
    const firsts = perBag(c, 3, (s) => (s.rated[0] === Math.max(...s.rated) ? { value: s.rated[0] } : null));
    const top = pick(firsts, 'max');
    return top ? [{ value: firsts.length, detail: `Of ${perBag(c, 3, () => ({ value: 0 })).length} bags with 3+ ratings`, holder: top.holder }] : [];
  }),
  taste('consistent', 'Most consistent bag', 'min', 'sd', (c) =>
    perBag(c, 5, (s) => ({ value: s.sd!, detail: `${s.rated.length} brews at ${s.mean!.toFixed(2)}` }))),
  taste('bestDay', 'Best day', 'max', 'rating', dayMean),
  taste('mostTens', 'Most perfect ratings', 'max', 'count', (c) => tens(c)),

  volume('mostBrewedBag', 'Most-brewed bag', 'max', 'count', (c) => bagCount(c, (s) => s.brews.length)),
  volume('mostGramsBag', 'Most grams from one bag', 'max', 'grams', (c) => bagCount(c, (s) => s.grams)),
  volume('marathon', 'Most brews of one bag in a day', 'max', 'count', (c) =>
    [...groupBy(c.brews, (b) => (b.coffeeId === null ? null : `${b.coffeeId}|${b.localDate}`)).values()]
      .map((bs) => ({ value: bs.length, holder: bagHolder(c.bags, bs[0].coffeeId, bs[0].localDate) })), { perDay: true }),
  volume('bagsInDay', 'Most bags brewed in one day', 'max', 'count', (c) =>
    perDay(c, (bs) => ({ value: distinct(bs.map((b) => (b.coffeeId === null ? null : String(b.coffeeId)))) })), { perDay: true }),
  volume('brews24h', 'Most brews in 24 hours', 'max', 'count', (c) => rolling(c, (w) => w.length), { perDay: true }),
  volume('grams24h', 'Most grams in 24 hours', 'max', 'grams', (c) => rolling(c, (w) => w.reduce((s, b) => s + (b.dose && b.dose > 0 ? b.dose : 0), 0)), { perDay: true }),
  volume('gearTour', 'Most brewers used on one bag', 'max', 'count', (c) =>
    [...bagStats(c.brews, c.ratings).values()].map((s) => ({
      value: distinct(s.brews.map((b) => b.brewer)),
      detail: [plural(distinct(s.brews.map((b) => b.dripper)), 'dripper'), plural(distinct(s.brews.map((b) => b.water)), 'water')]
        .filter((x) => !x.startsWith('0 ')).join(' · '),
      holder: bagHolder(c.bags, s.coffeeId, s.last)
    }))),
  volume('earlyBird', 'Early bird', 'min', 'clock', (c) => clock(c, () => true)),
  volume('nightOwl', 'Night owl', 'max', 'clock', (c) => clock(c, () => true)),

  fresh('fastestFinish', 'Fastest finish', 'min', 'days', (c) => lifeSpans(c, true)),
  fresh('drinkRate', 'Fastest drinking rate', 'max', 'gpd', (c) =>
    [...bagStats(c.brews, c.ratings).values()].flatMap((s) => {
      const d = distinct(s.brews.map((b) => b.localDate));
      const days = daysBetween(s.first, s.last) + 1;
      return d >= 2 || s.grams >= 100
        ? [{ value: s.grams / days, detail: `${g(s.grams)} over ${plural(days, 'day')}`, holder: bagHolder(c.bags, s.coffeeId, s.last) }] : [];
    })),
  fresh('lifetime', 'Longest bag lifetime', 'max', 'days', (c) => lifeSpans(c, false)),
  fresh('waitToOpen', 'Longest wait to open', 'max', 'days', (c) =>
    // Rest days at the first brew are already net of freezer time.
    [...bagStats(c.brews, c.ratings).values()].flatMap((s) => {
      const bag = c.bags.find((x) => x.id === s.coffeeId), rest = s.brews[0].restDays;
      return bag?.purchaseDate && bag.firstBrew === s.first && rest !== null && rest >= 0
        ? [{ value: rest, holder: bagHolder(c.bags, s.coffeeId, s.first) }] : [];
    })),
  fresh('oldestBrewed', 'Most days off roast', 'max', 'days', (c) => restPick(c)),
  fresh('freshestBrew', 'Fewest days off roast', 'min', 'days', (c) => restPick(c)),
  fresh('oldestWaiting', 'Oldest bag waiting', 'max', 'days', (c) =>
    c.bags.flatMap((b) => {
      const d = b.status === 'backlog' && b.firstBrew === null && b.purchaseDate
        ? restDays(b.purchaseDate, b.frozenStart ?? null, b.frozenEnd ?? null, c.today) : null;
      return d === null ? [] : [{ value: d, detail: 'Unopened since bought', holder: bagHolder(c.bags, b.id, b.purchaseDate!) }];
    }), { scope: 'now' }),

  money('priciestBag', 'Priciest bag per 100\u00a0g', 'max', 'per100', (c) => per100(c), { bought: true }),
  money('cheapestBag', 'Cheapest bag per 100\u00a0g', 'min', 'per100', (c) => per100(c), { bought: true }),
  money('priciestCup', 'Priciest cup', 'max', 'money', (c) => cups(c)),
  money('cheapestCup', 'Cheapest cup', 'min', 'money', (c) => cups(c)),
  money('bestValue', 'Best value for money', 'max', 'value', (c) => value(c), { rating: true }),
  money('buyingMonth', 'Biggest buying month', 'max', 'count', (c) =>
    [...groupBy(c.bags, (b) => b.purchaseDate?.slice(0, 7) ?? null)].map(([m, bs]) => ({
      value: bs.length, detail: `${usd(spent(bs))} spent`, holder: { label: m as string, date: `${m}-01` }
    })), { scope: 'alltime' }),
  money('roasterBags', 'Most bags from one roaster', 'max', 'count', (c) => roasters(c, (bs) => bs.length, (bs) => `${usd(spent(bs))} spent`), { bought: true }),
  money('roasterSpend', 'Most spent at one roaster', 'max', 'money', (c) => roasters(c, spent, (bs) => `${plural(bs.length, 'bag')} bought`), { bought: true }),

  extreme('doseHeavy', 'Heaviest dose', 'max', 'grams', (c) => brewMetric(c, (b) => b.dose)),
  extreme('doseLight', 'Lightest dose', 'min', 'grams', (c) => brewMetric(c, (b) => b.dose)),
  extreme('ratioLong', 'Longest ratio', 'max', 'ratio', (c) => brewMetric(c, (b) => b.ratio, (b, v) => v >= (FLOORS[b.brewerType]?.ratio ?? 0), ratioIn)),
  extreme('ratioShort', 'Shortest ratio', 'min', 'ratio', (c) => brewMetric(c, (b) => b.ratio, (b, v) => v >= (FLOORS[b.brewerType]?.ratio ?? 0), ratioIn)),
  extreme('bloomLong', 'Longest bloom', 'max', 'seconds', (c) => brewMetric(c, (b) => b.bloomSeconds)),
  extreme('bloomShort', 'Shortest bloom', 'min', 'seconds', (c) => brewMetric(c, (b) => b.bloomSeconds)),
  extreme('brewTimeLong', 'Longest brew', 'max', 'seconds', (c) => brewMetric(c, (b) => b.brewTimeSeconds, (b, v) => v >= (FLOORS[b.brewerType]?.seconds ?? 0))),
  extreme('brewTimeShort', 'Shortest brew', 'min', 'seconds', (c) => brewMetric(c, (b) => b.brewTimeSeconds, (b, v) => v >= (FLOORS[b.brewerType]?.seconds ?? 0))),
  extreme('waterMost', 'Most water in one brew', 'max', 'ml', (c) => brewMetric(c, (b) => b.waterG)),

  gentle('lowestBag', 'Lowest-rated bag', 'min', 'rating', bestBag()),
  gentle('biggestDip', 'Biggest rating drop', 'max', 'rating', (c) => perBag(c, 2, (s) => {
    let best: Omit<Candidate, 'holder'> | null = null;
    for (let i = 1; i < s.rated.length; i++) {
      const d = s.rated[i - 1] - s.rated[i];
      if (d > 0 && (!best || d > best.value)) best = { value: d, detail: `${s.rated[i - 1]} → ${s.rated[i]}` };
    }
    return best;
  })),
  gentle('wildest', 'Least consistent bag', 'max', 'sd', (c) =>
    perBag(c, 5, (s) => ({ value: s.sd!, detail: `Ratings ranged ${rangeOf(s.rated)} over ${s.rated.length} brews` }))),
  gentle('slowestPeak', 'Slowest to peak', 'max', 'count', (c) => perBag(c, 5, (s) => {
    const i = s.rated.indexOf(Math.max(...s.rated));
    return { value: i + 1, detail: `Best brew was #${i + 1} of ${s.rated.length}` };
  })),
  gentle('leastRoaster', 'Lowest-rated roaster', 'min', 'delta', least('roasters')),
  gentle('leastOrigin', 'Lowest-rated origin', 'min', 'delta', least('origins')),
  gentle('leastProcess', 'Lowest-rated process', 'min', 'delta', least('process')),
  gentle('leastRoast', 'Lowest-rated roast', 'min', 'delta', least('roast')),
  gentle('toughValue', 'Least value for money', 'min', 'value', (c) => value(c)),
  gentle('toughDay', 'Lowest-rated day', 'min', 'rating', dayMean)
];

// Grind extremes are generated per grinder. Value = the setting as a base-1000 fraction (2.4.1 →
// 2.004001), so it orders like the setting and stays comparable between windows; detail = the text.
// ponytail: settings with a part ≥ 1000 or more than 3 parts lose resolution.
const grindDefs = (brews: readonly BrewFact[]): RecordDef[] =>
  [...new Set(brews.map((b) => b.grinder).filter((g): g is string => !!g))].flatMap((g) => {
    const run = (c: RecCtx): Candidate[] => held(c).flatMap((b) => {
      const k = b.grinder === g ? grindKey(b.grind) : null;
      return k ? [{ value: k.reduce((s, n, i) => s + n / 1000 ** i, 0), detail: b.grind!, holder: brewHolder(c, b) }] : [];
    });
    return [extreme(`grindFine:${g}`, `Finest grind · ${g}`, 'min', 'grind', run), extreme(`grindCoarse:${g}`, `Coarsest grind · ${g}`, 'max', 'grind', run)];
  });

export interface RecordsCtx {
  period: Period; prev: Period | null; ratings: Ratings; brewer?: BrewerType; caffeine?: Caffeine; size: number; today: string;
}

const SECTIONS: Section[] = ['taste', 'volume', 'freshness', 'money', 'extremes', 'gentle'];
const bagsIn = (bags: readonly BagFact[], w: Period | null) => (w ? bags.filter((b) => b.purchaseDate && inPeriod(b.purchaseDate, w)) : []);

export function recordsTab(allBrews: readonly BrewFact[], allBags: readonly BagFact[], c: RecordsCtx): RecordsTab {
  const all: Period = { start: null, end: c.today };
  // Caffeine filters every record's brews and bags; the brewer switch still offers every type.
  const caf = <T extends { decaf: boolean }>(x: T) => !c.caffeine || x.decaf === (c.caffeine === 'decaf');
  const brews = allBrews.filter(caf), bags = allBags.filter(caf);
  const ctx = (w: Period | null, def?: RecordDef): RecCtx => ({
    brews: w ? brews.filter((b) => inPeriod(b.localDate, w) && (!def?.extremes || !c.brewer || b.brewerType === c.brewer)) : [],
    bags: def?.bought ? bagsIn(bags, w) : bags, ratings: c.ratings, today: c.today
  });
  const tiles: RecordTile[] = [];
  for (const def of [...RECORDS, ...grindDefs(brews)]) {
    const p = (w: Period | null) => (w ? pick(def.run(ctx(w, def)), def.dir) : null);
    const cur = p(def.scope ? all : c.period);
    if (!cur) continue;
    const ever = def.scope ? null : p(all);
    const was = def.scope ? null : p(c.prev);
    const split = (x: RecordPick | null) => (x && def.perDay && c.size > 1 ? { ...x, value: x.value / c.size } : x);
    const same = ever && Math.abs(ever.value - cur.value) < 1e-9 && ever.holder.label === cur.holder.label && ever.holder.date === cur.holder.date;
    tiles.push({
      key: def.key, section: def.section, label: def.label, fmt: def.fmt, rating: !!def.rating, perDay: !!def.perDay,
      ...(def.scope ? { scope: def.scope } : {}), ...split(cur)!, allTime: same ? null : split(ever), was: split(was)
    });
  }
  const inP = ctx(c.period);
  const rated = held(inP).filter((b) => b.rating !== null && countsForRating(b, c.ratings));
  const top = [...rated].sort((a, b) => b.rating! - a.rating! || a.localDate.localeCompare(b.localDate));
  const row = (b: BrewFact) => ({ holder: brewHolder(inP, b), brewer: b.brewer });
  return {
    sections: SECTIONS.map((key) => ({ key, tiles: tiles.filter((t) => t.section === key) })).filter((s) => s.tiles.length),
    topBrews: top.slice(0, 50).map((b) => ({ rating: b.rating!, ...row(b) })),
    // Bags with 3+ counted rated brews (Best bag's rule), best mean first.
    topCoffees: [...bagStats(inP.brews, c.ratings).values()].filter((s) => s.rated.length >= 3)
      .map((s) => ({ mean: s.mean!, brews: s.rated.length, holder: bagHolder(inP.bags, s.coffeeId, lastRatedDate(s, c.ratings)) }))
      .sort((a, b) => b.mean - a.mean || a.holder.date.localeCompare(b.holder.date)).slice(0, 50),
    perfectTens: tens(inP).sort((a, b) => b.value - a.value || a.holder.date.localeCompare(b.holder.date))
      .map((x) => ({ holder: x.holder, count: x.value })),
    brewerTypes: BREWER_TYPES.filter((t) => allBrews.some((b) => b.brewerType === t)),
    coversAll: !c.period.start || !brews.length || c.period.start <= brews[0].localDate
  };
}
