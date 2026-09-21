import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb } from '$lib/server/db';
import { requireAdmin } from '$lib/server/auth';
import { validateCoffeeBatch, type CoffeeBatchChange } from '$lib/server/coffeeBatchActions';

export const POST: RequestHandler = async ({ request, locals }) => {
  requireAdmin(locals);
  const body = await request.json();
  if (!Array.isArray(body.changes)) {
    return json({ error: 'Invalid request: changes must be an array' }, { status: 400 });
  }
  const changes = body.changes as CoffeeBatchChange[];
  const errors = validateCoffeeBatch(getDb(), changes);
  return json({ errors });
};
