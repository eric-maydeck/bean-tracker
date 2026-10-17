import { expect, it } from 'vitest';
import { usd, usdPrecise } from './money';

it('usd: always 2 decimals, thousands grouped', () => {
  expect([usd(0.047), usd(1234.5), usd(16), usd(0)]).toEqual(['$0.05', '$1,234.50', '$16.00', '$0.00']);
});

it('usdPrecise: up to 4 decimals, trailing zeros trimmed, only when usd rounded something away', () => {
  expect([usdPrecise(0.0472), usdPrecise(0.047), usdPrecise(16.666666), usdPrecise(0.04723456)]).toEqual(['$0.0472', '$0.047', '$16.6667', '$0.0472']);
  expect([usdPrecise(16), usdPrecise(1234.5), usdPrecise(0.05), usdPrecise(0.05000001)]).toEqual([null, null, null, null]);
});
