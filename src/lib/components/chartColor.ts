// A chart's series colors by position, the same on every chart (ui-rules 42): 1-3 series are the browns
// (brown, tan, sand), 4+ the categorical palette. `total` counts every series on the chart.
export const seriesToken = (i: number, total: number) => (total <= 3 ? `--series-brown-${i + 1}` : `--series-${i + 1}`);
