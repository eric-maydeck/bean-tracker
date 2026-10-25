import { getContext, setContext } from 'svelte';

// +page.svelte provides how a heading links to itself: an href carrying chart=<id> (link previews name the chart)
// and a click that puts the same URL in the address bar without a reload. Same shape as coffeeNote.ts.
export interface ChartLink {
  href: (id: string) => string;
  go: (id: string) => void;
}
const KEY = 'insights-chart-link';
export const provideChartLink = (l: ChartLink): void => void setContext(KEY, l);
export const useChartLink = (): ChartLink => getContext<ChartLink>(KEY);
