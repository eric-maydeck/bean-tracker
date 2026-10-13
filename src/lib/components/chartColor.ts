// The main series' color token (ui-rules 42): a lone series stands for no category, so it stays brand brown;
// beside other series it takes the categorical palette's first slot.
export const mainColorToken = (otherSeries: number) => (otherSeries ? '--series-1' : '--chart-color-1');
