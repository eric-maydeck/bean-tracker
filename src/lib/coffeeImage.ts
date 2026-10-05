// Client-safe. A coffee's image: its own, else its roaster's default (a live
// fallback, spec 2026-10-05-roaster-default-image-design.md).
export function coffeeImage(
  c: { image_url: string | null; roaster: string; roaster_image_url?: string | null },
  ownAlt: string
): { src: string; alt: string } | null {
  if (c.image_url) return { src: c.image_url, alt: ownAlt };
  if (c.roaster_image_url) return { src: c.roaster_image_url, alt: `${c.roaster} logo` };
  return null;
}

// ASCII-only case folding, like SQLite's NOCASE on roaster_images.roaster.
const roasterKey = (roaster: string) => roaster.trim().replace(/[A-Z]/g, (ch) => ch.toLowerCase());

// The coffee form's "Roaster default" preview: the default for the typed roaster.
export function roasterDefaultFor(images: Record<string, string>, roaster: string): string | null {
  const key = roasterKey(roaster);
  if (!key) return null;
  for (const [name, url] of Object.entries(images)) if (roasterKey(name) === key) return url;
  return null;
}
