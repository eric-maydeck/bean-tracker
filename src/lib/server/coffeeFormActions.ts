import type { DatabaseSync } from 'node:sqlite';
import { fail } from '@sveltejs/kit';
import { createCoffee } from './coffees';
import { parseCoffeeForm, CoffeeFormError } from './coffeeFormValidation';
import { linkBeanConquerorBean, BeanLinkError } from './beanConquerorLinks';

// Sync on purpose: handleCoffeeCreateAndLink runs it inside a transaction,
// and an await there would let another request interleave.
export function handleCoffeeCreate(db: DatabaseSync, formData: FormData) {
  try {
    const input = parseCoffeeForm(formData);
    const { id, slug } = createCoffee(db, input);
    return { success: true as const, id, slug };
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
