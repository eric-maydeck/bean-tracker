import type { Actions, PageServerLoad } from './$types';
import { getDb } from '$lib/server/db';
import {
  getBacklogCoffees,
  getOpenCoffees,
  getArchivedCoffees,
  getDistinctFieldValues,
  openCoffee,
  unopenCoffee,
  freezeCoffee,
  thawCoffee,
  archiveCoffee,
  restoreCoffee,
  deleteCoffee
} from '$lib/server/coffees';
import { getRoastLevels } from '$lib/server/roastLevels';
import { withComputedFields } from '$lib/server/urgency';
import { requireAdmin } from '$lib/server/auth';
import { handleCoffeeCreate, handleCoffeeSave } from '$lib/server/coffeeFormActions';

export const load: PageServerLoad = () => {
  const db = getDb();
  const today = new Date();
  const backlog = getBacklogCoffees(db).map((c) => withComputedFields(c, today));
  const open = getOpenCoffees(db).map((c) => withComputedFields(c, today));
  const archive = getArchivedCoffees(db).map((c) => withComputedFields(c, today));
  const roastLevels = getRoastLevels(db);
  return {
    backlog,
    open,
    archive,
    roastLevels,
    roasters: getDistinctFieldValues(db, 'roaster'),
    origins: getDistinctFieldValues(db, 'origin'),
    processingMethods: getDistinctFieldValues(db, 'processing')
  };
};

export const actions: Actions = {
  create: async ({ request, locals }) => {
    requireAdmin(locals);
    return handleCoffeeCreate(getDb(), await request.formData());
  },
  save: async ({ request, locals }) => {
    requireAdmin(locals);
    return handleCoffeeSave(getDb(), await request.formData());
  },
  delete: async ({ request, locals }) => {
    requireAdmin(locals);
    const formData = await request.formData();
    deleteCoffee(getDb(), Number(formData.get('id')));
    return { success: true };
  },
  open: async ({ request, locals }) => {
    requireAdmin(locals);
    const formData = await request.formData();
    openCoffee(getDb(), Number(formData.get('id')));
    return { success: true };
  },
  unopen: async ({ request, locals }) => {
    requireAdmin(locals);
    const formData = await request.formData();
    unopenCoffee(getDb(), Number(formData.get('id')));
    return { success: true };
  },
  freeze: async ({ request, locals }) => {
    requireAdmin(locals);
    const formData = await request.formData();
    freezeCoffee(getDb(), Number(formData.get('id')));
    return { success: true };
  },
  thaw: async ({ request, locals }) => {
    requireAdmin(locals);
    const formData = await request.formData();
    thawCoffee(getDb(), Number(formData.get('id')));
    return { success: true };
  },
  archive: async ({ request, locals }) => {
    requireAdmin(locals);
    const formData = await request.formData();
    archiveCoffee(getDb(), Number(formData.get('id')));
    return { success: true };
  },
  restore: async ({ request, locals }) => {
    requireAdmin(locals);
    const formData = await request.formData();
    restoreCoffee(getDb(), Number(formData.get('id')));
    return { success: true };
  }
};
