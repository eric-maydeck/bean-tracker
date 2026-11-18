import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb } from '#lib/server/db.ts';
import { requireAdmin } from '#lib/server/auth.ts';
import { proposeStandards, type ProposeInput } from '#lib/server/standards.ts';

const isStrings = (v: unknown): v is Record<string, string> =>
  !!v && typeof v === 'object' && !Array.isArray(v) && Object.values(v).every((x) => typeof x === 'string');

export const POST: RequestHandler = async ({ request, locals }) => {
  requireAdmin(locals);
  const b = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const ok =
    isStrings(b?.values) &&
    ((b!.mode === 'save' && Array.isArray(b!.fields) && b!.fields.every((f) => typeof f === 'string')) ||
      (b!.mode === 'fill' && isStrings(b!.incoming)));
  if (!ok) return json({ error: 'Bad request' }, { status: 400 });
  return json({ rows: proposeStandards(getDb(), b as unknown as ProposeInput) });
};
