import { error, redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb } from '$lib/server/db';

// Bean Conqueror opens this link after an upload; send it to the (public) coffee page of that brew.
export const GET: RequestHandler = ({ params }) => {
  if (!/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(params.id)) error(404, 'Not found');
  const row = getDb()
    .prepare(
      `SELECT c.slug FROM beanconqueror_brews b
       JOIN beanconqueror_beans bn ON bn.id = b.bean_id JOIN coffees c ON c.id = bn.coffee_id
       WHERE b.bc_uuid = ?`
    )
    .get(params.id) as { slug: string } | undefined;
  redirect(303, row ? `/coffees/${row.slug}` : '/coffees');
};
