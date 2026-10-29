import { describe, it, expect } from 'vitest';
import { recipeSteps } from './recipeSteps';

describe('recipeSteps', () => {
  it('splits numbered steps', () => expect(recipeSteps('Brew guide 1. Rinse the filter. 2. Add 18 g. 3. Pour 50 g.')).toEqual(['Brew guide', 'Rinse the filter.', 'Add 18 g.', 'Pour 50 g.']));
  it('splits sentences when there are three or more', () => expect(recipeSteps('Use 18 g. Bloom for 30 s. Pour to 300 g.')).toEqual(['Use 18 g.', 'Bloom for 30 s.', 'Pour to 300 g.']));
  it('leaves a short snippet as a paragraph', () => expect(recipeSteps('Use 18 g of coffee. Pour slowly.')).toBeNull());
});
