// Client-safe. Backdrops behind contained coffee images, shared by the server's fill algorithm
// (server/imageFills.ts) and the render sites' fallback (coffeeImage.ts,
// CoffeeForm). Taken from the warm palette in src/app.css but fixed: the same
// in light and dark mode, because a backdrop belongs to its image, not the theme.
// Light: light-mode --color-border. Behind dark logos on transparent images.
export const LIGHT_BACKDROP = '#e6ddd2';
// Dark: dark-mode --color-border. Behind light logos on transparent images.
export const DARK_BACKDROP = '#3a2f26';
// No fill yet (not computed, fetch failed, data: URI).
export const NEUTRAL_BACKDROP = LIGHT_BACKDROP;

// A stored fill, else the neutral backdrop. Checked because it goes into a
// style attribute.
export function backdrop(fill: string | null | undefined): string {
  return fill && /^#[0-9a-f]{6}$/i.test(fill) ? fill : NEUTRAL_BACKDROP;
}
