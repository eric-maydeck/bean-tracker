// One small-sample rule for every insights view (spec 2026-10-15 Part 1). Client-safe: the markers and
// legends import it too. A small result still shows, muted, with SampleNote's label and counts.
export const POOLED_MIN_BAGS = 3;
export const POOLED_MIN_BREWS = 10;
export const BAG_MIN_BREWS = 4;
export interface Sample { bags: number; brews: number; small: boolean }
// A result pooled over several bags: a roaster, origin, roast level, chart bar, heatmap cell, finding.
export const pooled = (bags: number, brews: number): Sample =>
  ({ bags, brews, small: bags < POOLED_MIN_BAGS || brews < POOLED_MIN_BREWS });
// A result about one bag or coffee.
export const single = (brews: number): Sample => ({ bags: 1, brews, small: brews < BAG_MIN_BREWS });
// The marker's short label: the brew count when brews are short (or it's one bag), else "few bags".
export const sampleLabel = (s: Sample): string =>
  s.bags >= POOLED_MIN_BAGS || s.brews < BAG_MIN_BREWS ? `${s.brews} brew${s.brews === 1 ? '' : 's'}` : 'few bags';
// The exact counts, for the marker's tip and every chart tip.
export const sampleRows = (s: Sample): [string, string][] => [['Bags', String(s.bags)], ['Brews', String(s.brews)]];
// The one legend line, wherever a help popover explains the muted look.
export const SAMPLE_HELP =
  `Muted: few bags or brews (under ${POOLED_MIN_BAGS} bags or ${POOLED_MIN_BREWS} brews; one bag: under ${BAG_MIN_BREWS}).`;
