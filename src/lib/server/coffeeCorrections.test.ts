import { describe, it, expect } from 'vitest';
import { COFFEE_CORRECTIONS } from './coffeeCorrections';
import { formatOriginField } from '$lib/originFormat';

const batch = (m: string) => COFFEE_CORRECTIONS.find((b) => b.marker === m)!;

describe('coffee_corrections_2026_11_a', () => {
  it('every row has a roaster guard and a `to` the formatter keeps', () => {
    for (const f of batch('coffee_corrections_2026_11_a').fixes) {
      expect(f.roaster).toBeTruthy();
      expect(formatOriginField(f.field, String(f.to))).toBe(f.to);
    }
  });
  it('variety rows are exactly what the new formatter makes of `from`', () => {
    for (const f of batch('coffee_corrections_2026_11_a').fixes.filter((f) => f.field === 'variety'))
      expect(formatOriginField('variety', String(f.from))).toBe(f.to);
  });
});
