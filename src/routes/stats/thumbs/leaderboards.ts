import { chartThumb } from '#lib/chartThumb.ts';
import type { Board } from '#lib/insightsUrl.ts';
import { BOARD_TITLE, boardValue } from '../chartLink';
import { boardTimeLines } from '../multiLine';
import type { ThumbCtx } from '../thumbTypes';

// A board's Over time lines (positional page colours); null for the List, which keeps #118's bars.
export function leaderboardTimeThumb(c: ThumbCtx, board: Board) {
  const { data, s } = c;
  const t = data.boards && boardTimeLines(data.boards[board], data.boardSeries?.[board], { board, low: s.low ?? [], open: s.open ?? [], views: s.views, rank: s.rank });
  const thumb = t && chartThumb('lines', t.lines.map((l) => ({ label: l.label, values: l.values })), { x: t.labels, fmt: (v) => boardValue(v, s.rank, c.perPerson) });
  return thumb ? { title: BOARD_TITLE[board], thumb } : null;
}
