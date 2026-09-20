import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb } from '$lib/server/db';
import { requireAdmin } from '$lib/server/auth';
import { validateCoffeeBatch, type CoffeeBatchChange } from '$lib/server/coffeeBatchActions';

export const POST: RequestHandler = async ({ request, locals }) => {
  requireAdmin(locals);
  const { changes } = (await request.json()) as { changes: CoffeeBatchChange[] };
  const errors = validateCoffeeBatch(getDb(), changes);
  return json({ errors });
};
