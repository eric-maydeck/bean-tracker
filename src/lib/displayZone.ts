// The zone for clock times shown to a reader (updated, uploaded, deployed); day and hour stats lines
// use the brewing zone instead. Client-safe.
export const isTimeZone = (z: string): boolean => z === 'UTC' || Intl.supportedValuesOf('timeZone').includes(z);

// Signed out, or "browser" (the setting's default): the `tz` cookie the browser wrote, UTC on a first visit
// (the page re-renders in the browser's zone after mount). The cookie is untrusted: a bad one is UTC.
export function resolveDisplayZone(o: { signedIn: boolean; setting: string; cookie: string | null }): { zone: string; browser: boolean } {
  if (o.signedIn && o.setting !== 'browser' && isTimeZone(o.setting)) return { zone: o.setting, browser: false };
  return { zone: o.cookie && isTimeZone(o.cookie) ? o.cookie : 'UTC', browser: true };
}
