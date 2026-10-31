import { error, redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb } from '$lib/server/db';
import { getCoffeeBySlug } from '$lib/server/coffees';
import { getRoasterWebsite } from '$lib/server/roasterWebsites';
import { creditFor } from '$lib/imageCredit';
import { goTarget } from '$lib/server/goLink';

// Public, like the coffee page. Only ever redirects to a URL stored on this coffee (or its roaster's website).
export const GET: RequestHandler = async ({ params, url }) => {
  const db = getDb();
  const coffee = getCoffeeBySlug(db, params.slug);
  if (!coffee) error(404, 'Coffee not found');
  const site = getRoasterWebsite(db, coffee.roaster);
  const to = url.searchParams.get('to');
  const target =
    to === 'credit' ? creditFor(coffee, site, coffee.roaster_image_url ?? null)?.href
    : to === 'product' ? coffee.product_url
    : null;
  if (!target || !/^https?:\/\//i.test(target)) error(404, 'No link');
  redirect(302, await goTarget(target, site));
};
