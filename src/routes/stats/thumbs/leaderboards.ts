import { chartThumb } from '#lib/chartThumb.ts';
import { BOARDS, type Board } from '#lib/insightsUrl.ts';
import { BOARD_TITLE } from '../chartLink';
import { boardTimeLines } from '../multiLine';
import type { ThumbCtx, ThumbFn } from '../thumbTypes';

const clip = (s: string) => (s.length > 80 ? s.slice(0, 79) + '…' : s);

// A board's Over time lines (positional page colours); null for the List, which keeps #118's bars.
export function leaderboardTimeThumb(c: ThumbCtx, board: Board) {
  const { data, s } = c;
  const t = data.boards && boardTimeLines(data.boards[board], data.boardSeries?.[board], { board, low: s.low ?? [], open: s.open ?? [], views: s.views, rank: s.rank });
  const thumb = t && chartThumb('lines', t.lines.map((l) => ({ label: clip(l.label), values: l.values })));
  return thumb ? { title: BOARD_TITLE[board], thumb } : null;
}

export const LEADERBOARD_THUMBS: Record<string, ThumbFn> = Object.fromEntries(BOARDS.map((b) => [`leaderboard-${b}`, (c: ThumbCtx) => leaderboardTimeThumb(c, b)]));
