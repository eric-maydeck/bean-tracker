// 12-hour clock for an hour of day (0–23): "6a"/"6p" on tight axes, "6 AM"/"6 PM" elsewhere.
export function hour12(h: number, tight = false): string {
  const n = h % 12 || 12;
  const pm = h >= 12;
  return tight ? `${n}${pm ? 'p' : 'a'}` : `${n} ${pm ? 'PM' : 'AM'}`;
}
