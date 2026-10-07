// Product page + image backfill batches (spec
// docs/superpowers/specs/2026-10-07-product-page-backfill-design.md §4). Each
// is applied once at boot under its own marker (applyCoffeeFixes, coffees.ts).
// Data only, appended by `python3 -I scripts/backfill-review.py export`: never
// type or edit a URL here by hand. The file must end with the `];` line.
import type { CoffeeFixBatch } from './coffees';

export const PRODUCT_PAGE_BACKFILLS: CoffeeFixBatch[] = [
];
