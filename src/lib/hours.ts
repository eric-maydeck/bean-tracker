// 12-hour clock for an hour of day (0–23): "6a"/"6p" on tight axes, "6 AM"/"6 PM" elsewhere.
export function hour12(h: number, tight = false): string {
  const n = h % 12 || 12;
  const pm = h >= 12;
  return tight ? `${n}${pm ? 'p' : 'a'}` : `${n} ${pm ? 'PM' : 'AM'}`;
}

// 12-hour clock for minutes after midnight: "6:05 AM".
export function clock12(min: number): string {
  const m = Math.round(min) % 1440;
  return hour12(Math.floor(m / 60)).replace(' ', `:${String(m % 60).padStart(2, '0')} `);
}

// A span of days: "12 days", "1 day"; a year or more in years ("1.4 years", "23 years"),
// since thousands of days don't fit a phone tile (a slow coffee's time to clear).
export function formatDays(n: number): string {
  const d = Math.round(n);
  if (d < 365) return `${d.toLocaleString('en-US')} ${d === 1 ? 'day' : 'days'}`;
  const y = n / 365;
  const t = y < 10 ? String(+y.toFixed(1)) : Math.round(y).toLocaleString('en-US');
  return `${t} ${t === '1' ? 'year' : 'years'}`;
}
