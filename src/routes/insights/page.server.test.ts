import { describe, it, expect } from 'vitest';
import { load } from './+page.server';

const go = (search: string) => {
  try {
    load({ url: new URL(`http://x/insights${search}`) } as never);
  } catch (e) {
    return e as { status: number; location: string };
  }
};

describe('/insights redirect', () => {
  it('keeps the query', () => expect(go('?tab=leaderboards&rank=grams')).toMatchObject({ status: 301, location: '/stats?tab=leaderboards&rank=grams' }));
  it('bare goes to /stats', () => expect(go('')).toMatchObject({ status: 301, location: '/stats' }));
});
