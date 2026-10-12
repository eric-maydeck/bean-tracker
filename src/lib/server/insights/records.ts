import { BREWER_TYPES, type Board, type BrewerType, type Ratings } from '$lib/insightsUrl';
import { grindKey, restDays, type BrewFact, type BagFact } from './facts';
import { BREW_KEY, leaderboard } from './leaderboards';
import { isFinished } from './overview';
import { countsForRating } from './ratings';
import { daysBetween, inPeriod, type Period } from './time';

export interface Holder { label: string; sub?: string; href?: string; date: string }
export interface Candidate { value: number; holder: Holder; detail?: string }
export interface RecordPick { value: number; holder: Holder; detail?: string; ties: Holder[] }
export type Section = 'taste' | 'volume' | 'freshness' | 'money' | 'extremes' | 'gentle';
export type Fmt = 'rating' | 'count' | 'grams' | 'days' | 'gpd' | 'money' | 'per100' | 'clock'
  | 'seconds' | 'ratio' | 'sd' | 'grind' | 'ml' | 'value';
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
  topBrews: { rating: number; holder: Holder; brewer: string | null }[]; // ≤ 10, best first
  perfectTens: { holder: Holder; brewer: string | null }[];
  brewerTypes: BrewerType[]; // types present in all-time data, for the switch
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
  return { value: best, holder: tied[0].holder, ...(tied[0].detail ? { detail: tied[0].detail } : {}), ties: tied.slice(1).map((c) => c.holder) };
}

const bagHolder = (bags: readonly BagFact[], id: number | null, date: string, sub?: string): Holder => {
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
  return r.length >= 3 ? { value: mean(r), detail: `${r.length} brews` } : null;
});

const bestBag = (only?: (b: BrewFact) => boolean) => (c: RecCtx) =>
  perBag(c, 3, (s) => ({ value: s.mean!, detail: `${s.rated.length} brews` }), only);

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
      ? [{ value: daysBetween(bag.firstBrew, bag.lastBrew) + 1, holder: bagHolder(c.bags, s.coffeeId, bag.lastBrew) }] : [];
  });
const restPick = (c: RecCtx): Candidate[] =>
  held(c).filter((b) => b.restDays !== null && b.restDays >= 0)
    .map((b) => ({ value: b.restDays!, ...(b.rating !== null ? { detail: `rated ${b.rating}` } : {}), holder: brewHolder(c, b) }));
const per100 = (c: RecCtx): Candidate[] =>
  c.bags.flatMap((b) => b.purchaseDate && b.cost && b.cost > 0 && b.amountG && b.amountG > 0
    ? [{ value: (b.cost / b.amountG) * 100, holder: bagHolder(c.bags, b.id, b.purchaseDate) }] : []);
const cups = (c: RecCtx): Candidate[] =>
  held(c).filter((b) => b.costPerBrew !== null)
    .map((b) => ({ value: b.costPerBrew!, ...(b.rating !== null ? { detail: `rated ${b.rating}` } : {}), holder: brewHolder(c, b) }));
// Mean rating ÷ $ per 100 g, for bags with ≥3 counted rated brews and a known price.
const value = (c: RecCtx): Candidate[] =>
  perBag(c, 3, (s, id) => {
    const bag = c.bags.find((x) => x.id === id);
    if (!bag?.cost || bag.cost <= 0 || !bag.amountG || bag.amountG <= 0) return null;
    const p = (bag.cost / bag.amountG) * 100;
    return { value: s.mean! / p, detail: `${s.mean!.toFixed(2)} at $${p.toFixed(2)}/100 g` };
  });
const roasters = (c: RecCtx, f: (bs: BagFact[]) => number): Candidate[] =>
  [...groupBy(c.bags.filter((b) => b.purchaseDate), (b) => b.roaster)].map(([r, bs]) => ({
    value: f(bs), holder: { label: r as string, date: bs.map((b) => b.purchaseDate!).sort().pop()! }
  }));
const brewMetric = (c: RecCtx, get: (b: BrewFact) => number | null, ok: (b: BrewFact, v: number) => boolean = () => true): Candidate[] =>
  held(c).flatMap((b) => { const v = get(b); return v !== null && v > 0 && ok(b, v) ? [{ value: v, holder: brewHolder(c, b) }] : []; });
// Rated board groups with ≥3 bags, lowest adjusted rating; the group's latest brew in the window is its date.
const least = (board: Board) => (c: RecCtx): Candidate[] =>
  leaderboard(c.brews, c.bags, { start: null, end: c.today }, board, 'rating', c.ratings, 'adjusted')
    .filter((r) => r.bags >= 3)
    .map((r) => ({
      value: r.value,
      holder: {
        label: r.label, ...(r.href ? { href: r.href } : {}),
        date: c.brews.filter((b) => BREW_KEY[board](b) === r.key).map((b) => b.localDate).sort().pop()!
      }
    }));

export const RECORDS: RecordDef[] = [
  taste('bestBag', 'Best bag', 'max', 'rating', bestBag()),
  taste('bestBagDialed', 'Best bag, dialed in', 'max', 'rating', (c) => perBag(c, 3, (s) => ({ value: dialed(s.rated) }))),
  taste('bestDecaf', 'Best decaf', 'max', 'rating', bestBag((b) => b.decaf)),
  taste('dialJump', 'Biggest dial-in jump', 'max', 'rating', (c) => perBag(c, 2, (s) => {
    let best: Omit<Candidate, 'holder'> | null = null;
    for (let i = 1; i < s.rated.length; i++) {
      const d = s.rated[i] - s.rated[i - 1];
      if (d > 0 && (!best || d > best.value)) best = { value: d, detail: `${s.rated[i - 1]} → ${s.rated[i]}` };
    }
    return best;
  })),
  taste('climb', 'Biggest climb', 'max', 'rating', (c) => perBag(c, 2, (s) => {
    const top = Math.max(...s.rated);
    return top > s.rated[0] ? { value: top - s.rated[0], detail: `${s.rated[0]} → ${top} at brew ${s.rated.indexOf(top) + 1} of ${s.rated.length}` } : null;
  })),
  taste('holeInOne', 'Hole-in-one', 'max', 'count', (c) => {
    const firsts = perBag(c, 2, (s) => (s.rated[0] === Math.max(...s.rated) ? { value: s.rated[0] } : null));
    const top = pick(firsts, 'max');
    return top ? [{ value: firsts.length, holder: top.holder }] : [];
  }),
  taste('consistent', 'Most consistent bag', 'min', 'sd', (c) => perBag(c, 5, (s) => ({ value: s.sd!, detail: `${s.rated.length} brews` }))),
  taste('bestDay', 'Best day', 'max', 'rating', dayMean),

  volume('mostBrewedBag', 'Most-brewed bag', 'max', 'count', (c) => bagCount(c, (s) => s.brews.length)),
  volume('mostGramsBag', 'Most grams from one bag', 'max', 'grams', (c) => bagCount(c, (s) => s.grams)),
  volume('marathon', 'Marathon session', 'max', 'count', (c) =>
    [...groupBy(c.brews, (b) => (b.coffeeId === null ? null : `${b.coffeeId}|${b.localDate}`)).values()]
      .map((bs) => ({ value: bs.length, holder: bagHolder(c.bags, bs[0].coffeeId, bs[0].localDate) })), { perDay: true }),
  volume('bagsInDay', 'Most bags brewed in one day', 'max', 'count', (c) =>
    perDay(c, (bs) => ({ value: distinct(bs.map((b) => (b.coffeeId === null ? null : String(b.coffeeId)))) })), { perDay: true }),
  volume('brews24h', 'Most brews in 24 hours', 'max', 'count', (c) => rolling(c, (w) => w.length), { perDay: true }),
  volume('grams24h', 'Most grams in 24 hours', 'max', 'grams', (c) => rolling(c, (w) => w.reduce((s, b) => s + (b.dose && b.dose > 0 ? b.dose : 0), 0)), { perDay: true }),
  volume('gearTour', 'Gear tour', 'max', 'count', (c) =>
    [...bagStats(c.brews, c.ratings).values()].map((s) => ({
      value: distinct(s.brews.map((b) => b.brewer)),
      detail: `${distinct(s.brews.map((b) => b.dripper))} drippers · ${distinct(s.brews.map((b) => b.water))} waters`,
      holder: bagHolder(c.bags, s.coffeeId, s.last)
    }))),
  volume('earlyBird', 'Early bird', 'min', 'clock', (c) => clock(c, () => true)),
  volume('nightOwl', 'Night owl', 'max', 'clock', (c) => clock(c, () => true)),
  volume('nightOwlCaf', 'Night owl (caffeinated)', 'max', 'clock', (c) => clock(c, (b) => !b.decaf)),

  fresh('fastestFinish', 'Fastest finish', 'min', 'days', (c) => lifeSpans(c, true)),
  fresh('drinkRate', 'Fastest drinking rate', 'max', 'gpd', (c) =>
    [...bagStats(c.brews, c.ratings).values()].flatMap((s) => {
      const d = distinct(s.brews.map((b) => b.localDate));
      return d >= 2 || s.grams >= 100 ? [{ value: s.grams / (daysBetween(s.first, s.last) + 1), holder: bagHolder(c.bags, s.coffeeId, s.last) }] : [];
    })),
  fresh('lifetime', 'Longest bag lifetime', 'max', 'days', (c) => lifeSpans(c, false)),
  fresh('waitToOpen', 'Longest wait to open', 'max', 'days', (c) =>
    // Rest days at the first brew are already net of freezer time.
    [...bagStats(c.brews, c.ratings).values()].flatMap((s) => {
      const bag = c.bags.find((x) => x.id === s.coffeeId), rest = s.brews[0].restDays;
      return bag?.purchaseDate && bag.firstBrew === s.first && rest !== null && rest >= 0
        ? [{ value: rest, holder: bagHolder(c.bags, s.coffeeId, s.first) }] : [];
    })),
  fresh('oldestBrewed', 'Oldest coffee brewed', 'max', 'days', (c) => restPick(c)),
  fresh('freshestBrew', 'Freshest brew', 'min', 'days', (c) => restPick(c)),
  fresh('oldestWaiting', 'Oldest bag waiting', 'max', 'days', (c) =>
    c.bags.flatMap((b) => {
      const d = b.status === 'backlog' && b.firstBrew === null && b.purchaseDate
        ? restDays(b.purchaseDate, b.frozenStart ?? null, b.frozenEnd ?? null, c.today) : null;
      return d === null ? [] : [{ value: d, holder: bagHolder(c.bags, b.id, b.purchaseDate!) }];
    }), { scope: 'now' }),

  money('priciestBag', 'Priciest bag per 100 g', 'max', 'per100', (c) => per100(c), { bought: true }),
  money('cheapestBag', 'Cheapest bag per 100 g', 'min', 'per100', (c) => per100(c), { bought: true }),
  money('priciestCup', 'Priciest cup', 'max', 'money', (c) => cups(c)),
  money('cheapestCup', 'Cheapest cup', 'min', 'money', (c) => cups(c)),
  money('bestValue', 'Best value', 'max', 'value', (c) => value(c), { rating: true }),
  money('buyingMonth', 'Biggest buying month', 'max', 'count', (c) =>
    [...groupBy(c.bags, (b) => b.purchaseDate?.slice(0, 7) ?? null)].map(([m, bs]) => ({
      value: bs.length, detail: `$${bs.reduce((s, b) => s + (b.cost ?? 0), 0).toFixed(2)}`, holder: { label: m as string, date: `${m}-01` }
    })), { scope: 'alltime' }),
  money('roasterBags', 'Most bags from one roaster', 'max', 'count', (c) => roasters(c, (bs) => bs.length), { bought: true }),
  money('roasterSpend', 'Most spent at one roaster', 'max', 'money', (c) => roasters(c, (bs) => bs.reduce((s, b) => s + (b.cost ?? 0), 0)), { bought: true }),

  extreme('doseHeavy', 'Heaviest dose', 'max', 'grams', (c) => brewMetric(c, (b) => b.dose)),
  extreme('doseLight', 'Lightest dose', 'min', 'grams', (c) => brewMetric(c, (b) => b.dose)),
  extreme('ratioLong', 'Longest ratio', 'max', 'ratio', (c) => brewMetric(c, (b) => b.ratio, (b, v) => v >= (FLOORS[b.brewerType]?.ratio ?? 0))),
  extreme('ratioShort', 'Shortest ratio', 'min', 'ratio', (c) => brewMetric(c, (b) => b.ratio, (b, v) => v >= (FLOORS[b.brewerType]?.ratio ?? 0))),
  extreme('bloomLong', 'Longest bloom', 'max', 'seconds', (c) => brewMetric(c, (b) => b.bloomSeconds)),
  extreme('bloomShort', 'Shortest bloom', 'min', 'seconds', (c) => brewMetric(c, (b) => b.bloomSeconds)),
  extreme('brewTimeLong', 'Longest brew', 'max', 'seconds', (c) => brewMetric(c, (b) => b.brewTimeSeconds, (b, v) => v >= (FLOORS[b.brewerType]?.seconds ?? 0))),
  extreme('brewTimeShort', 'Shortest brew', 'min', 'seconds', (c) => brewMetric(c, (b) => b.brewTimeSeconds, (b, v) => v >= (FLOORS[b.brewerType]?.seconds ?? 0))),
  extreme('waterMost', 'Most water in one brew', 'max', 'ml', (c) => brewMetric(c, (b) => b.waterG)),

  gentle('lowestBag', "Didn't click", 'min', 'rating', bestBag()),
  gentle('biggestDip', 'Off day', 'max', 'rating', (c) => perBag(c, 2, (s) => {
    let best: Omit<Candidate, 'holder'> | null = null;
    for (let i = 1; i < s.rated.length; i++) {
      const d = s.rated[i - 1] - s.rated[i];
      if (d > 0 && (!best || d > best.value)) best = { value: d, detail: `${s.rated[i - 1]} → ${s.rated[i]}` };
    }
    return best;
  })),
  gentle('wildest', 'Kept you guessing', 'max', 'sd', (c) => perBag(c, 5, (s) => ({ value: s.sd!, detail: `${s.rated.length} brews` }))),
  gentle('slowestPeak', 'Took its time', 'max', 'count', (c) => perBag(c, 5, (s) => {
    const i = s.rated.indexOf(Math.max(...s.rated));
    return { value: i + 1, detail: `brew ${i + 1} of ${s.rated.length}` };
  })),
  gentle('leastRoaster', 'Less your style · roaster', 'min', 'rating', least('roasters')),
  gentle('leastOrigin', 'Less your style · origin', 'min', 'rating', least('origins')),
  gentle('leastProcess', 'Less your style · process', 'min', 'rating', least('process')),
  gentle('leastRoast', 'Less your style · roast level', 'min', 'rating', least('roast')),
  gentle('toughValue', 'Toughest value', 'min', 'value', (c) => value(c)),
  gentle('toughDay', 'Toughest day', 'min', 'rating', dayMean)
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

export interface RecordsCtx { period: Period; prev: Period | null; ratings: Ratings; brewer?: BrewerType; size: number; today: string }

const SECTIONS: Section[] = ['taste', 'volume', 'freshness', 'money', 'extremes', 'gentle'];
const bagsIn = (bags: readonly BagFact[], w: Period | null) => (w ? bags.filter((b) => b.purchaseDate && inPeriod(b.purchaseDate, w)) : []);

export function recordsTab(brews: readonly BrewFact[], bags: readonly BagFact[], c: RecordsCtx): RecordsTab {
  const all: Period = { start: null, end: c.today };
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
    topBrews: top.slice(0, 10).map((b) => ({ rating: b.rating!, ...row(b) })),
    perfectTens: top.filter((b) => b.rating === 10).map(row),
    brewerTypes: BREWER_TYPES.filter((t) => brews.some((b) => b.brewerType === t))
  };
}
