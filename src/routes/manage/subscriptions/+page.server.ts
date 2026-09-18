import type { PageServerLoad } from './$types';
import { getDb } from '$lib/server/db';
import { getSubscriptions, withTotalGrams } from '$lib/server/subscriptions';

export const load: PageServerLoad = () => {
  const subscriptions = getSubscriptions(getDb()).map(withTotalGrams);
  return { subscriptions };
};
