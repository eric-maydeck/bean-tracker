import { expect, it } from 'vitest';
import { usd } from './money';

it('usd: always 2 decimals, thousands grouped', () => {
  expect([usd(0.047), usd(1234.5), usd(16), usd(0)]).toEqual(['$0.05', '$1,234.50', '$16.00', '$0.00']);
});
