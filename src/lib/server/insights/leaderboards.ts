import { BOARDS, LIKE_BOARDS, boardAvg, lowFirst, type Avg, type Board, type By, type Caffeine, type Rank, type Ratings, type RowWhy } from '$lib/insightsUrl';
import { toParams } from '$lib/coffeeViewState';
import type { ColumnKey, Filter } from '$lib/coffeeFilters';
import type { LabFilters } from './lab';
import { MIXED_FILTER, roastLevelLabels, type BrewFact, type BagFact } from './facts';
import { autoBy, daysBetween, inPeriod, trackedBounds, type Period } from './time';
import { bucketLabels, bucketTitles, buckets } from './consumption';
import { ADJUSTED_K, RATINGS_SETTLED_FROM, bagSizes, countsForRating, ratedGroups } from './ratings';
import { likeGaps, roasterLikes, twinKeys } from './likeGroup';
import { groupBy } from './records';
import { mean } from './stats';
import { varietyGroups } from '$lib/originFormat';
import { pooled, shownBrews, single, type Sample } from '$lib/sample';

export interface BoardRow {
  key: string;
  label: string;
  sub?: string;
  href?: string;
  value: number;
  bags: number;
  brews: number;
  like?: { gap: number; label: string }; // coffees board, every rank: vs its like-group
  sample?: Sample; // rating ranks: the small-sample marker
  best?: number; // peak modes: the group's top brew rating
  atBest?: number; // peak modes: brews at that rating (tie-break, detail line)
  mean?: number; // peak modes: mean of bag means (second tie-break); Coffees under k2/adjusted: the unshrunk average
  se?: number; // group boards' mean modes: 1 SE of the row's mean (ratedGroups), the tip's "± x"
  cost?: number; // $/g: the spend and grams behind it (detail line)
  grams?: number;
  move?: number | 'new';
  lowMove?: number | 'new'; // the same under Lowest first (ascending positions, lowFirst's rows)
}

// "N/A" is how a blend/unknown origin was typed; it's no country.
export const country = (o: string | null) => (o && o.trim() && o.trim().toUpperCase() !== 'N/A' ? o : null);

// What a brew is grouped by on each board (null = not on that board).
export const BREW_KEY: Record<Board, (b: BrewFact) => string | null> = {
  roasters: (b) => b.roaster,
  coffees: (b) => (b.coffeeId === null ? null : String(b.coffeeId)),
  origins: (b) => country(b.origin),
  process: (b) => b.processGroup,
  roast: (b) => b.roastLevel,
  water: (b) => b.water,
  dripper: (b) => b.dripper,
  filter: (b) => (b.filter === MIXED_FILTER ? null : b.filter),
  grinder: (b) => b.grinder,
  varieties: (b) => b.variety ?? null,
  producers: (b) => b.producer?.trim() || null
};
// Spend and $/g group bags; only bag attributes have a key.
const BAG_KEY: Partial<Record<Board, (b: BagFact) => string | null>> = {
  roasters: (b) => b.roaster,
  coffees: (b) => String(b.id),
  origins: (b) => country(b.origin),
  process: (b) => b.processGroup,
  roast: (b) => b.roastLevel,
  varieties: (b) => b.variety ?? null,
  producers: (b) => b.producer?.trim() || null
};
// Boards whose rows open the coffee list filtered to them.
const FILTER_COLUMN: Partial<Record<Board, ColumnKey>> = { roasters: 'roaster', origins: 'origin', roast: 'roast_level', producers: 'producer' };

// The varieties board counts a brew (or bag) once toward each variety group of its coffee: one copy per group,
// `variety` set to the group. Other boards pass through.
export const boardBrews = <T extends { variety?: string | null }>(board: Board, xs: readonly T[]): T[] =>
  board === 'varieties' ? xs.flatMap((x) => varietyGroups(x.variety).map((g) => ({ ...x, variety: g }))) : [...xs];

// The distinct stored `variety` strings of the bags whose groups include `group` (a /coffees filter spells them out).
export const varietyLabels = (bags: readonly BagFact[], group: string): string[] =>
  [...new Set(bags.filter((b) => varietyGroups(b.variety).includes(group)).map((b) => b.variety!))];

const byRank = (a: BoardRow, b: BoardRow) =>
  b.value - a.value || (b.atBest ?? 0) - (a.atBest ?? 0) || (b.mean ?? 0) - (a.mean ?? 0) || b.bags - a.bags || b.brews - a.brews || a.label.localeCompare(b.label);

// The confident cutoff: rows the Low confidence chip would mark are left out under min3 (Raw average, confident)
// and under like unless See all set avg=raw (stats audit 2026-10-17: a 1-brew bag topped the like board).
const confident = (rank: Rank, avg: Avg) => (rank === 'rating' && avg === 'min3') || (rank === 'like' && avg !== 'raw');

// `status`: all by default; a Leaderboards row follows its rank (statusFor): Backlog bags have no brews.
export const listHref = (column: ColumnKey, values: (string | null)[], status: ('all' | 'open' | 'archive')[] = ['all']) =>
  `/coffees?${toParams({ status, filters: [{ column, mode: 'any', values }] })}`;
const statusFor = (rank: Rank): ('all' | 'open' | 'archive')[] => (rank === 'spend' || rank === 'ppg' ? ['all'] : ['open', 'archive']);

// The distinct `processing` labels of the bags in a process group (a /coffees filter spells them out).
export const processLabels = (bags: readonly BagFact[], group: string): (string | null)[] =>
  [...new Set(bags.filter((b) => b.processGroup === group).map((b) => b.processing))];

// Insights' page-wide Coffees filter (and Caffeine) as /coffees filters; default and 'all' add nothing.
export function pageFilters(f: LabFilters & { caffeine?: Caffeine }, bags: readonly BagFact[]): Filter[] {
  const out: Filter[] = [];
  if (f.roast) out.push({ column: 'roast_level', mode: 'any', values: roastLevelLabels(f.roast) });
  if (f.process) out.push({ column: 'processing', mode: 'any', values: processLabels(bags, f.process) });
  if (f.origin) out.push({ column: 'origin', mode: 'any', values: [f.origin] });
  if (f.roaster) out.push({ column: 'roaster', mode: 'any', values: [f.roaster] });
  if (f.caffeine === 'decaf') out.push({ column: 'decaf', mode: 'bool', value: true });
  return out;
}

function decorate(r: BoardRow, board: Board, rank: Rank, bags: readonly BagFact[], sizes: ReadonlyMap<number, number>): BoardRow {
  if (board === 'coffees') {
    const bag = bags.find((b) => b.id === Number(r.key));
    // One bag each: the one-bag rule, on the bag's size (bagSizes: dial-in brews included).
    return {
      ...r, sample: r.sample && single(sizes.get(Number(r.key)) ?? r.brews, r.brews), label: bag?.name ?? r.label, sub: bag?.roaster,
      ...(bag?.slug ? { href: `/coffees/${bag.slug}` } : {})
    };
  }
  if (board === 'process') {
    const labels = processLabels(bags, r.key);
    return labels.length ? { ...r, href: listHref('processing', labels, statusFor(rank)) } : r;
  }
  if (board === 'varieties') {
    const labels = varietyLabels(bags, r.key);
    return labels.length ? { ...r, href: listHref('variety', labels, statusFor(rank)) } : r;
  }
  const column = FILTER_COLUMN[board];
  // Bags stored under an alias label (Light/Med) normalize to this row, so link them too.
  return column ? { ...r, href: listHref(column, board === 'roast' ? roastLevelLabels(r.key) : [r.key], statusFor(rank)) } : r;
}

export function leaderboard(
  brews: readonly BrewFact[], bags: readonly BagFact[], p: Period, board: Board, rank: Rank, ratings: Ratings, avg: Avg,
  like = true, // false: callers that only count rows or read keys skip the like lines
  keys?: { brew: (b: BrewFact) => string | null; bag: (b: BagFact) => string | null } // overrides the board's grouping
): BoardRow[] {
  let rows: BoardRow[] = [];
  const inP = brews.filter((b) => inPeriod(b.localDate, p));
  // vs like coffees (spec Part 4): each bag's once-dialed score minus its like-group's mean (likeGroup.ts).
  // Rated, linked brews of the view only (ratings / dial / coffees filter already applied by the caller).
  // Coffees rows carry the line under every rank (gate P4: under like the value already is it).
  const likeRows = () => inP.filter((b) => b.coffeeId !== null && countsForRating(b, ratings) && b.rating! > 0);
  const sizes = bagSizes(inP, ratings); // from the unfanned brews: a bag's size is its own
  const fanned = boardBrews(board, inP);
  const likes = board === 'coffees' && (rank === 'like' || like) ? likeGaps(likeRows(), false, twinKeys(bags), sizes) : null;
  if (rank === 'spend' || rank === 'ppg') {
    const key = keys?.bag ?? BAG_KEY[board];
    if (!key) return [];
    const g = new Map<string, { cost: number; grams: number; bags: number }>();
    for (const b of boardBrews(board, bags)) {
      const k = key(b);
      if (k === null || b.cost === null || !b.purchaseDate || !inPeriod(b.purchaseDate, p)) continue;
      if (rank === 'ppg' && !b.amountG) continue;
      const x = g.get(k) ?? { cost: 0, grams: 0, bags: 0 };
      x.cost += b.cost;
      x.grams += b.amountG ?? 0;
      x.bags += 1;
      g.set(k, x);
    }
    rows = [...g].map(([k, x]) => ({
      key: k, label: k, bags: x.bags, brews: 0,
      ...(rank === 'spend' ? { value: x.cost } : { value: x.cost / x.grams, cost: x.cost, grams: x.grams })
    }));
  } else {
    const key = keys?.brew ?? BREW_KEY[board];
    if (rank === 'like') {
      if (!LIKE_BOARDS.includes(board)) return [];
      rows = board === 'coffees'
        ? [...likes!].map(([id, l]) => ({ key: String(id), label: String(id), value: l.gap, bags: 1, brews: shownBrews(l.sample), sample: l.sample, like: { gap: l.gap, label: l.label } }))
        : [...roasterLikes(likeRows(), twinKeys(bags), sizes)].map(([r, x]) => ({ key: r, label: r, value: x.gap, bags: x.bags, brews: x.scored, sample: pooled(x.bags, x.brews, x.scored) }));
    } else if (rank === 'rating') {
      // Every bag counts, weighted by its brews (ratedGroups); Coffees rows are single bags, shrunk by brews.
      const coffees = board === 'coffees';
      rows = ratedGroups(fanned, key, ratings, avg, coffees).map((r) => ({
        key: r.label, label: r.label, bags: r.bags, brews: r.brews,
        ...(avg.startsWith('best') ? { value: r.value, best: r.best, atBest: r.atBest, mean: r.mean, sample: r.sample }
          : { value: r.value, sample: r.sample, ...(coffees ? (ADJUSTED_K[avg] > 0 ? { mean: r.mean } : {}) : r.se !== undefined && !ADJUSTED_K[avg] ? { se: r.se } : {}) })
      }));
    } else {
      const g = new Map<string, { brews: number; grams: number; bags: Set<number> }>();
      for (const b of fanned) {
        const k = key(b);
        if (k === null) continue;
        const x = g.get(k) ?? { brews: 0, grams: 0, bags: new Set<number>() };
        x.brews += 1;
        x.grams += b.dose ?? 0;
        if (b.coffeeId !== null) x.bags.add(b.coffeeId);
        g.set(k, x);
      }
      rows = [...g].map(([k, x]) => ({ key: k, label: k, value: rank === 'brews' ? x.brews : x.grams, bags: x.bags.size, brews: x.brews }));
    }
  }
  if (likes && rank !== 'like') rows = rows.map((r) => { const l = likes.get(Number(r.key)); return l ? { ...r, like: { gap: l.gap, label: l.label } } : r; });
  const out = rows.map((r) => decorate(r, board, rank, bags, sizes));
  return (confident(rank, avg) ? out.filter((r) => !r.sample?.small) : out).sort(byRank);
}

// Varieties and Producers notes: of the bags the board draws on (brewed in the Period; bought in it for spend and
// $/g), how many carry the field.
export function fieldCoverage(
  brews: readonly BrewFact[], bags: readonly BagFact[], p: Period, rank: Rank
): Record<'varieties' | 'producers', { with: number; of: number }> {
  const money = rank === 'spend' || rank === 'ppg';
  const brewed = new Set(brews.filter((b) => inPeriod(b.localDate, p)).map((b) => b.coffeeId));
  const of = bags.filter((b) => (money ? !!b.purchaseDate && inPeriod(b.purchaseDate, p) : brewed.has(b.id)));
  return {
    varieties: { with: of.filter((b) => varietyGroups(b.variety).length).length, of: of.length },
    producers: { with: of.filter((b) => b.producer?.trim()).length, of: of.length }
  };
}

// move = ranks climbed since the compare window (+ up, − down), 'new' if it wasn't ranked.
export function withMovement(now: BoardRow[], prev: BoardRow[]): BoardRow[] {
  const was = new Map(prev.map((r, i) => [r.key, i]));
  return now.map((r, i) => ({ ...r, move: was.has(r.key) ? was.get(r.key)! - i : 'new' }));
}

// Every board for the page. Per person divides brews, grams and spend (an even split, like
// the overview); rating and $/g don't change (its spend and grams do), and no order changes.
// `avg`: the URL's Score, undefined = each board's default (boardAvg).
export function leaderboards(
  brews: readonly BrewFact[], bags: readonly BagFact[], p: Period, prev: Period | null, rank: Rank, ratings: Ratings,
  avg: Avg | undefined, size = 1
): Record<Board, BoardRow[]> {
  const split = size > 1 && (rank === 'brews' || rank === 'grams' || rank === 'spend');
  return Object.fromEntries(
    BOARDS.map((board) => {
      const a = boardAvg(board, avg);
      let rows = leaderboard(brews, bags, p, board, rank, ratings, a);
      if (prev) {
        const before = leaderboard(brews, bags, prev, board, rank, ratings, a, false);
        const low = new Map(withMovement(lowFirst(board, rows), lowFirst(board, before)).map((r) => [r.key, r.move]));
        rows = withMovement(rows, before).map((r) => (low.has(r.key) ? { ...r, lowMove: low.get(r.key) } : r));
      }
      if (size > 1 && rank === 'ppg') rows = rows.map((r) => ({ ...r, cost: r.cost! / size, grams: r.grams! / size }));
      return [board, split ? rows.map((r) => ({ ...r, value: r.value / size })) : rows];
    })
  ) as Record<Board, BoardRow[]>;
}

// The boards the confident cutoff emptied: rated groups exist, every one under the small-sample rule. Their
// line says what is missing ("No roasters with 3+ bags and 10+ rated brews ..."), not "No brews".
// Where the See all note runs, hiddenRows' `cut` is the same list without the extra calls; this is the fallback.
export function cutBoards(
  boards: Record<Board, BoardRow[]>, brews: readonly BrewFact[], bags: readonly BagFact[], p: Period, rank: Rank, ratings: Ratings, avg: Avg | undefined
): Board[] {
  return BOARDS.filter((b) => confident(rank, boardAvg(b, avg)) && !boards[b].length && leaderboard(brews, bags, p, b, rank, ratings, 'raw', false).length);
}

// The See all note (gate 3): rows each board gains at avg=raw, ratings=all, dial=all, and which settings hid
// them (each step relaxes one: Score, then Ratings, then Brews). `scored`: the brews the boards were built from;
// `all`: the brews before Once dialed (brew filters already applied; every board applies every filter, its own dimension included). Boards that gain none are left out. `cut`: cutBoards' list (only the confident
// cutoff drops rows: every other Score shows every rated group).
// ponytail: up to 27 leaderboard() calls (3 per board; 18 under like), no like lines; memoize if a board gets slow.
export function hiddenRows(
  boards: Record<Board, BoardRow[]>, scored: readonly BrewFact[], all: readonly BrewFact[], bags: readonly BagFact[], p: Period, rank: Rank,
  ratings: Ratings
): { rows: Partial<Record<Board, number>>; by: Partial<Record<Board, RowWhy[]>>; cut: Board[] } {
  if (rank !== 'rating' && rank !== 'like') return { rows: {}, by: {}, cut: [] };
  const rows: Partial<Record<Board, number>> = {}, by: Partial<Record<Board, RowWhy[]>> = {}, cut: Board[] = [];
  for (const b of BOARDS) {
    const n0 = boards[b].length;
    const sc = scored, al = all;
    const n1 = leaderboard(sc, bags, p, b, rank, ratings, 'raw', false).length;
    const n2 = leaderboard(sc, bags, p, b, rank, 'all', 'raw', false).length;
    const n3 = leaderboard(al, bags, p, b, rank, 'all', 'raw', false).length;
    if (!n0 && n1) cut.push(b);
    if (n3 > n0) { rows[b] = n3 - n0; by[b] = [n1 > n0 && 'avg', n2 > n1 && 'ratings', n3 > n2 && 'dial'].filter(Boolean) as RowWhy[]; }
  }
  return { rows, by, cut };
}

// Over time (a small board's third view): the board's top 5 groups, each one's Rank by value per bucket. Buckets follow the
// Period like Consumption's grams over time (autoBy). A bucket is its own tiny Period, so every page setting applies.
// A group missing from a bucket is 0 for brews / grams / spend, a gap otherwise; under Score "Average (3+ bags)" a bucket
// ranks with the raw average (3+ bags in one bucket would leave almost nothing to plot).
export interface BoardSeries { by: By; labels: string[]; titles: string[]; lines: { label: string; values: (number | null)[] }[] }
export function boardSeries(
  brews: readonly BrewFact[], bags: readonly BagFact[], c: { period: Period; dataStart: string | null; today: string }, board: Board,
  top: readonly string[], rank: Rank, ratings: Ratings, avg: Avg, size = 1
): BoardSeries {
  const t = trackedBounds(c.period, c.dataStart, c.today);
  const by = autoBy(t ? daysBetween(t.start, t.end) + 1 : 0);
  // Calibrated ratings: rating ranks start at the first bucket reaching the calibration date (earlier ones would sit empty).
  const bs = buckets(t, by).filter((b) => !(ratings === 'current' && (rank === 'rating' || rank === 'like')) || b.end >= RATINGS_SETTLED_FROM);
  const split = size > 1 && (rank === 'brews' || rank === 'grams' || rank === 'spend') ? size : 1;
  const empty = rank === 'brews' || rank === 'grams' || rank === 'spend' ? 0 : null;
  const perBucket = bs.map((b) => new Map(leaderboard(brews, bags, { start: b.start, end: b.end }, board, rank, ratings, confident(rank, avg) ? 'raw' : avg, false).map((r) => [r.key, r.value])));
  return {
    by, labels: bucketLabels(bs, by), titles: bucketTitles(bs, by),
    lines: top.map((k) => ({ label: k, values: perBucket.map((m) => (m.has(k) ? m.get(k)! / split : empty)) }))
  };
}
