import { describe, it, expect } from 'vitest';
import { posterSpans } from './recapsPoster';

describe('posterSpans', () => {
  it('every row closes exactly, for any tile count, wide pattern and column count', () => {
    for (const cols of [1, 2, 3]) for (let n = 1; n <= 16; n++) for (let seed = 0; seed < 8; seed++) {
      const tiles = Array.from({ length: n }, (_, i) => ({ id: i === n - 1 ? 'you' : `t${i}`, wide: ((i * 5 + seed) % 3) === 0 }));
      const spans = posterSpans(tiles, cols);
      expect(spans.length).toBe(n);
      let pos = 0;
      for (const s of spans) {
        expect(s).toBeGreaterThanOrEqual(1);
        expect(pos + s, `${cols} cols, ${n} tiles, seed ${seed}`).toBeLessThanOrEqual(cols);
        pos = (pos + s) % cols;
      }
      expect(pos, 'last row closed').toBe(0);
      expect(spans.at(-1)).toBe(cols); // you: a full row
    }
  });
});
