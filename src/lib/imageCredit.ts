// Who to credit for a coffee's image (docs/backlog/image-attribution.md "Design").
// Client-safe and pure; the go route re-runs it so a link never targets anything not stored on the coffee.
export interface Credit {
  href: string;
  label: string;
  kind: 'source' | 'product' | 'roaster' | 'literal';
}

interface CoffeeCreditFields {
  image_url: string | null;
  product_url: string | null;
  image_source_url?: string | null;
}

export function creditHost(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./i, '');
  } catch {
    return '';
  }
}

const web = (u: string | null | undefined): string | null => {
  const s = u?.trim();
  return s && /^https?:\/\//i.test(s) && creditHost(s) ? s : null;
};

export function creditFor(coffee: CoffeeCreditFields, roasterWebsite: string | null, roasterDefaultImage: string | null): Credit | null {
  // "Own" = the coffee has an image of its own, whatever its scheme (a data: image still isn't the roaster's default).
  const own = !!coffee.image_url?.trim();
  const image = own ? web(coffee.image_url) : web(roasterDefaultImage);
  if (!own && !image) return null;
  const make = (href: string, kind: Credit['kind']): Credit => ({ href, label: creditHost(href), kind });
  // A stale source never credits a roaster default image: both need the coffee's own image.
  const source = own ? web(coffee.image_source_url) : null;
  if (source) return make(source, 'source');
  // The product page only counts when the coffee's own image is shown: a roaster default isn't from it.
  const product = own ? web(coffee.product_url) : null;
  if (product) return make(product, 'product');
  if (!image) return null;
  const site = web(roasterWebsite);
  if (site && (!own || creditHost(image) === creditHost(site))) return make(site, 'roaster');
  return make(image, 'literal');
}
