// Bean Base reconcile batches (private/scripts/bean-base-reconcile.ts + backfill-review.py fields-export).
// Each is applied once at boot under its own marker (applyCoffeeFixes, coffees.ts). Data only, generated:
// never type or edit a `from` by hand. The file must end with the `];` line.
import type { CoffeeFixBatch } from './coffees';

export const BEAN_BASE_BACKFILLS: CoffeeFixBatch[] = [
];
