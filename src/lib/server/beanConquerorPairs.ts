import type { BeanCoffeePair } from './beanConquerorLinks';
import type { CoffeeFix } from './coffees';

// One-time bean-to-coffee reconciliation batches, applied once at boot by applyBeanConquerorPairs
// (an empty list is a no-op). Applied in the owner's DB; emptied for publication.
export const BEAN_CONQUEROR_PAIRS: readonly BeanCoffeePair[] = [];

export const PAIRS_2026_10B_MARKER = 'beanconqueror_pairs_2026_10b_applied';
export const PAIRS_2026_10B: readonly BeanCoffeePair[] = [];
export const FIXES_2026_10B: readonly CoffeeFix[] = [];

export const PAIRS_2026_11_MARKER = 'beanconqueror_pairs_2026_11_applied';
export const PAIRS_2026_11: readonly BeanCoffeePair[] = [];
