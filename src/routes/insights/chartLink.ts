import { getContext, setContext } from 'svelte';
import { BAG_BOARDS, BOARDS, LIKE_BOARDS, MON, type Board, type Rank } from '$lib/insightsUrl';
import { DESCRIPTION_MAX, fitList, plural, type Preview } from '$lib/linkPreview';
import { originWithFlag } from '$lib/countryFlags';
import { formatGrams } from '$lib/grams';
import { clock12 } from '$lib/hours';
import { usd, wholeUsd } from '$lib/money';
import { likeGap } from '$lib/components/deltaColor';
import type { BoardRow } from '$lib/server/insights/leaderboards';
import type { Fmt, Holder, RecordPick, RecordsTab, Section } from '$lib/server/insights/records';

// +page.svelte provides how a heading links to itself: an href carrying chart=<id> (link previews name the chart)
// and a click that puts the same URL in the address bar without a reload. Same shape as coffeeNote.ts.
export interface ChartLink {
  href: (id: string) => string;
  go: (id: string) => void;
}
const KEY = 'insights-chart-link';
export const provideChartLink = (l: ChartLink): void => void setContext(KEY, l);
export const useChartLink = (): ChartLink => getContext<ChartLink>(KEY);

// ---- Formatters shared by Leaderboards/Records and the link preview (moved verbatim from the components). ----

export const BOARD_TITLE: Record<Board, string> = {
  roasters: 'Roasters', coffees: 'Coffees', origins: 'Origins', process: 'Process group', roast: 'Roast level',
  water: 'Water', dripper: 'Dripper', filter: 'Filter', grinder: 'Grinder'
};
export const RANK_LABEL: Record<Rank, string> = { rating: 'Rating', brews: 'Brews', grams: 'Grams', spend: 'Spend', ppg: '$/g', like: 'vs like coffees' };

// `whole`: the board's money format (ui-rules 46: one per list).
export function boardValue(v: number, rank: Rank, perPerson: boolean, whole?: boolean): string {
  if (rank === 'like') return likeGap(v);
  if (rank === 'rating') return v.toFixed(1);
  if (rank === 'grams') return formatGrams(v);
  if (rank === 'spend') return usd(v, whole);
  if (rank === 'ppg') return `${usd(v, whole)}/g`;
  return perPerson && v < 10 ? v.toFixed(1) : Math.round(v).toLocaleString('en-US');
}

export const RECORD_TITLE: Record<Section, string> = {
  taste: 'Taste', volume: 'Volume', freshness: 'Freshness & lifetime', money: 'Money', extremes: 'Brew extremes', gentle: 'Not quite your cup'
};
// "Oct 3, 2026"; a month holder (biggest buying month) is "Mar 2026".
export const holderDate = (d: string): string =>
  d.length === 7 ? `${MON[+d.slice(5, 7) - 1]} ${d.slice(0, 4)}` : `${MON[+d.slice(5, 7) - 1]} ${+d.slice(8)}, ${d.slice(0, 4)}`;
// Day and month records are held by the date itself.
export const isDateHolder = (h: Holder): boolean => /^\d{4}-\d{2}(-\d{2})?$/.test(h.label);
export const holderName = (h: Holder): string => (isDateHolder(h) ? holderDate(h.label) : h.label);

const num = (n: number) => (Number.isInteger(n) ? n.toLocaleString('en-US') : n < 10 ? n.toFixed(1) : Math.round(n).toLocaleString('en-US'));
const grams = (n: number) => (n < 100 && !Number.isInteger(n) ? `${+n.toFixed(1)}g` : formatGrams(n));
const mss = (s: number) => `${Math.floor(Math.round(s) / 60)}:${String(Math.round(s) % 60).padStart(2, '0')}`;
// [value, small unit after it, the context line when the format moves the detail into the value].
export function recordParts(p: RecordPick, fmt: Fmt): [string, string?, string?] {
  const n = p.value;
  switch (fmt) {
    case 'rating': return [n.toFixed(1)];
    case 'count': return [num(n)];
    case 'grams': case 'ml': return [grams(n)];
    case 'days': return [num(n), n === 1 ? 'day' : 'days'];
    case 'gpd': return [num(n), 'g/day'];
    case 'money': return [usd(n)];
    case 'per100': return [usd(n), '/ 100 g'];
    case 'clock': { const [hm, ap] = clock12(n).split(' '); return [hm, ap]; }
    case 'seconds': return [mss(n)];
    case 'ratio': return [`1:${n.toFixed(1)}`];
    case 'sd': return [`±${n.toFixed(2)}`];
    // Ranked by the adjusted delta (value), shown as the raw one (mean).
    case 'delta': return [`${p.mean! < 0 ? '−' : '+'}${Math.abs(p.mean!).toFixed(2)}`, undefined, 'Vs your average rating'];
    // An encoded setting: the text is the value.
    case 'grind': return [p.detail ?? ''];
    // Rating ÷ $/100 g isn't readable: the mean rating, "at $9.30/100 g" under it.
    case 'value': return [p.mean!.toFixed(1), undefined, `At ${usd(p.per100!)}/100 g`];
  }
}
export const recordValue = (p: RecordPick, fmt: Fmt): string => recordParts(p, fmt).filter(Boolean).join(' ');

// ---- The /insights link preview ----

interface PreviewInput {
  tabLabel: string; period: string; brews: number; avgRating: number | null; filters: string[]; chart?: string;
  rank: Rank; perPerson: boolean; boards: Record<Board, BoardRow[]> | null; records: RecordsTab | null;
}
export function insightsPreview(v: PreviewInput): Preview {
  const chart = v.chart ?? '';
  const board = BOARDS.find((b) => chart === `leaderboard-${b}`);
  const rows = board && v.boards?.[board];
  // The board shows under this rank (hidden by rank=like, or unranked: spend/$ per g on a non-bag board).
  const shown = board && (v.rank !== 'like' || LIKE_BOARDS.includes(board)) && !((v.rank === 'spend' || v.rank === 'ppg') && !BAG_BOARDS.includes(board));
  if (board && rows?.length && shown) {
    const whole = (v.rank === 'spend' || v.rank === 'ppg') && wholeUsd(rows.map((r) => r.value));
    const prefix = `${v.period} · ${RANK_LABEL[v.rank]}: `;
    const items = rows.slice(0, 5).map((r) => `${board === 'origins' ? originWithFlag(r.label) : r.label} – ${boardValue(r.value, v.rank, v.perPerson, whole)}`);
    return { title: `Insights: ${BOARD_TITLE[board]}`, description: prefix + fitList(items, ' · ', false, DESCRIPTION_MAX - prefix.length) };
  }
  const section = v.records?.sections.find((s) => chart === `records-${s.key}`);
  if (section?.tiles.length) {
    const prefix = `${v.period}: `;
    const items = section.tiles.slice(0, 5).map((t) => `${t.label} – ${recordValue(t, t.fmt)} (${holderName(t.holder)})`);
    return { title: `Insights: ${RECORD_TITLE[section.key]}`, description: prefix + fitList(items, ' · ', false, DESCRIPTION_MAX - prefix.length) };
  }
  return {
    title: `Insights: ${v.tabLabel}`,
    description: [v.period, plural(v.brews, 'brew'), v.avgRating != null && `Avg rating ${v.avgRating.toFixed(1)}`, ...v.filters].filter(Boolean).join(' · ')
  };
}
