import type { DatabaseSync } from 'node:sqlite';
import { fail } from '@sveltejs/kit';
import { createCoffee, updateCoffee } from './coffees';
import { parseCoffeeForm, parseSlugField, CoffeeFormError } from './coffeeFormValidation';
import { slugify, slugExists } from './slug';

export async function handleCoffeeCreate(db: DatabaseSync, formData: FormData) {
  try {
    const input = parseCoffeeForm(formData);
    createCoffee(db, input);
    return { success: true as const };
  } catch (err) {
    if (err instanceof CoffeeFormError) {
      return fail(400, { error: err.message });
    }
    throw err;
  }
}

export async function handleCoffeeSave(db: DatabaseSync, formData: FormData) {
  const id = Number(formData.get('id'));
  try {
    const input = parseCoffeeForm(formData);
    const rawSlug = parseSlugField(formData);
    if (!rawSlug) {
      return fail(400, { error: 'URL slug is required' });
    }
    const slug = slugify(rawSlug);
    if (!slug) {
      return fail(400, { error: 'URL slug must contain at least one letter or number' });
    }
    if (slugExists(db, slug, id)) {
      return fail(400, { error: 'That URL is already in use by another coffee' });
    }
    updateCoffee(db, id, input, slug);
    return { success: true as const, slug };
  } catch (err) {
    if (err instanceof CoffeeFormError) {
      return fail(400, { error: err.message });
    }
    throw err;
  }
}
