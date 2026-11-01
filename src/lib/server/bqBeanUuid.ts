import { createHash } from 'node:crypto';

// The uuid a bean created for this coffee carries (the BQ patch writes it), so
// an import can tell two identical bags apart. sha1, version 5 and RFC variant bits.
export function coffeeBeanUuid(coffeeId: number): string {
  const b = createHash('sha1').update(`bean-tracker-coffee:${coffeeId}`).digest().subarray(0, 16);
  b[6] = (b[6] & 0x0f) | 0x50;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = b.toString('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}
