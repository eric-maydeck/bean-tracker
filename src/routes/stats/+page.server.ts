import { fail } from '@sveltejs/kit';
import ExcelJS from 'exceljs';
import JSZip from 'jszip';
import type { Actions, PageServerLoad } from './$types';
import { getDb, getStatsRates, setStatsRates, InvalidRatesError } from '$lib/server/db';
import { getArchivedCoffees, getBacklogCoffees, getDistinctFieldValues, getFillHistory, getOpenCoffees } from '$lib/server/coffees';
import { getRoasterImages } from '$lib/server/roasterImages';
import { getRoastLevels } from '$lib/server/roastLevels';
import { requireAdmin } from '$lib/server/auth';
import {
  parseBeanConquerorWorkbook,
  importBeanConquerorData,
  BeanConquerorImportError,
  type ParsedBeanConquerorData,
  getUnmatchedBeanConquerorBeans,
  countUnmatchedBeanConquerorBeans,
  dismissBeanConquerorBean
} from '$lib/server/beanconqueror';
import { MAX_UPLOAD_BYTES, parseBeanConquerorJson, readBeanConquerorZip } from '$lib/server/beanConquerorJson';
import { handleCoffeeCreateAndLink } from '$lib/server/coffeeFormActions';
import { queueFillMissing } from '$lib/server/imageFills';
import { linkBeanConquerorBean, getLinkableCoffees, BeanLinkError } from '$lib/server/beanConquerorLinks';
import { buildBacklogStats } from './statsData';
import { buildBeanConquerorStats } from './beanConquerorStatsData';

// Matches the "Showing top N of M" treatment the beanConqueror charts use:
// a real export can have a couple hundred unmatched beans, and rendering
// every one buries the rest of the page.
const UNMATCHED_BEAN_LIMIT = 20;

export const load: PageServerLoad = ({ locals }) => {
  const db = getDb();
  const today = new Date();
  const openRows = getOpenCoffees(db);
  const backlogRows = getBacklogCoffees(db);
  const archivedRows = getArchivedCoffees(db);
  const rates = getStatsRates(db);
  const roastLevels = getRoastLevels(db);
  const stats = buildBacklogStats(openRows, backlogRows, archivedRows, rates, roastLevels, today);
  const lastImportedRow = db
    .prepare(`SELECT value FROM app_meta WHERE key = 'beanconqueror_last_imported_at'`)
    .get() as { value: string } | undefined;
  return {
    stats,
    rates,
    beanConquerorLastImportedAt: lastImportedRow?.value ?? null,
    beanConquerorStats: buildBeanConquerorStats(db),
    unmatchedBeans: {
      beans: getUnmatchedBeanConquerorBeans(db, UNMATCHED_BEAN_LIMIT),
      total: countUnmatchedBeanConquerorBeans(db)
    },
    linkableCoffees: locals.isAdmin ? getLinkableCoffees(db) : [],
    roastLevels,
    roasters: getDistinctFieldValues(db, 'roaster'),
    origins: getDistinctFieldValues(db, 'origin'),
    processingMethods: getDistinctFieldValues(db, 'processing'),
    roasterImages: getRoasterImages(db),
    restHistory: locals.isAdmin ? getFillHistory(db) : []
  };
};

// An .xlsx is a zip too; its workbook part tells them apart.
// ponytail: .xlsx fallback only until the .zip import has run on prod (plan Task 9 removes it).
async function parseUpload(buffer: ArrayBuffer): Promise<ParsedBeanConquerorData> {
  const zip = await JSZip.loadAsync(buffer).catch(() => null);
  if (zip?.file('xl/workbook.xml')) {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);
    return parseBeanConquerorWorkbook(workbook);
  }
  return parseBeanConquerorJson(await readBeanConquerorZip(buffer));
}

export const actions: Actions = {
  updateRates: async ({ request, locals }) => {
    requireAdmin(locals);
    const formData = await request.formData();
    const selfGPerDay = Number(formData.get('selfGPerDay'));
    const householdGPerDay = Number(formData.get('householdGPerDay'));
    try {
      setStatsRates(getDb(), { selfGPerDay, householdGPerDay });
    } catch (err) {
      if (err instanceof InvalidRatesError) {
        return fail(400, { error: 'Both rates must be positive numbers' });
      }
      throw err;
    }
    return { success: true };
  },
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
      parsed = await parseUpload(await file.arrayBuffer());
    } catch (err) {
      return fail(400, { error: err instanceof Error ? err.message : 'Could not parse that Bean Conqueror export' });
    }
    try {
      importBeanConquerorData(getDb(), parsed);
    } catch (err) {
      if (err instanceof BeanConquerorImportError) return fail(400, { error: err.message });
      throw err;
    }
    return {
      success: true as const,
      imported: { beans: parsed.beans.length, brews: parsed.brews.length, waters: parsed.waters?.length ?? 0 }
    };
  },
  create: async ({ request, locals }) => {
    requireAdmin(locals);
    // The Create modal from "Not yet tracked" sends beanconqueror_id: link it too.
    const db = getDb();
    const result = handleCoffeeCreateAndLink(db, await request.formData());
    void queueFillMissing(db); // a new image → its backdrop fill, in the background
    return result;
  },
  linkBeanConqueror: async ({ request, locals }) => {
    requireAdmin(locals);
    const formData = await request.formData();
    const beanId = formData.get('beanId');
    const coffeeId = Number(formData.get('coffeeId'));
    if (typeof beanId !== 'string' || !beanId) {
      return fail(400, { error: 'Missing bean id' });
    }
    if (!Number.isInteger(coffeeId) || coffeeId <= 0) {
      return fail(400, { error: 'Choose a coffee to link' });
    }
    try {
      linkBeanConquerorBean(getDb(), beanId, coffeeId);
    } catch (err) {
      if (err instanceof BeanLinkError) return fail(400, { error: err.message });
      throw err;
    }
    return { success: true as const };
  },
  dismissBeanConqueror: async ({ request, locals }) => {
    requireAdmin(locals);
    const formData = await request.formData();
    const id = formData.get('id');
    if (typeof id !== 'string' || !id) {
      return fail(400, { error: 'Missing bean id' });
    }
    dismissBeanConquerorBean(getDb(), id);
    return { success: true as const };
  }
};
