// test:ui run profiles (docs/superpowers/specs/2026-10-13-test-suite-speed-design.md).
// Worker counts are placeholders until the measured sweep (plan Task 6) replaces them.
export const PROFILES = {
  // Max speed: user away, or tests are the only thing the laptop is doing.
  performance: { workers: '100%', nice: 0, background: false },
  // Default: as fast as possible without making the laptop sluggish.
  balanced: { workers: 4, nice: 10, background: false },
  // No noticeable impact: macOS background policy keeps it on efficiency cores.
  background: { workers: 2, nice: 0, background: true }
} as const;
export type ProfileName = keyof typeof PROFILES;

export function profileFor(name: string | undefined) {
  const key = name || 'balanced';
  if (!(key in PROFILES)) throw new Error(`Unknown UI_PROFILE "${key}": use performance, balanced or background`);
  return { name: key as ProfileName, ...PROFILES[key as ProfileName] };
}
