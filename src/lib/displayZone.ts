// The zone for clock times shown to a reader (updated, uploaded, deployed); day and hour stats lines
// use the brewing zone instead. Client-safe.
// Any zone Intl accepts (aliases like Asia/Kolkata, Europe/Kyiv, Etc/UTC included); canonicalZone gives its canonical name.
export function canonicalZone(z: string): string | null {
  try {
    const c = new Intl.DateTimeFormat('en', { timeZone: z }).resolvedOptions().timeZone;
    return /^[+-]/.test(c) ? null : c; // not a fixed offset like +09:00
  } catch { return null; }
}

// Signed out, or "browser" (the setting's default): the `tz` cookie the browser wrote, UTC on a first visit
// (the page re-renders in the browser's zone after mount). The cookie is untrusted: a bad one is UTC.
export function resolveDisplayZone(o: { signedIn: boolean; setting: string; cookie: string | null }): { zone: string; browser: boolean } {
  const fixed = o.signedIn && o.setting !== 'browser' ? canonicalZone(o.setting) : null;
  if (fixed) return { zone: fixed, browser: false };
  return { zone: (o.cookie && canonicalZone(o.cookie)) || 'UTC', browser: true };
}
