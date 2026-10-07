// Tavily web search (spec "Server" and "Tavily budget"). Free plan: 1,500
// credits a month; basic depth costs 1. Calls are counted in search_usage.
import type { DatabaseSync } from 'node:sqlite';
import { getDb } from '../../db';
import type { CandidatePage, Provider, SuggestQuery } from '../types';

const ENDPOINT = 'https://api.tavily.com/search';
const WINDOW_MS = 31 * 86_400_000; // rolling, so it holds whatever day the billing month starts
export const BUDGET_NOTE = 'tavily monthly budget used';
const REASONS: Record<number, string> = { 401: 'bad API key', 429: 'rate limited', 432: 'monthly limit reached' };

const limit = () => Number(process.env.TAVILY_MONTHLY_LIMIT) || 1400;
const windowStart = (now: Date) => new Date(now.getTime() - WINDOW_MS).toISOString();

export function tavilyCallsInWindow(db: DatabaseSync, now = new Date()): number {
  const row = db.prepare(`SELECT COUNT(*) AS n FROM search_usage WHERE provider = 'tavily' AND at > ?`).get(windowStart(now)) as { n: number };
  return Number(row.n);
}

export function recordTavilyCall(db: DatabaseSync, now = new Date()): void {
  db.prepare(`DELETE FROM search_usage WHERE at <= ?`).run(windowStart(now));
  db.prepare(`INSERT INTO search_usage (provider, at) VALUES ('tavily', ?)`).run(now.toISOString());
}

const underBudget = (db: DatabaseSync, now: Date) => tavilyCallsInWindow(db, now) < limit();

export function tavilyAvailable(db: DatabaseSync = getDb(), now = new Date()): boolean | string {
  if (!process.env.TAVILY_API_KEY) return false;
  return underBudget(db, now) ? true : BUDGET_NOTE;
}

// Fixed host, so plain fetch (like getUsdRates); the result pages go through safeFetch.
async function call(query: string, domain: string | null, signal: AbortSignal, db: DatabaseSync, now: Date): Promise<CandidatePage[]> {
  recordTavilyCall(db, now); // before the call: a failed call may still cost a credit
  const body: Record<string, unknown> = { query, search_depth: 'basic', max_results: 5 };
  if (domain) body.include_domains = [domain];
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    signal,
    headers: { 'content-type': 'application/json', authorization: `Bearer ${process.env.TAVILY_API_KEY}` },
    body: JSON.stringify(body)
  });
  if (!res.ok) throw new Error(REASONS[res.status] ?? `HTTP ${res.status}`);
  const data = (await res.json()) as { results?: { url?: unknown; title?: unknown }[] };
  return (Array.isArray(data.results) ? data.results : []).flatMap((r) =>
    typeof r?.url === 'string' && /^https?:\/\//i.test(r.url)
      ? [{ url: r.url, title: typeof r.title === 'string' && r.title ? r.title : r.url, provider: 'tavily' }]
      : []
  );
}

// At most 2 calls: the roaster's site first, then the open web if it had nothing.
export async function searchTavily(q: SuggestQuery, signal: AbortSignal, db: DatabaseSync = getDb(), now = new Date()): Promise<CandidatePage[]> {
  const query = `"${q.name}" ${q.roaster} coffee`;
  if (!q.site) return call(query, null, signal, db, now);
  const onSite = await call(query, new URL(q.site).hostname, signal, db, now);
  if (onSite.length || !underBudget(db, now)) return onSite;
  return call(query, null, signal, db, now);
}

export const tavily: Provider = {
  name: 'tavily',
  available: () => tavilyAvailable(),
  search: (q, signal) => searchTavily(q, signal)
};
