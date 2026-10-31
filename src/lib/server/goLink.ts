import { safeFetch } from './productFetch';

// Click-time dead-link check for the coffee page's /go route. 4xx -> the roaster site;
// timeout, 5xx or a network error -> the link anyway. safeFetch is a guarded GET (no HEAD,
// 2 MB cap, redirects followed, private addresses refused); ponytail: no HEAD, add if bodies hurt.
export const GO_TIMEOUT_MS = 4000;

export async function checkStatus(url: string): Promise<number> {
  return (await safeFetch(url, AbortSignal.timeout(GO_TIMEOUT_MS))).status;
}

export async function goTarget(
  url: string,
  site: string | null,
  check: (url: string) => Promise<number> = checkStatus
): Promise<string> {
  if (!site || url === site) return url;
  try {
    const status = await check(url);
    return status >= 400 && status < 500 ? site : url;
  } catch {
    return url;
  }
}
