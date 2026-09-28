import { replaceState } from '$app/navigation';
import { page } from '$app/state';

// Mirror a page's explicit view state into the address bar without a
// navigation or history entry. Callers pass only explicit choices; inline
// edit state must never be part of `params`. Reads `location`, not
// `page.url`: shallow routing (replaceState) doesn't update `page.url`.
export function writeUrlParams(params: URLSearchParams): void {
  const qs = params.toString();
  const next = `${location.pathname}${qs ? `?${qs}` : ''}${location.hash}`;
  if (next !== `${location.pathname}${location.search}${location.hash}`) replaceState(next, page.state);
}
