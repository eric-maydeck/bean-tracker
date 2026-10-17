// Every price, spend and cost on the site, in one format, never more than 2 decimals on screen (user, 2026-10-17):
// under $1,000 to 2 decimals ("$0.05", "$16.00", "$999.50"; unit costs and prices); $1,000 and up to whole dollars
// ("$6,519"; big totals, so a tile's figure doesn't shrink its font). Thousands grouped. The exact amount is in the
// Usd component's tip. Per-unit labels ("/g", "/100 g", "a cup") are added by the caller.
const USD = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 });
const USD0 = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 });
export const isWholeUsd = (n: number): boolean => Math.abs(Math.round(n * 100)) >= 100_000;
export const usd = (n: number): string => (isWholeUsd(n) ? USD0 : USD).format(n);
// The amount before usd rounded it, when that changed it, else null: to the cent from $1,000 ("$6,518.72"), else to at
// most 4 decimals, trailing zeros trimmed ("$0.0472"). The Usd component's tip (user, 2026-10-17: "$0.05/g" hid that
// it was $0.0472).
const USD4 = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 4 });
export const usdPrecise = (n: number): string | null => {
  const whole = isWholeUsd(n);
  if (Math.abs((whole ? Math.round(n) : Math.round(n * 100) / 100) - n) < 0.00005) return null;
  return (whole ? USD : USD4).format(n);
};
