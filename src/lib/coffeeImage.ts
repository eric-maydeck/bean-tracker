import { backdrop } from './imageBackdrop';

// Client-safe. A coffee's image: its own, else its roaster's default (a live
// fallback), as our local copy
// when there is one, else the original URL, with the
// backdrop shown behind it (object-fit: contain). image_fill is already the
// displayed image's fill (LIST_SELECT's join).
export function coffeeImage(
  c: { image_url: string | null; roaster: string; roaster_image_url?: string | null; image_fill?: string | null; image_copy?: string | null },
  ownAlt: string
): { src: string; alt: string; fill: string } | null {
  const fill = backdrop(c.image_fill);
  if (c.image_url) return { src: c.image_copy ?? c.image_url, alt: ownAlt, fill };
  if (c.roaster_image_url) return { src: c.image_copy ?? c.roaster_image_url, alt: `${c.roaster} logo`, fill };
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
