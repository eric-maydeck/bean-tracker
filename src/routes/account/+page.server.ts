import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { getDb } from '$lib/server/db';
import { requireAdmin } from '$lib/server/auth';
import { importBeanConquerorData } from '$lib/server/beanconqueror';
import { MAX_UPLOAD_BYTES, parseBeanConquerorJson, readBeanConquerorZip } from '$lib/server/beanConquerorJson';
import { queueReadings } from '$lib/server/pourReadings';
import { uploadStatus, UPLOAD_USERNAME } from '$lib/server/visualizerUpload';

export const load: PageServerLoad = ({ locals, url }) => {
  if (!locals.isAdmin) redirect(303, '/login?redirectTo=%2Faccount');
  const db = getDb();
  const lastImported = db
    .prepare(`SELECT value FROM app_meta WHERE key = 'beanconqueror_last_imported_at'`)
    .get() as { value: string } | undefined;
  // Without ORIGIN, adapter-node builds url.origin from the Host header, so each domain shows its own URL.
  return { status: uploadStatus(db), lastImportedAt: lastImported?.value ?? null, uploadUrl: url.origin + '/', username: UPLOAD_USERNAME };
};

export const actions: Actions = {
  importBeanConqueror: async ({ request, locals }) => {
    requireAdmin(locals);
    const formData = await request.formData();
    const file = formData.get('file');
    if (!(file instanceof File)) {
      return fail(400, { error: 'No file uploaded' });
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      return fail(400, { error: 'That file is over 20 MB. Upload Beanconqueror.zip (the regular export).' });
    }
    // Parse errors carry an admin-readable message (bad zip, changed format), so
    // they surface as a clean 400 rather than a 500.
    let parsed;
    try {
      parsed = parseBeanConquerorJson(await readBeanConquerorZip(await file.arrayBuffer()));
    } catch (err) {
      return fail(400, { error: err instanceof Error ? err.message : 'Could not parse that Bean Conqueror export' });
    }
    const db = getDb();
    importBeanConquerorData(db, parsed);
    void queueReadings(db);
    return {
      success: true as const,
      imported: { beans: parsed.beans.length, brews: parsed.brews.length, waters: parsed.waters?.length ?? 0 }
    };
  }
};
