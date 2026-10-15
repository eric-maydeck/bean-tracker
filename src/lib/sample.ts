// One small-sample rule for every insights view (spec 2026-10-15 Part 1). Client-safe: the markers and
// legends import it too. A small result still shows, with SampleNote's "Low confidence" chip and tip.
export const POOLED_MIN_BAGS = 3;
export const POOLED_MIN_BREWS = 10;
export const BAG_MIN_BREWS = 4;
export interface Sample { bags: number; brews: number; small: boolean; one?: boolean }
// A result pooled over several bags: a roaster, origin, roast level, chart bar, heatmap cell, finding.
// No brews at all is no data, not low confidence: never small (so no chip or fold on an empty cell or bar).
export const pooled = (bags: number, brews: number): Sample =>
  ({ bags, brews, small: brews > 0 && (bags < POOLED_MIN_BAGS || brews < POOLED_MIN_BREWS) });
// A result about one bag or coffee.
export const single = (brews: number): Sample => ({ bags: 1, brews, small: brews > 0 && brews < BAG_MIN_BREWS, one: true });
// The tip's title, wherever a small sample is marked; the chip itself reads chipLabel (a short count).
export const TIP_TITLE = 'Low confidence';
const n = (k: number, w: string) => `${k} ${w}${k === 1 ? '' : 's'}`;
// The chip's short count (2A): what is short, bags when they are, else brews; the tip says why and what is needed.
export const chipLabel = (s: Sample) => `Only ${s.bags < POOLED_MIN_BAGS && !s.one ? n(s.bags, 'bag') : n(s.brews, 'brew')}`;
export const CHIP_EXAMPLE = 'Only 2 bags'; // the legend's sample chip
// The tip: the plain reason (bags when they are short, else brews) and the exact counts. `paired`: the counts
// are of same-bag paired brews, so the rows say so beside plain columns.
export const sampleTip = (s: Sample, paired = false): { lines: string[]; rows: [string, string][] } => {
  const k = (w: string) => (paired ? `Paired ${w}` : w[0].toUpperCase() + w.slice(1));
  const rated: [string, string] = [k('rated brews'), String(s.brews)];
  if (s.one) return { lines: [`Small sample: only ${n(s.brews, 'rated brew')}, so one brew can swing this. One coffee needs ${BAG_MIN_BREWS}+.`], rows: [rated] };
  const bagsShort = s.bags < POOLED_MIN_BAGS;
  const what = bagsShort ? ['bag', s.bags] as const : ['rated brew', s.brews] as const;
  return {
    lines: [`Small sample: only ${n(what[1], what[0])}, so one ${bagsShort ? 'bag' : 'brew'} can swing this. Needs ${POOLED_MIN_BAGS}+ bags and ${POOLED_MIN_BREWS}+ rated brews.`],
    rows: [[k('bags'), String(s.bags)], rated]
  };
};
// A tip's `sample` field: the one block every marker shows (TipBody): the title, the reason, the counts.
export const sampleField = (s: Sample, paired = false) => (s.small ? { sample: { s, paired } } : {});
// The one legend line, wherever a help popover explains the chip (TipBody renders the chip and the swatch).
export const SAMPLE_HELP =
  `${CHIP_EXAMPLE}: low confidence, under ${POOLED_MIN_BAGS} bags or ${POOLED_MIN_BREWS} rated brews (one coffee: under ${BAG_MIN_BREWS}), so one bag or brew can swing it.`;
