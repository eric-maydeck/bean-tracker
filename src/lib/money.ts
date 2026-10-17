// Every price, spend and cost on the site, in one format, never more than 2 decimals on screen (user, 2026-10-17):
// under $1,000 to 2 decimals ("$0.05", "$16.00", "$999.50"; unit costs and prices); $1,000 and up to whole dollars
// ("$6,519"; big totals, so a tile's figure doesn't shrink its font). Thousands grouped. One format per set (a column,
// chart or list): when any amount in it is whole-dollar, all are (`wholeUsd`, passed as `whole`), as one chart keeps
// one decimal count. The exact amount is in the Usd component's tip. Per-unit labels ("/g", "/100 g", "a cup") are
// added by the caller.
const USD = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 });
const USD0 = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 });
export const isWholeUsd = (n: number): boolean => Math.abs(Math.round(n * 100)) >= 100_000;
// A set's format: whole dollars when any of its amounts is $1,000 or more.
export const wholeUsd = (ns: readonly (number | null | undefined)[]): boolean => ns.some((n) => n != null && isWholeUsd(n));
export const usd = (n: number, whole = isWholeUsd(n)): string => (whole ? USD0 : USD).format(n);
// The amount before usd rounded it, when that changed it, else null: to the cent when shown whole ("$6,518.72"), else
// to at most 4 decimals, trailing zeros trimmed ("$0.0472"). The Usd component's tip (user, 2026-10-17: "$0.05/g" hid
// that it was $0.0472).
const USD4 = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 4 });
export const usdPrecise = (n: number, whole = isWholeUsd(n)): string | null => {
  if (whole) return Math.round(n * 100) === Math.round(n) * 100 ? null : USD.format(n); // the cents add nothing
  return Math.abs(Math.round(n * 100) / 100 - n) < 0.00005 ? null : USD4.format(n);
};
