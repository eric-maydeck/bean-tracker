// The coffee's own product page: its images come first, through the same read and ranking as any found page.
import type { Provider } from '../types';

export const product: Provider = {
  name: 'product',
  available: (q) => !!q.productUrl,
  search: async (q) => (q.productUrl ? [{ url: q.productUrl, title: q.name, provider: 'product' }] : [])
};
