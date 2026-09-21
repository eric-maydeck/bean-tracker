import type { DatabaseSync } from 'node:sqlite';
import {
  updateCoffee,
  openCoffee,
  unopenCoffee,
  freezeCoffee,
  thawCoffee,
  archiveCoffee,
  restoreCoffee,
  deleteCoffee
} from './coffees';
import { parseCoffeeForm, parseSlugField, CoffeeFormError } from './coffeeFormValidation';
import { slugify, slugExists } from './slug';

export type CoffeeStatusAction = 'open' | 'unopen' | 'freeze' | 'thaw' | 'archive' | 'restore' | 'delete';

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
    }
  }
  return errors;
}

// Applies every pending change in one transaction: all or nothing. Assumes
// the batch has already been validated (validateCoffeeBatch) — a thrown
// error here (a genuinely nonexistent id, a real DB error) rolls back
// everything in the batch, not just the failing entry.
export function commitCoffeeBatch(db: DatabaseSync, changes: CoffeeBatchChange[]): void {
  db.exec('BEGIN');
  try {
    for (const change of changes) {
      // Verify the coffee exists before attempting any updates
      const before = db.prepare(`SELECT id FROM coffees WHERE id = ?`).get(change.id);
      if (!before) {
        throw new Error(`Coffee ${change.id} does not exist`);
      }
      if (change.fields) {
        const formData = toFormData(change.fields);
        const input = parseCoffeeForm(formData);
        const rawSlug = parseSlugField(formData);
        if (!rawSlug) throw new Error(`Missing slug for coffee ${change.id}`);
        const slug = slugify(rawSlug);
        updateCoffee(db, change.id, input, slug);
      }
      if (change.statusAction) {
        applyStatusAction(db, change.id, change.statusAction);
      }
    }
    db.exec('COMMIT');
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
    case 'restore':
      restoreCoffee(db, id);
      break;
    case 'delete':
      deleteCoffee(db, id);
      break;
    default:
      throw new Error(`Unknown status action: ${action}`);
  }
}
