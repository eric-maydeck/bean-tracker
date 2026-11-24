import { getContext, setContext } from 'svelte';

// How a heading links to itself, provided by a page that wants more than a plain `#id` (/stats: an href carrying
// chart=<id> so link previews name the chart, and a click that puts that URL in the address bar without a reload).
// Same shape as coffeeNote.ts. Without a provider HeadingAnchor falls back to `#id`.
export interface HeadingLink {
  href: (id: string) => string;
  go: (id: string) => void;
}
const KEY = 'insights-chart-link';
export const provideHeadingLink = (l: HeadingLink): void => void setContext(KEY, l);
export const useHeadingLink = (): HeadingLink | undefined => getContext<HeadingLink | undefined>(KEY);
