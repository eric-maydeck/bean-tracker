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
