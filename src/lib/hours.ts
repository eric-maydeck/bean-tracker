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
