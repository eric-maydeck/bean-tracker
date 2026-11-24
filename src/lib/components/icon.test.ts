import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// The sort buttons show 'sort-ascending' for ascending and 'sort-descending' for descending: the arrow must agree.
describe('sort icons', () => {
  const src = readFileSync(new URL('./Icon.svelte', import.meta.url), 'utf8');
  const path = (name: string) => new RegExp(`'${name}': '([^']+)'`).exec(src)![1];
  it('ascending draws an up arrow (head at the top), descending a down arrow (head at the bottom)', () => {
    expect(path('sort-ascending')).toContain('M229.66,82.34'); // arrowhead tip near the top of the 256 box
    expect(path('sort-descending')).toContain('229.66,162.34'); // arrowhead tip near the bottom
  });
});
