// One small-sample rule for every insights view (spec 2026-10-15 Part 1). Client-safe: the markers and
// legends import it too. A small result still shows, with SampleNote's "Low confidence" chip and tip.
export const POOLED_MIN_BAGS = 3;
export const POOLED_MIN_BREWS = 10;
export const BAG_MIN_BREWS = 4;
export interface Sample { bags: number; brews: number; small: boolean; one?: boolean }
// A result pooled over several bags: a roaster, origin, roast level, chart bar, heatmap cell, finding.
export const pooled = (bags: number, brews: number): Sample =>
  ({ bags, brews, small: bags < POOLED_MIN_BAGS || brews < POOLED_MIN_BREWS });
// A result about one bag or coffee.
export const single = (brews: number): Sample => ({ bags: 1, brews, small: brews < BAG_MIN_BREWS, one: true });
// The chip's label, wherever a small sample is marked (the count lives in the tip, never in the chip).
export const SAMPLE_LABEL = 'Low confidence';
const n = (k: number, w: string) => `${k} ${w}${k === 1 ? '' : 's'}`;
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
// A data tip's reason line for a small sample (its own count rows stay); nothing when the sample is fine.
export const sampleBody = (s: Sample) => (s.small ? { lines: sampleTip(s).lines } : {});
// The one legend line, wherever a help popover explains the chip.
export const SAMPLE_HELP =
  `${SAMPLE_LABEL}: a small sample (under ${POOLED_MIN_BAGS} bags or ${POOLED_MIN_BREWS} rated brews; one coffee: under ${BAG_MIN_BREWS}), so one bag or brew can swing it.`;
