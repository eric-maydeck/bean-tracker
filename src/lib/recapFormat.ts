// Recap copy formats: digits, thousands commas, unspaced units.
export { usd } from './money';
export const fmtInt = (n: number): string => Math.round(n).toLocaleString('en-US');
export const fmtKg = (g: number): string => `${(g / 1000).toFixed(1)}kg`; // one forced decimal: 4.0kg
export const fmtLitres = (ml: number): string => `${fmtInt(ml / 1000)}L`;
