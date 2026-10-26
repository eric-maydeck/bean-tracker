import { setting } from './settingName';
// One small-sample rule for every insights view (spec 2026-10-15 Part 1). Client-safe: the markers and
// legends import it too. A small result still shows, with SampleNote's "Low confidence" chip and tip.
export const POOLED_MIN_BAGS = 3;
export const POOLED_MIN_BREWS = 10;
export const BAG_MIN_BREWS = 4;
// `brews`: the rated brews the rule counts, dial-in ones included (user ruling 2026-10-17). `scored`: the brews behind
// the figure once dialed, only when fewer; a row shows it as its count (coordinator ruling 2026-10-17), and the chip
// and its tip follow, so they never contradict the row.
export interface Sample { bags: number; brews: number; small: boolean; one?: boolean; scored?: number }
const withScored = (s: Sample, scored?: number): Sample => (scored !== undefined && scored !== s.brews ? { ...s, scored } : s);
// A result pooled over several bags: a roaster, origin, roast level, chart bar, heatmap cell, finding.
// No brews at all is no data, not low confidence: never small (so no chip or fold on an empty cell or bar).
export const pooled = (bags: number, brews: number, scored?: number): Sample =>
  withScored({ bags, brews, small: brews > 0 && (bags < POOLED_MIN_BAGS || brews < POOLED_MIN_BREWS) }, scored);
// A result about one bag or coffee.
export const single = (brews: number, scored?: number): Sample =>
  withScored({ bags: 1, brews, small: brews > 0 && brews < BAG_MIN_BREWS, one: true }, scored);
// The brews a row shows: the scored ones.
export const shownBrews = (s: Sample): number => s.scored ?? s.brews;
// A board whose rows differ by no more than chance would make them (user ruling 2026-10-17, threshold audit: roasters
// and origins barely differ): the variance of its row values is at most their mean SE² (an F of 1 or less).
// Rows without an SE are left out; under 2 rows with one, false.
export function withinNoise(rows: readonly { value: number; se?: number }[]): boolean {
  const xs = rows.filter((r) => r.se !== undefined);
  if (xs.length < 2) return false;
  const m = xs.reduce((s, r) => s + r.value, 0) / xs.length;
  const v = xs.reduce((s, r) => s + (r.value - m) ** 2, 0) / (xs.length - 1);
  return v <= xs.reduce((s, r) => s + r.se! ** 2, 0) / xs.length;
}
// The tip's title, wherever a small sample is marked; the chip itself reads chipLabel (a short count).
export const TIP_TITLE = 'Low confidence';
// A count for text: whole stays whole, a fractional bag share (settle groups) shows one decimal.
export const countText = (k: number): string => (Number.isInteger(k) ? String(k) : k.toFixed(1));
const n = (k: number, w: string) => `${countText(k)} ${w}${k === 1 ? '' : 's'}`;
// The chip's short count (2A): what is short, bags when they are, else brews; the tip says why and what is needed.
export const chipLabel = (s: Sample) => `Only ${s.bags < POOLED_MIN_BAGS && !s.one ? n(s.bags, 'bag') : n(shownBrews(s), 'brew')}`;
// The tip's count rows; with dial-in brews skipped, the rated count beside the scored one.
const countRows = (s: Sample, rated = 'Rated brews'): [string, string][] =>
  s.scored === undefined ? [[rated, String(s.brews)]] : [[rated, String(s.brews)], ['Brews scored once dialed', String(s.scored)]];
// "12 rated brews, 9 scored once dialed": a row tip's line when the two differ; else null.
export const scoredLine = (s: Sample | undefined): string | null =>
  s?.scored === undefined ? null : `${n(s.brews, 'rated brew')}, ${s.scored} scored ${setting('once dialed')}`;
export const CHIP_EXAMPLE = 'Only 2 bags'; // the legend's sample chip
// The tip: the plain reason (bags when they are short, else brews) and the exact counts. `paired`: the counts
// are of same-bag paired brews, so the rows say so beside plain columns.
export const sampleTip = (s: Sample, paired = false): { lines: string[]; rows: [string, string][] } => {
  const cap = (w: string) => w[0].toUpperCase() + w.slice(1);
  if (s.one) return { lines: [`Small sample: only ${n(s.brews, 'rated brew')}, so one brew can swing this. One coffee needs ${BAG_MIN_BREWS}+.`], rows: countRows(s) };
  const bagsShort = s.bags < POOLED_MIN_BAGS;
  // A same-bag comparison counts only the bags brewed both ways (this recipe, grind, dripper ... and another).
  const rows: [string, string][] = paired
    ? [['Bags brewed both ways', countText(s.bags)], ['Rated brews in them', String(s.brews)]]
    : [[cap('bags'), countText(s.bags)], ...countRows(s)];
  const need = `Needs ${POOLED_MIN_BAGS}+ ${paired ? 'such ' : ''}bags and ${POOLED_MIN_BREWS}+ rated brews${paired ? ' in them' : ''}.`;
  const only = paired
    ? (bagsShort ? `${n(s.bags, 'bag')} ${s.bags === 1 ? 'was' : 'were'} brewed both this way and another way` : `${n(s.brews, 'rated brew')} in bags brewed both this way and another way`)
    : (bagsShort ? n(s.bags, 'bag') : n(s.brews, 'rated brew'));
  return { lines: [`Small sample: only ${only}, so one ${bagsShort ? 'bag' : 'brew'} can swing this. ${need}`], rows };
};
// A tip's `sample` field: the one block every marker shows (TipBody): the title, the reason, the counts.
export const sampleField = (s: Sample, paired = false) => (s.small ? { sample: { s, paired } } : {});
// The one legend line, wherever a help popover explains the chip (TipBody renders the chip and the swatch).
export const SAMPLE_NOTE = `Low confidence: under ${POOLED_MIN_BAGS} bags or ${POOLED_MIN_BREWS} rated brews (${BAG_MIN_BREWS} for one coffee).`;
export const SAMPLE_HELP = `${CHIP_EXAMPLE}: ${SAMPLE_NOTE}`; // the chip's text follows its first ": " (LabHead, TipBody, ValueMap show the chip itself)
