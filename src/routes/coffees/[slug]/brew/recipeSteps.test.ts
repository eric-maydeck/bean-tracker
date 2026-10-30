import { describe, it, expect } from 'vitest';
import { recipeSteps } from './recipeSteps';

describe('recipeSteps', () => {
  it('splits numbered steps', () => expect(recipeSteps('Brew guide 1. Rinse the filter. 2. Add 18g. 3. Pour 50g.')).toEqual(['Brew guide', 'Rinse the filter.', 'Add 18g.', 'Pour 50g.']));
  it('splits sentences when there are three or more', () => expect(recipeSteps('Use 18g. Bloom for 30s. Pour to 300g.')).toEqual(['Use 18g.', 'Bloom for 30s.', 'Pour to 300g.']));
  it('leaves a short snippet as a paragraph', () => expect(recipeSteps('Use 18g of coffee. Pour slowly.')).toBeNull());
});
