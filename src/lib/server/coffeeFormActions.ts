import type { DatabaseSync } from 'node:sqlite';
import { fail } from '@sveltejs/kit';
import { createCoffee } from './coffees';
import { parseCoffeeForm, CoffeeFormError } from './coffeeFormValidation';

export async function handleCoffeeCreate(db: DatabaseSync, formData: FormData) {
  try {
    const input = parseCoffeeForm(formData);
    const { slug } = createCoffee(db, input);
    return { success: true as const, slug };
  } catch (err) {
    if (err instanceof CoffeeFormError) {
      return fail(400, { error: err.message });
    }
    throw err;
  }
}
