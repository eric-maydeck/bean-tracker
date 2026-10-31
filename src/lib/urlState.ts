import { replaceState } from '$app/navigation';
import { page } from '$app/state';

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
  try {
    replaceState(next, page.state);
  } catch {
    // Best-effort mirror -- browsers throw SecurityError when history calls
    // are flooded (e.g. fast typing triggering this on every keystroke).
  }
}
