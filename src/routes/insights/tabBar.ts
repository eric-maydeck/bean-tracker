import { getContext, setContext, type Snippet } from 'svelte';

const KEY = 'insights-tab-bar';
type Register = (bar: Snippet) => () => void;
// +page.svelte provides the sticky bar's tab slot; a tab hands it its controls (rendered inside the bar, so they float with it)
// from an $effect and returns the effect's cleanup.
export const provideTabBar = (register: Register): void => void setContext(KEY, register);
export const useTabBar = (): Register => getContext<Register>(KEY) ?? (() => () => {});
