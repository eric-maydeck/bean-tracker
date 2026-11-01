// Bean data backfill batches (docs/bean-data-contract.md). Each is applied once at boot under its
// own marker (applyCoffeeFixes, coffees.ts). Data only, appended by
// `python3 -I scripts/backfill-review.py fields-export`: never type or edit a `from` by hand.
// The file must end with the `];` line.
import type { CoffeeFixBatch } from './coffees';

export const BEAN_DATA_BACKFILLS: CoffeeFixBatch[] = [
];
