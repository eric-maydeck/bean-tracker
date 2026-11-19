import { chartThumb } from '#lib/chartThumb.ts';
import { formatGrams } from '#lib/grams.ts';
import { bars } from '../chartLink';
import { ageChart, runwayPaces, runwaySeries, stateRows, unitFmt, waitingRows } from '../onHandSeries';
import type { ThumbFn } from '../thumbTypes';

// Each chart draws what its component draws for the same URL state (unit, waitBy, range), via the same helpers.
export const ONHAND_THUMBS: Record<string, ThumbFn> = {
  'onhand-age': ({ data, s }) => {
    if (!data.onHand) return null;
    const { series } = ageChart(data.onHand, s.unit);
    if (!series.some((x) => x.values.some((v) => (v ?? 0) > 0))) return null;
    const thumb = chartThumb('vbars', series, { stacked: true });
    return thumb && { title: 'Age profile', thumb };
  },
  'onhand-bag-states': ({ data, s }) => {
    if (!data.onHand) return null;
    const { labels, values } = stateRows(data.onHand, s.unit);
    if (!values.some((v) => v > 0)) return null;
    const fmt = unitFmt(s.unit);
    return { title: 'Bag states', thumb: bars(values.map((value, i) => ({ value, text: fmt(value), name: labels[i] })), true) };
  },
  'onhand-waiting': ({ data, s }) => {
    if (!data.onHand || data.onHand.tiles.bagsWaiting === 0) return null;
    const rows = waitingRows(data.onHand, s.waitBy);
    return { title: "What's waiting", thumb: bars(rows.map((r) => ({ value: r.grams, text: formatGrams(r.grams), name: `${r.label} (${r.bags})` })), false) };
  },
  'onhand-runway-at-your-pace': ({ data, s, periodLabel }) => {
    if (!data.onHand) return null;
    const r = runwaySeries(data.onHand.onHandG, data.today, runwayPaces({ range: s.range, periodLabel, runwayDays: data.onHand.runway.days, allDays: data.onHand.runwayAll.days }));
    const thumb = r && chartThumb('lines', r.series, { yMin: 0 });
    return thumb && { title: 'Runway at your pace', thumb };
  }
};
