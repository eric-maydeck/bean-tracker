import { fail } from '@sveltejs/kit';
import ExcelJS from 'exceljs';
import type { Actions, PageServerLoad } from './$types';
import { getDb, getStatsRates, setStatsRates } from '$lib/server/db';
import { getArchivedCoffees, getBacklogCoffees, getOpenCoffees } from '$lib/server/coffees';
import { getRoastLevels } from '$lib/server/roastLevels';
import { requireAdmin } from '$lib/server/auth';
import { parseBeanConquerorWorkbook, importBeanConquerorData } from '$lib/server/beanconqueror';
import { buildBacklogStats } from './statsData';

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
  return { stats, rates, beanConquerorLastImportedAt: lastImportedRow?.value ?? null };
};

export const actions: Actions = {
  updateRates: async ({ request, locals }) => {
    requireAdmin(locals);
    const formData = await request.formData();
    const selfGPerDay = Number(formData.get('selfGPerDay'));
    const householdGPerDay = Number(formData.get('householdGPerDay'));
    try {
      setStatsRates(getDb(), { selfGPerDay, householdGPerDay });
    } catch {
      return fail(400, { error: 'Both rates must be positive numbers' });
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
    const parsed = parseBeanConquerorWorkbook(workbook);
    importBeanConquerorData(getDb(), parsed);
    return { success: true as const };
  }
};
