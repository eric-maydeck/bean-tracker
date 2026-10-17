import { sampleField, type Sample } from '$lib/sample';

// A settle column's tip (ui-rules 29, 36): the group, its median settle brew and counts, the Low confidence caveat
// last (TipBody; a small group's counts are in the caveat). The measure reads each bag's first 6 brews (SETTLE_WINDOW,
// server-only; the help text says 6 too), so the count says so instead of "Rated brews".
export const settleTip = (g: { label: string; value: number; bags: number; brews: number; sample: Sample }) => ({
  title: g.label,
  rows: [['Median settle brew', `${g.value}`], ...(g.sample.small ? [] : [['Bags', `${g.bags}`], ['Brews read (first 6 each)', `${g.brews}`]])] as [string, string][],
  ...sampleField(g.sample)
});
