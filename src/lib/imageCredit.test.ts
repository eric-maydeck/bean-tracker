import { describe, expect, it } from 'vitest';
import { creditFor, creditHost } from './imageCredit';

const base = { image_url: 'https://cdn.example.com/a.jpg', product_url: null, image_source_url: null };
const site = 'https://roaster.coffee';

describe('creditFor', () => {
  it('source page wins', () => {
    const c = creditFor({ ...base, image_source_url: 'https://shop.com/p/1', product_url: 'https://x.com/p' }, site, null);
    expect(c).toEqual({ href: 'https://shop.com/p/1', label: 'shop.com', kind: 'source' });
  });
  it('ignores a stale source when the coffee shows the roaster default image', () => {
    const c = creditFor({ image_url: null, product_url: null, image_source_url: 'https://shop.com/p/1' }, site, 'https://r.com/logo.png');
    expect(c).toEqual({ href: site, label: 'roaster.coffee', kind: 'roaster' });
  });
  it('a non-web own image (data:) still uses its source and never the roaster default', () => {
    const c = { image_url: 'data:image/svg+xml,x', product_url: null, image_source_url: 'https://shop.com/p/1' };
    expect(creditFor(c, site, 'https://r.com/logo.png')?.kind).toBe('source');
    expect(creditFor({ ...c, image_source_url: null }, site, 'https://r.com/logo.png')).toBeNull();
  });
  it('falls back to the product page (legacy coffees)', () => {
    expect(creditFor({ ...base, product_url: 'https://www.shop.com/p' }, site, null)).toEqual({
      href: 'https://www.shop.com/p', label: 'shop.com', kind: 'product'
    });
  });
  it('roaster default image credits the roaster site, not the product page', () => {
    const c = creditFor({ image_url: null, product_url: 'https://shop.com/p', image_source_url: null }, site, 'https://r.com/logo.png');
    expect(c).toEqual({ href: site, label: 'roaster.coffee', kind: 'roaster' });
  });
  it('image on the roaster host credits the roaster site', () => {
    const c = creditFor({ ...base, image_url: 'https://www.roaster.coffee/cdn/a.jpg' }, site, null);
    expect(c?.kind).toBe('roaster');
  });
  it('otherwise the literal image URL', () => {
    expect(creditFor(base, site, null)).toEqual({ href: base.image_url, label: 'cdn.example.com', kind: 'literal' });
    expect(creditFor({ ...base }, null, null)?.kind).toBe('literal');
  });
  it('default image with no stored site credits the default image URL', () => {
    expect(creditFor({ image_url: null, product_url: null, image_source_url: null }, null, 'https://r.com/l.png')?.kind).toBe('literal');
  });
  it('no image, no credit', () => {
    expect(creditFor({ image_url: null, product_url: 'https://shop.com/p', image_source_url: null }, site, null)).toBeNull();
    expect(creditFor({ image_url: '', product_url: null, image_source_url: null }, site, '')).toBeNull();
  });
  it('ignores non-http links', () => {
    expect(creditFor({ ...base, image_source_url: 'javascript:alert(1)' }, null, null)?.kind).toBe('literal');
  });
});

describe('creditHost', () => {
  it('drops www', () => expect(creditHost('https://www.a.com/x')).toBe('a.com'));
});
