import { fail } from '@sveltejs/kit';
import ExcelJS from 'exceljs';
import type { Actions, PageServerLoad } from './$types';
import { getDb, getStatsRates, setStatsRates, InvalidRatesError } from '$lib/server/db';
import { getArchivedCoffees, getBacklogCoffees, getDistinctFieldValues, getOpenCoffees } from '$lib/server/coffees';
import { getRoastLevels } from '$lib/server/roastLevels';
import { requireAdmin } from '$lib/server/auth';
import {
  parseBeanConquerorWorkbook,
  importBeanConquerorData,
  getUnmatchedBeanConquerorBeans,
  countUnmatchedBeanConquerorBeans,
  dismissBeanConquerorBean
} from '$lib/server/beanconqueror';
import { handleCoffeeCreate } from '$lib/server/coffeeFormActions';
import { buildBacklogStats } from './statsData';
import { buildBeanConquerorStats } from './beanConquerorStatsData';

// Matches the "Showing top N of M" treatment the beanConqueror charts use:
// a real export can have a couple hundred unmatched beans, and rendering
// every one buries the rest of the page.
const UNMATCHED_BEAN_LIMIT = 20;

export const load: PageServerLoad = () => {
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
    roastLevels,
    roasters: getDistinctFieldValues(db, 'roaster'),
    origins: getDistinctFieldValues(db, 'origin'),
    processingMethods: getDistinctFieldValues(db, 'processing')
  };
};

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
    const buffer = await file.arrayBuffer();
    const workbook = new ExcelJS.Workbook();
    try {
      await workbook.xlsx.load(buffer);
    } catch {
      return fail(400, { error: 'Could not read that file as an Excel workbook' });
    }
    // Separate try/catch from the load above: parsing throws a specific,
    // admin-readable message when the export's column layout no longer
    // matches what the positional parsers expect, and that has to surface
    // as a clean 400 rather than an unhandled 500.
    let parsed;
    try {
      parsed = parseBeanConquerorWorkbook(workbook);
    } catch (err) {
      return fail(400, { error: err instanceof Error ? err.message : 'Could not parse that Bean Conqueror export' });
    }
    importBeanConquerorData(getDb(), parsed);
    return { success: true as const };
  },
  create: async ({ request, locals }) => {
    requireAdmin(locals);
    return handleCoffeeCreate(getDb(), await request.formData());
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
