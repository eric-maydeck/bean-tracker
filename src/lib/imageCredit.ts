// Who to credit for a coffee's image (docs/backlog/image-attribution.md "Design").
// Client-safe and pure; the go route re-runs it so a link never targets anything not stored on the coffee.
export interface Credit {
  href: string;
  label: string;
  kind: 'source' | 'product' | 'roaster' | 'literal';
}

interface CreditCoffee {
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

export function creditFor(coffee: CreditCoffee, roasterWebsite: string | null, roasterDefaultImage: string | null): Credit | null {
  const own = web(coffee.image_url);
  const image = own ?? web(roasterDefaultImage);
  if (!image) return null;
  const make = (href: string, kind: Credit['kind']): Credit => ({ href, label: creditHost(href), kind });
  const source = web(coffee.image_source_url);
  if (source) return make(source, 'source');
  // The product page only counts when the coffee's own image is shown: a roaster default isn't from it.
  const product = own ? web(coffee.product_url) : null;
  if (product) return make(product, 'product');
  const site = web(roasterWebsite);
  if (site && (!own || creditHost(image) === creditHost(site))) return make(site, 'roaster');
  return make(image, 'literal');
}
