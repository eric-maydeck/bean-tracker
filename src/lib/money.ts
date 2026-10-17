// Every price, spend and cost on the site, in one format: US dollars to 2 decimals, thousands grouped
// ("$1,234.50", "$0.05"). Per-unit labels ("/g", "/100 g", "a cup") are added by the caller (user, 2026-10-17).
const USD = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const usd = (n: number): string => USD.format(n);
// The same amount to at most 4 decimals, trailing zeros trimmed ("$0.0472"), when that differs from usd's; else null.
// The Usd component's tip (user, 2026-10-17: "$0.05/g" hid that it was $0.0472).
const USD4 = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 4 });
export const usdPrecise = (n: number): string | null => (USD4.format(n) === USD.format(n) ? null : USD4.format(n));
