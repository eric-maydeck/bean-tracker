import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb } from '$lib/server/db';
import { uploadGate } from '$lib/server/uploadGate';
import { MAX_SHOT_BYTES, parseShot, saveShot, ShotError } from '$lib/server/visualizerUpload';

// Bean Conqueror's "custom Visualizer server" upload. Exempt from the form CSRF check (csrf.ts), so the
// password gate must run before anything else, and before the body is read.
export const POST: RequestHandler = async ({ request, getClientAddress }) => {
  const db = getDb();
  const refused = await uploadGate(request, getClientAddress);
  if (refused) return refused;
  const bad = (error: string, status = 400) => json({ error }, { status });
  if (Number(request.headers.get('content-length')) > MAX_SHOT_BYTES) return bad('Upload is too large', 413);
  const form = await request.formData().catch(() => null);
  const file = form?.get('file');
  if (!(file instanceof File)) return bad('Missing file');
  if (file.size > MAX_SHOT_BYTES) return bad('Upload is too large', 413);
  let parsed: unknown;
  try {
    parsed = JSON.parse(await file.text());
  } catch {
    return bad('visualizer.json is not valid JSON');
  }
  try {
    return json(saveShot(db, parseShot(parsed)));
  } catch (e) {
    if (e instanceof ShotError) return bad(e.message);
    throw e;
  }
};
