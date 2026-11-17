// Loffee Labs Bean Base as a page finder: the roaster's bean pages whose name matches the coffee.
// Only the page links are used (never Bean Base's own image field: the terms forbid redistributing its data).
import { beanBaseKey, rankedBeans } from '../../beanBase';
import type { CandidatePage, Provider, SuggestQuery } from '../types';

export async function searchBeanBasePages(q: SuggestQuery, opts: { key?: string | null; fetcher?: typeof fetch } = {}): Promise<CandidatePage[]> {
  const r = await rankedBeans(q.roaster, q.name, { ...opts, roastDate: q.roastDate });
  if (r.status === 'failed') throw new Error('Bean Base lookup failed');
  if (r.status !== 'ok') return [];
  // No name word in common = an unrelated page, skip it (the dialog lists those; image search must not).
  return r.ranked.flatMap(({ b, match }) =>
    b.link && match > 0 ? [{ url: b.link, title: b['roast-name'] ?? '', provider: 'beanbase' }] : []
  );
}

// Runs only when the coffee has no product page of its own. ponytail: gear (term set) never runs it; a caller's abort signal isn't passed (fetchBeanBase has its own 5s timeout).
export const beanBase: Provider = {
  name: 'beanbase',
  available: (q) => !q.term && !q.productUrl && !!beanBaseKey() && !!q.roaster.trim(),
  search: (q) => searchBeanBasePages(q)
};
