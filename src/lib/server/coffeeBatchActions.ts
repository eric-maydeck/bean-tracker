import type { DatabaseSync } from 'node:sqlite';
import type { CoffeeRow } from '../types';
import {
  getCoffeeById,
  updateCoffee,
  openCoffee,
  unopenCoffee,
  freezeCoffee,
  thawCoffee,
  archiveCoffee,
  unarchiveCoffee,
  deleteCoffee,
  type NewCoffeeInput
} from './coffees';
import { parseCoffeeForm, parseSlugField, CoffeeFormError } from './coffeeFormValidation';
import { setRoasterImage } from './roasterImages';
import { setRoasterWebsite } from './roasterWebsites';
import { slugify, slugExists, generateBaseSlug, uniqueSlug, isAutoSlug } from './slug';

export type CoffeeStatusAction = 'open' | 'unopen' | 'freeze' | 'thaw' | 'archive' | 'unarchive' | 'delete';

export interface CoffeeBatchChange {
  id: number;
  fields?: Record<string, string>;
  statusAction?: CoffeeStatusAction;
}

export interface BatchFieldError {
  id: number;
  error: string;
}

function toFormData(fields: Record<string, string>): FormData {
  const formData = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    formData.set(key, value);
  }
  return formData;
}

// Validates every pending field-edit in the batch (reusing the exact same
// validation the real save path runs) without writing anything to the
// database. Status actions have no meaningful validation beyond admin
// auth, already enforced by the caller before this function is reached —
// entries with only a statusAction are skipped here.
export function validateCoffeeBatch(db: DatabaseSync, changes: CoffeeBatchChange[]): BatchFieldError[] {
  const errors: BatchFieldError[] = [];
  const slugsById = new Map<number, string>();
  for (const change of changes) {
    if (!change.fields) continue;
    const formData = toFormData(change.fields);
    try {
      parseCoffeeForm(formData);
    } catch (err) {
      if (err instanceof CoffeeFormError) {
        errors.push({ id: change.id, error: err.message });
        continue;
      }
      throw err;
    }
    const rawSlug = parseSlugField(formData);
    if (!rawSlug) {
      errors.push({ id: change.id, error: 'URL slug is required' });
      continue;
    }
    const slug = slugify(rawSlug);
    if (!slug) {
      errors.push({ id: change.id, error: 'URL slug must contain at least one letter or number' });
      continue;
    }
    if (slugExists(db, slug, change.id)) {
      errors.push({ id: change.id, error: 'That URL is already in use by another coffee' });
      continue;
    }
    slugsById.set(change.id, slug);
  }
  // slugExists above only checks each slug against the DB individually, so
  // two entries in the same batch both staging an identical brand-new slug
  // each pass it on their own. Catch that case here, across the batch.
  const idsBySlug = new Map<string, number[]>();
  for (const [id, slug] of slugsById) {
    const ids = idsBySlug.get(slug) ?? [];
    ids.push(id);
    idsBySlug.set(slug, ids);
  }
  for (const ids of idsBySlug.values()) {
    if (ids.length > 1) {
      for (const id of ids) {
        errors.push({ id, error: 'That URL is used by another coffee in this same batch' });
      }
    }
  }
  return errors;
}

// The URL follows the coffee's identity: when a roaster / name / roast-year
// edit changes the base slug, the user didn't type their own slug in this
// save, AND the coffee's current slug is itself auto-generated (not a slug
// the user set earlier), regenerate it (updateCoffee keeps the old one as a
// redirect). A custom slug is never overwritten. Cosmetic edits that slugify
// the same (case, punctuation) keep the slug.
// ponytail: a regenerated slug and another batch entry's typed slug can
// collide; the unique index then rolls the whole batch back with an error.
function nextSlug(db: DatabaseSync, before: CoffeeRow, input: NewCoffeeInput, staged: string): string {
  if (staged !== before.slug) return staged;
  const base = (c: { roaster: string; coffee_name: string; roast_date: string | null }) =>
    generateBaseSlug({ roaster: c.roaster, coffeeName: c.coffee_name, roastDate: c.roast_date, createdAt: before.created_at });
  const oldBase = base(before);
  const next = base(input);
  if (next === oldBase) return staged;
  if (!isAutoSlug(before.slug, oldBase)) return staged;
  return uniqueSlug(db, next, before.id);
}

// Applies every pending change in one transaction: all or nothing. Assumes
// the batch has already been validated (validateCoffeeBatch) — a thrown
// error here (a genuinely nonexistent id, a real DB error) rolls back
// everything in the batch, not just the failing entry. Returns the final
// slug of each field-edited coffee (it may have been regenerated).
export function commitCoffeeBatch(db: DatabaseSync, changes: CoffeeBatchChange[]): Record<number, string> {
  const slugs: Record<number, string> = {};
  db.exec('BEGIN');
  try {
    for (const change of changes) {
      const before = getCoffeeById(db, change.id);
      if (!before) {
        throw new Error(`Coffee ${change.id} does not exist`);
      }
      if (change.fields) {
        const formData = toFormData(change.fields);
        const input = parseCoffeeForm(formData);
        // Before updateCoffee, so its dedupe sees the new default (input.roaster is the
        // roaster typed in this save). Inside the batch's BEGIN: rolls back with it.
        if (input.set_roaster_default) setRoasterImage(db, input.roaster, input.image_url!);
        if (input.roaster_website) setRoasterWebsite(db, input.roaster, input.roaster_website);
        const rawSlug = parseSlugField(formData);
        if (!rawSlug) throw new Error(`Missing slug for coffee ${change.id}`);
        const slug = nextSlug(db, before, input, slugify(rawSlug));
        updateCoffee(db, change.id, input, slug);
        slugs[change.id] = slug;
      }
      if (change.statusAction) {
        applyStatusAction(db, change.id, change.statusAction);
      }
    }
    db.exec('COMMIT');
    return slugs;
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

// Each of these WHERE-guarded UPDATEs (openCoffee, freezeCoffee, etc.) is
// a no-op — not a throw — if the row doesn't exist or isn't in the
// expected starting status. This wrapper only checks that the row exists
// BEFORE calling the status function, giving commitCoffeeBatch something
// real to catch and roll back on for a genuinely nonexistent id. It does
// NOT verify that the underlying UPDATE actually changed anything — an
// invalid state transition on an existing row (e.g. `thaw` on a coffee
// that isn't frozen) remains a silent no-op that still reports success.
// That's a known, pre-existing limitation, not something fixed here.
function applyStatusAction(db: DatabaseSync, id: number, action: CoffeeStatusAction): void {
  const before = db.prepare(`SELECT id FROM coffees WHERE id = ?`).get(id);
  if (!before) {
    throw new Error(`Coffee ${id} does not exist`);
  }
  switch (action) {
    case 'open':
      openCoffee(db, id);
      break;
    case 'unopen':
      unopenCoffee(db, id);
      break;
    case 'freeze':
      freezeCoffee(db, id);
      break;
    case 'thaw':
      thawCoffee(db, id);
      break;
    case 'archive':
      archiveCoffee(db, id);
      break;
    case 'unarchive':
      unarchiveCoffee(db, id);
      break;
    case 'delete':
      deleteCoffee(db, id);
      break;
    default:
      throw new Error(`Unknown status action: ${action}`);
  }
}
