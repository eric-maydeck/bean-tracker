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
