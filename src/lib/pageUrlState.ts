// The address bar's query. On the client this reads `location`, not the
// given `url` (SvelteKit's `page.url`): a shallow goto (see urlState.ts)
// doesn't update `page.url`, so after any client-side shallow goto that
// would go stale. `typeof location` guards SSR, where there's no
// `location` global -- there, `url` (e.g. `page.url`) is the request URL.
// Read-only view: `page.url.searchParams` is a ReadonlyURLSearchParams in SvelteKit 3.
export type ReadParams = Pick<URLSearchParams, 'get' | 'getAll' | 'has'>;

export function currentParams(url: { search: string }): URLSearchParams {
  return new URLSearchParams(typeof location !== 'undefined' ? location.search : url.search);
}

// Whitelisted, case-insensitive readers for simple page params. Anything
// not in `allowed` is ignored rather than an error.
export function pickOne<T extends string>(p: ReadParams, name: string, allowed: readonly T[]): T | undefined {
  const v = p.get(name)?.toLowerCase();
  return allowed.find((a) => a.toLowerCase() === v);
}

export function pickMany<T extends string>(p: ReadParams, name: string, allowed: readonly T[]): T[] | undefined {
  const given = new Set(p.getAll(name).map((v) => v.toLowerCase()));
  const picked = allowed.filter((a) => given.has(a.toLowerCase()));
  return picked.length ? picked : undefined;
}
