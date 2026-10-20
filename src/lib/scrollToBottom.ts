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
  let dy = target.getBoundingClientRect().bottom - (innerHeight - lift);
  // Back to top (layout.svelte: shown past one screen of scroll, 44px, 12px off the bottom) must not cover the button: land
  // just above it, with an 8px gap, whenever it will be showing.
  if (Math.min(scrollY + dy, document.documentElement.scrollHeight - innerHeight) > innerHeight) dy += 44 + 12 + 8;
  scrollBy({ top: dy, behavior: scrollBehavior() });
}
