import type { BrewerType, Ratings } from '$lib/insightsUrl';
import type { BrewFact, BagFact } from './facts';
import { countsForRating } from './ratings';

export interface Holder { label: string; sub?: string; href?: string; date: string }
export interface Candidate { value: number; holder: Holder; detail?: string }
export interface RecordPick { value: number; holder: Holder; detail?: string; ties: Holder[] }
export type Section = 'taste' | 'volume' | 'freshness' | 'money' | 'extremes' | 'gentle';
export type Fmt = 'rating' | 'count' | 'grams' | 'days' | 'gpd' | 'money' | 'per100' | 'clock'
  | 'seconds' | 'ratio' | 'sd' | 'grind' | 'ml';
export interface RecordDef {
  key: string; section: Section; label: string; fmt: Fmt;
  dir: 'max' | 'min';
  rating?: true; // follows Current/All (tile carries the switch)
  perDay?: true; // divided by household size under people=person
  scope?: 'alltime' | 'now'; // ignores Period (badge "All-time" / "Now")
  extremes?: true; // follows the brewer switch
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
  return bs.map((b, i) => {
    const w = bs.slice(i).filter((x) => t(x) - t(b) < 864e5);
    return { value: f(w), holder: brewHolder(c, b) };
  });
};

const clock = (c: RecCtx, only: (b: BrewFact) => boolean): Candidate[] =>
  c.brews.filter((b) => !b.backfilled && only(b)).map((b) => ({ value: minutes(b.localTime), holder: brewHolder(c, b) }));

const bagCount = (c: RecCtx, f: (s: BagStat) => number): Candidate[] =>
  [...bagStats(c.brews, c.ratings).values()].map((s) => ({ value: f(s), holder: bagHolder(c.bags, s.coffeeId, s.last) }));

const taste = (key: string, label: string, dir: 'max' | 'min', fmt: Fmt, run: RecordDef['run']): RecordDef =>
  ({ key, section: 'taste', label, fmt, dir, rating: true, run });
const volume = (key: string, label: string, dir: 'max' | 'min', fmt: Fmt, run: RecordDef['run'], extra: Partial<RecordDef> = {}): RecordDef =>
  ({ key, section: 'volume', label, fmt, dir, run, ...extra });

const bestBag = (only?: (b: BrewFact) => boolean) => (c: RecCtx) =>
  perBag(c, 3, (s) => ({ value: s.mean!, detail: `${s.rated.length} brews` }), only);

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
  taste('bestDay', 'Best day', 'max', 'rating', (c) => perDay(c, (bs) => {
    const r = bs.filter((b) => countsForRating(b, c.ratings)).map((b) => b.rating!);
    return r.length >= 3 ? { value: mean(r), detail: `${r.length} brews` } : null;
  })),

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
  volume('nightOwlCaf', 'Night owl (caffeinated)', 'max', 'clock', (c) => clock(c, (b) => !b.decaf))
];
