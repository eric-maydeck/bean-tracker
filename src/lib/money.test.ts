import { expect, it } from 'vitest';
import { usd, usdPrecise, wholeUsd } from './money';

it('usd: 2 decimals under $1,000, whole dollars from $1,000, thousands grouped', () => {
  expect([usd(0.047), usd(16), usd(0), usd(999.5), usd(999.994)]).toEqual(['$0.05', '$16.00', '$0.00', '$999.50', '$999.99']);
  expect([usd(999.996), usd(1234.5), usd(6518.72), usd(1000)]).toEqual(['$1,000', '$1,235', '$6,519', '$1,000']);
});

it('usdPrecise: up to 4 decimals, trailing zeros trimmed, only when usd rounded something away', () => {
  expect([usdPrecise(0.0472), usdPrecise(0.047), usdPrecise(16.666666), usdPrecise(0.04723456)]).toEqual(['$0.0472', '$0.047', '$16.6667', '$0.0472']);
  expect([usdPrecise(16), usdPrecise(0.05), usdPrecise(0.05000001), usdPrecise(1000), usdPrecise(1234)]).toEqual([null, null, null, null, null]);
  expect([usdPrecise(6518.72), usdPrecise(1234.5), usdPrecise(6518.7234)]).toEqual(['$6,518.72', '$1,234.50', '$6,518.72']);
});

it('usdPrecise: no tip when the cents add nothing above the threshold', () => {
  expect([usdPrecise(1234.004), usdPrecise(999.996)]).toEqual([null, null]);
});

it('one format per set: any amount from $1,000 makes the set whole dollars, cents in the tip', () => {
  expect([wholeUsd([987.5, 1234.5]), wholeUsd([987.5, 12, null]), wholeUsd([])]).toEqual([true, false, false]);
  expect([usd(987.5, true), usdPrecise(987.5, true), usd(988, true), usdPrecise(988, true)]).toEqual(['$988', '$987.50', '$988', null]);
  expect([usd(1234.5, false), usdPrecise(1234.5, false)]).toEqual(['$1,234.50', null]);
});
