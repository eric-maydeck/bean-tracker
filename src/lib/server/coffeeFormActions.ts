import type { DatabaseSync } from 'node:sqlite';
import { fail } from '@sveltejs/kit';
import { createCoffee } from './coffees';
import { setRoasterImage } from './roasterImages';
import { parseCoffeeForm, CoffeeFormError } from './coffeeFormValidation';
import { linkBeanConquerorBean, BeanLinkError } from './beanConquerorLinks';

// Sync on purpose: handleCoffeeCreateAndLink runs it inside a transaction,
// and an await there would let another request interleave. A SAVEPOINT (not
// BEGIN) so it nests inside that transaction: the roaster default and the
// coffee land together or not at all.
export function handleCoffeeCreate(db: DatabaseSync, formData: FormData) {
  try {
    const input = parseCoffeeForm(formData);
    db.exec('SAVEPOINT coffee_create');
    try {
      // Before createCoffee, so its dedupe sees the new default and the coffee inherits it.
      if (input.set_roaster_default) setRoasterImage(db, input.roaster, input.image_url!);
      const { id, slug } = createCoffee(db, input);
      db.exec('RELEASE coffee_create');
      return { success: true as const, id, slug };
    } catch (err) {
      db.exec('ROLLBACK TO coffee_create');
      db.exec('RELEASE coffee_create');
      throw err;
    }
  } catch (err) {
    if (err instanceof CoffeeFormError) {
      return fail(400, { error: err.message });
    }
    throw err;
  }
}

// Stats → Not yet tracked → Create: the coffee and its bean link land together or not at all.
export function handleCoffeeCreateAndLink(db: DatabaseSync, formData: FormData) {
  const beanId = formData.get('beanconqueror_id');
  if (typeof beanId !== 'string' || !beanId) return handleCoffeeCreate(db, formData);
  db.exec('BEGIN');
  try {
    const result = handleCoffeeCreate(db, formData);
    if (!('id' in result)) {
      db.exec('ROLLBACK');
      return result;
    }
    linkBeanConquerorBean(db, beanId, result.id);
    db.exec('COMMIT');
    return result;
  } catch (err) {
    db.exec('ROLLBACK');
    if (err instanceof BeanLinkError) return fail(400, { error: `Coffee not created: ${err.message}` });
    throw err;
  }
}
