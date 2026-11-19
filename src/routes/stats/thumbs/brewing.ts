import { chartThumb } from '#lib/chartThumb.ts';
import type { ThumbFn } from '../thumbTypes';
import { waitBars } from '../waitBars';

export const BREWING_THUMBS: Record<string, ThumbFn> = {
  'brewing-best': (c) => {
    const t = c.data.brewing;
    if (!t?.bestAt.length) return null;
    const thumb = chartThumb('vbars', [{ label: 'Bags', values: t.bestAt.map((b) => b.bags) }], { x: t.bestAt.map((b) => b.label), fmt: (v) => `${v} bag${v === 1 ? '' : 's'}` });
    return thumb && { title: 'Brews until dialed', thumb };
  },
  'brewing-rating-by-wait': (c) => {
    const w = c.data.brewing?.wait && waitBars(c.data.brewing.wait);
    if (!w) return null;
    const thumb = chartThumb('vbars', [{ label: 'Rating', values: w.values }], { yMin: w.yMin, x: w.labels, fmt: (v) => v.toFixed(1) });
    return thumb && { title: 'Rating by wait', thumb };
  }
};
