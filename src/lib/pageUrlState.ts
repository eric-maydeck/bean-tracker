// The address bar's query. On the client this reads `location`, not the
// given `url` (SvelteKit's `page.url`): `replaceState` (see urlState.ts)
// doesn't update `page.url`, so after any client-side replaceState that
// would go stale. `typeof location` guards SSR, where there's no
// `location` global -- there, `url` (e.g. `page.url`) is the request URL.
export function currentParams(url: URL): URLSearchParams {
  return typeof location !== 'undefined' ? new URLSearchParams(location.search) : url.searchParams;
}

// Whitelisted, case-insensitive readers for simple page params. Anything
// not in `allowed` is ignored rather than an error.
export function pickOne<T extends string>(p: URLSearchParams, name: string, allowed: readonly T[]): T | undefined {
  const v = p.get(name)?.toLowerCase();
  return allowed.find((a) => a.toLowerCase() === v);
}

export function pickMany<T extends string>(p: URLSearchParams, name: string, allowed: readonly T[]): T[] | undefined {
  const given = new Set(p.getAll(name).map((v) => v.toLowerCase()));
  const picked = allowed.filter((a) => given.has(a.toLowerCase()));
  return picked.length ? picked : undefined;
}
