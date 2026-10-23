// A chart's series colors by position, the same on every chart (ui-rules 42): 1-3 series are the browns
// (light, medium, dark; two series take the light and the dark), 4+ the categorical palette. `total` counts every series on the chart.
export const seriesToken = (i: number, total: number) =>
  total <= 3 ? `--series-brown-${total === 2 && i === 1 ? 3 : i + 1}` : `--series-${i + 1}`;
