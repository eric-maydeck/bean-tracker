import { error, redirect } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import { resolveShortLink } from '$lib/server/shortLinks';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ params }) => {
  const url = resolveShortLink(getDb(), params.code, new Date());
  if (!url) error(404, 'This link has expired');
  redirect(303, url);
};
