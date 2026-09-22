import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { getDb, getStatsRates, setStatsRates } from '$lib/server/db';
import { getBacklogCoffees, getOpenCoffees } from '$lib/server/coffees';
import { getRoastLevels } from '$lib/server/roastLevels';
import { requireAdmin } from '$lib/server/auth';
import { buildBacklogStats } from './statsData';

export const load: PageServerLoad = () => {
  const db = getDb();
  const today = new Date();
  const openRows = getOpenCoffees(db);
  const backlogRows = getBacklogCoffees(db);
  const rates = getStatsRates(db);
  const roastLevels = getRoastLevels(db);
  const stats = buildBacklogStats(openRows, backlogRows, rates, roastLevels, today);
  return { stats, rates };
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
  }
};
