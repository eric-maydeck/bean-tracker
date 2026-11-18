import { goto, refreshAll } from '$app/navigation';
import { navigating, page } from '$app/state';

// Kit 3's shallow goto takes the navigation and invalidation tokens: it would drop a pending link tap, Back or
// refreshAll (Kit 2's replaceState did neither). So a mirror write waits for both, keeping only the latest.
let refreshing = 0;
let queued: { next: string; path: string } | null = null;

// refreshAll, tracked so a mirror write waits for it. Pages that mirror their state call this, not Kit's.
export async function refreshTracked(): Promise<void> {
  refreshing++;
  try { await refreshAll(); } finally { refreshing--; setTimeout(flush); }
}

function flush() {
  const q = queued;
  queued = null;
  if (q && q.path === location.pathname) mirrorUrl(q.next); // another page by now: the write no longer applies
}

// Replace the address bar with `next` (no navigation, no history entry), once nothing else is pending.
export function mirrorUrl(next: string): void {
  if (refreshing || navigating.to) {
    queued = { next, path: location.pathname };
    navigating.complete?.catch(() => {}).then(() => setTimeout(flush));
    return;
  }
  // Best-effort mirror: browsers throw SecurityError when history calls are flooded (e.g. fast typing).
  // goto is async, so that surfaces as a rejection (warned, not thrown). It rejects for an unresolvable route too.
  goto(next, { shallow: true, replace: true, state: page.state }).catch((err) => console.warn('URL mirror failed', err));
}

// Mirror a page's explicit view state into the address bar without a
// navigation or history entry. Callers pass only explicit choices; inline
// edit state must never be part of `params`. Reads `location`, not
// `page.url`: shallow routing (replaceState) doesn't update `page.url`.
// `about` (the site-wide "How AI was used" dialog, AiNote) isn't a page param: it is carried over from the address bar
// unless the caller is AiNote itself (carryAbout = false).
export function writeUrlParams(params: URLSearchParams, carryAbout = true): void {
  const about = carryAbout && !params.has('about') ? new URLSearchParams(location.search).get('about') : null;
  if (about) (params = new URLSearchParams(params)).set('about', about);
  const qs = params.toString();
  const next = `${location.pathname}${qs ? `?${qs}` : ''}${location.hash}`;
  if (next === `${location.pathname}${location.search}${location.hash}`) return;
  mirrorUrl(next);
}
