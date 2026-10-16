import { BOARDS, type Avg, type Board, type Rank, type Ratings } from '$lib/insightsUrl';
import { toParams } from '$lib/coffeeViewState';
import type { ColumnKey } from '$lib/coffeeFilters';
import { MIXED_FILTER, roastLevelLabels, type BrewFact, type BagFact } from './facts';
import { inPeriod, type Period } from './time';
import { ratedGroups } from './ratings';
import { single, type Sample } from '$lib/sample';

export interface BoardRow {
  key: string;
  label: string;
  sub?: string;
  href?: string;
  value: number;
  bags: number;
  brews: number;
  sample?: Sample; // rating ranks: the small-sample marker
  best?: number; // peak modes: the group's top brew rating
  atBest?: number; // peak modes: brews at that rating (tie-break, detail line)
  mean?: number; // peak modes: raw mean of bag means (second tie-break)
  cost?: number; // $/g: the spend and grams behind it (detail line)
  grams?: number;
  move?: number | 'new';
}

// "N/A" is how a blend/unknown origin was typed; it's no country.
const country = (o: string | null) => (o && o.trim() && o.trim().toUpperCase() !== 'N/A' ? o : null);

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
  grinder: (b) => b.grinder
};
// Spend and $/g group bags; only bag attributes have a key.
const BAG_KEY: Partial<Record<Board, (b: BagFact) => string | null>> = {
  roasters: (b) => b.roaster,
  coffees: (b) => String(b.id),
  origins: (b) => country(b.origin),
  process: (b) => b.processGroup,
  roast: (b) => b.roastLevel
};
// Boards whose rows open the coffee list filtered to them.
const FILTER_COLUMN: Partial<Record<Board, ColumnKey>> = { roasters: 'roaster', origins: 'origin', roast: 'roast_level' };

const byRank = (a: BoardRow, b: BoardRow) =>
  b.value - a.value || (b.atBest ?? 0) - (a.atBest ?? 0) || (b.mean ?? 0) - (a.mean ?? 0) || b.bags - a.bags || b.brews - a.brews || a.label.localeCompare(b.label);

export const listHref = (column: ColumnKey, values: (string | null)[]) =>
  `/coffees?${toParams({ status: 'all', filters: [{ column, mode: 'any', values }] })}`;

function decorate(r: BoardRow, board: Board, bags: readonly BagFact[]): BoardRow {
  if (board === 'coffees') {
    const bag = bags.find((b) => b.id === Number(r.key));
    // One bag each: the one-bag rule.
    return {
      ...r, sample: r.sample && single(r.brews), label: bag?.name ?? r.label, sub: bag?.roaster,
      ...(bag?.slug ? { href: `/coffees/${bag.slug}` } : {})
    };
  }
  if (board === 'process') {
    const labels = [...new Set(bags.filter((b) => b.processGroup === r.key).map((b) => b.processing))];
    return labels.length ? { ...r, href: listHref('processing', labels) } : r;
  }
  const column = FILTER_COLUMN[board];
  // Bags stored under an alias label (Light/Med) normalize to this row, so link them too.
  return column ? { ...r, href: listHref(column, board === 'roast' ? roastLevelLabels(r.key) : [r.key]) } : r;
}

export function leaderboard(
  brews: readonly BrewFact[], bags: readonly BagFact[], p: Period, board: Board, rank: Rank, ratings: Ratings, avg: Avg
): BoardRow[] {
  let rows: BoardRow[] = [];
  if (rank === 'spend' || rank === 'ppg') {
    const key = BAG_KEY[board];
    if (!key) return [];
    const g = new Map<string, { cost: number; grams: number; bags: number }>();
    for (const b of bags) {
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
    const inP = brews.filter((b) => inPeriod(b.localDate, p));
    const key = BREW_KEY[board];
    if (rank === 'rating') {
      rows = ratedGroups(inP, key, ratings, avg).map((r) => ({
        key: r.label, label: r.label, bags: r.bags, brews: r.brews,
        ...(avg.startsWith('best') ? { value: r.value, best: r.best, atBest: r.atBest, mean: r.mean, sample: r.sample } : { value: r.value, sample: r.sample })
      }));
    } else {
      const g = new Map<string, { brews: number; grams: number; bags: Set<number> }>();
      for (const b of inP) {
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
  const out = rows.map((r) => decorate(r, board, bags));
  // min3 (Raw average, confident) leaves out every row the Low confidence chip would mark.
  return (rank === 'rating' && avg === 'min3' ? out.filter((r) => !r.sample?.small) : out).sort(byRank);
}

// move = ranks climbed since the compare window (+ up, − down), 'new' if it wasn't ranked.
export function withMovement(now: BoardRow[], prev: BoardRow[]): BoardRow[] {
  const was = new Map(prev.map((r, i) => [r.key, i]));
  return now.map((r, i) => ({ ...r, move: was.has(r.key) ? was.get(r.key)! - i : 'new' }));
}

// Every board for the page. Per person divides brews, grams and spend (an even split, like
// the overview); rating and $/g don't change (its spend and grams do), and no order changes.
export function leaderboards(
  brews: readonly BrewFact[], bags: readonly BagFact[], p: Period, prev: Period | null, rank: Rank, ratings: Ratings,
  avg: Avg, size = 1
): Record<Board, BoardRow[]> {
  const split = size > 1 && (rank === 'brews' || rank === 'grams' || rank === 'spend');
  return Object.fromEntries(
    BOARDS.map((board) => {
      let rows = leaderboard(brews, bags, p, board, rank, ratings, avg);
      if (prev) rows = withMovement(rows, leaderboard(brews, bags, prev, board, rank, ratings, avg));
      if (size > 1 && rank === 'ppg') rows = rows.map((r) => ({ ...r, cost: r.cost! / size, grams: r.grams! / size }));
      return [board, split ? rows.map((r) => ({ ...r, value: r.value / size })) : rows];
    })
  ) as Record<Board, BoardRow[]>;
}

// The boards min3's confident cutoff emptied: rated groups exist, every one under the small-sample rule. Their
// line says what is missing ("No roasters with 3+ bags and 10+ rated brews ..."), not "No brews".
export function cutBoards(
  boards: Record<Board, BoardRow[]>, brews: readonly BrewFact[], bags: readonly BagFact[], p: Period, rank: Rank, ratings: Ratings, avg: Avg
): Board[] {
  if (rank !== 'rating' || avg !== 'min3') return [];
  return BOARDS.filter((b) => !boards[b].length && leaderboard(brews, bags, p, b, rank, ratings, 'raw').length);
}
