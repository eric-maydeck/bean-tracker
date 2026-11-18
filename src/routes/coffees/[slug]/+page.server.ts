import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { getDb } from '#lib/server/db.ts';
import { localTodayDate } from '#lib/server/localToday.ts';
import { getCoffeeBySlug, getDistinctFieldValues, getFillHistory, getRedirectSlug } from '#lib/server/coffees.ts';
import { getSubscriptionOptions, subscriptionOf } from '#lib/server/subscriptions.ts';
import { getRoasterWebsite } from '#lib/server/roasterWebsites.ts';
import { creditFor } from '#lib/imageCredit.ts';
import { getRoasterImages } from '#lib/server/roasterImages.ts';
import { getRoastLevels } from '#lib/server/roastLevels.ts';
import { withComputedFields } from '#lib/server/urgency.ts';
import { requireAdmin } from '#lib/server/auth.ts';
import { handleCoffeeCreate } from '#lib/server/coffeeFormActions.ts';
import { queueFillMissing } from '#lib/server/imageFills.ts';
import { getLinkedBean, unlinkBeanConquerorBean } from '#lib/server/beanConquerorLinks.ts';
import { coffeeLike } from '#lib/server/insights/likeGroup.ts';
import { ordinal } from '#lib/server/insights/milestones.ts';
import { favoriteGrind } from '#lib/server/favoriteGrind.ts';
import { parseLikeView } from '#lib/insightsUrl.ts';

export const load: PageServerLoad = ({ params, url, setHeaders, locals }) => {
  const db = getDb();
  const coffee = getCoffeeBySlug(db, params.slug);
  if (!coffee) {
    const current = getRedirectSlug(db, params.slug);
    if (current) {
      // no-store: a browser-cached 301 would loop if the coffee is later
      // renamed back to this slug (renaming back is allowed).
      setHeaders({ 'cache-control': 'no-store' });
      redirect(301, `/coffees/${current}`);
    }
    error(404, 'Coffee not found');
  }
  const likeView = parseLikeView(url.searchParams);
  const r = coffeeLike(db, coffee.id, likeView);
  const like = r && 'like' in r ? r.like : null;
  return {
    coffee: withComputedFields(coffee, localTodayDate()),
    credit: creditFor(coffee, getRoasterWebsite(db, coffee.roaster), coffee.roaster_image_url ?? null),
    roastLevels: getRoastLevels(db),
    roasters: getDistinctFieldValues(db, 'roaster'),
    origins: getDistinctFieldValues(db, 'origin'),
    processingMethods: getDistinctFieldValues(db, 'processing'),
    roasterImages: getRoasterImages(db),
    beanConqueror: getLinkedBean(db, coffee.id),
    favoriteGrind: favoriteGrind(db, coffee.id),
    like: like && { ...like, place: `${ordinal(like.rank)} of ${like.of}` },
    noLike: r && !('like' in r) ? r : null,
    likeView,
    restHistory: locals.isAdmin ? getFillHistory(db) : [],
    subscriptions: locals.isAdmin ? getSubscriptionOptions(db) : [],
    subscription: subscriptionOf(db, coffee.subscription_id)
  };
};

export const actions: Actions = {
  create: async ({ request, locals }) => {
    requireAdmin(locals);
    const db = getDb();
    const result = handleCoffeeCreate(db, await request.formData());
    void queueFillMissing(db); // a new image → its backdrop fill, in the background
    return result;
  },
  unlinkBeanConqueror: async ({ params, locals }) => {
    requireAdmin(locals);
    const db = getDb();
    const coffee = getCoffeeBySlug(db, params.slug);
    if (!coffee || !unlinkBeanConquerorBean(db, coffee.id)) {
      return fail(400, { unlinkError: 'This coffee has no Bean Conqueror bean to unlink' });
    }
    return { success: true as const };
  }
};
