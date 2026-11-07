// test:ui run profiles.
// Worker counts are from the measured sweep.
export const PROFILES = {
  // Max speed: user away, or tests are the only thing the laptop is doing.
  performance: { workers: 9, nice: 0, background: false },
  // Default: as fast as possible without making the laptop sluggish.
  balanced: { workers: 4, nice: 10, background: false },
  // No noticeable impact: macOS background policy keeps it on efficiency cores.
  background: { workers: 6, nice: 0, background: true }
} as const;
export type ProfileName = keyof typeof PROFILES;

export function profileFor(name: string | undefined) {
  const key = name || 'balanced';
  if (!Object.hasOwn(PROFILES, key)) throw new Error(`Unknown UI_PROFILE "${key}": use performance, balanced or background`);
  return { name: key as ProfileName, ...PROFILES[key as ProfileName] };
}

// UI_SHOTS=all|off (default off): per-state full-page screenshots in test:ui. Failures always get one.
export function shotsOn(value: string | undefined) {
  if (!value || value === 'off') return false;
  if (value === 'all') return true;
  throw new Error(`Unknown UI_SHOTS "${value}": use all or off`);
}
