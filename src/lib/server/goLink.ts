import { safeFetch } from './productFetch';

// Click-time dead-link check for the coffee page's /go route. Only 404 and 410 mean dead -> the roaster
// site; 401/403/429 (bot protection), other 4xx, 5xx, timeout or a network error -> the link anyway.
// safeFetch is a guarded GET (no HEAD, 2 MB cap, redirects followed, private addresses refused);
// ponytail: no HEAD, add if bodies hurt. Verdicts are cached in memory per URL for 10 minutes.
export const GO_TIMEOUT_MS = 4000;
const TTL_MS = 10 * 60_000;
const cache = new Map<string, { dead: boolean; at: number }>();

export function clearGoCache(): void {
  cache.clear();
}

export async function checkStatus(url: string): Promise<number> {
  return (await safeFetch(url, AbortSignal.timeout(GO_TIMEOUT_MS))).status;
}

export async function goTarget(
  url: string,
  site: string | null,
  check: (url: string) => Promise<number> = checkStatus
): Promise<string> {
  if (!site || url === site) return url;
  const hit = cache.get(url);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.dead ? site : url;
  let dead = false;
  try {
    const status = await check(url);
    dead = status === 404 || status === 410;
  } catch {
    return url; // timeouts and network errors aren't cached: the next click tries again
  }
  cache.set(url, { dead, at: Date.now() });
  return dead ? site : url;
}
