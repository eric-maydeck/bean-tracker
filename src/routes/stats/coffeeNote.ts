import { getContext, setContext } from 'svelte';
import { emptyLine } from '$lib/insightsUrl';

const KEY = 'insights-coffee-note';
// +page.svelte provides the active Coffees filter phrase; each tab's empty line names it (spec Part 3).
export const provideCoffeeNote = (get: () => string): void => void setContext(KEY, get);
export function useEmptyLine(): (text: string) => string {
  const get = getContext<(() => string) | undefined>(KEY);
  return (text) => emptyLine(text, get?.() ?? '');
}
