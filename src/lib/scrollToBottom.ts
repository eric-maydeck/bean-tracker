import { tick } from 'svelte';

// Smooth unless the visitor asked for less motion.
export const scrollBehavior = (): ScrollBehavior => (matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth');

// Show more / Show less: run `change` (the navigation that grows or shrinks the list), then scroll so the bottom of the
// button (its footer) sits at the bottom of the screen, above the phone tab bar (user, 2026-10-20).
export async function bottomInView(list: Element | null | undefined, change: () => unknown): Promise<void> {
  await change();
  await tick();
  if (!list?.isConnected) return;
  const target = [...list.querySelectorAll('button')].at(-1) ?? list; // the button itself, not its footer's padding
  const tabs = document.querySelector('.bottom-tabs');
  const lift = tabs && getComputedStyle(tabs).display !== 'none' ? tabs.getBoundingClientRect().height : 0;
  scrollBy({ top: target.getBoundingClientRect().bottom - (innerHeight - lift), behavior: scrollBehavior() });
}
