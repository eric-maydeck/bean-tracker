import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { shopifyImages, htmlImages, shopifyDetails, htmlDetails, excerptOf } from './pageImages';

const fixture = (name: string) => readFileSync(new URL(`../fixtures/product-pages/${name}`, import.meta.url), 'utf8');

describe('shopifyImages', () => {
  it('returns every product image in order, with dimensions (captured page, bag art third)', () => {
    const imgs = shopifyImages(JSON.parse(fixture('ordinary-faf.json')), 'https://shop.ordinarycoffeeroasters.com/products/faf-coffee-brazil-anaerobic-natural-catuai.json');
    expect(imgs).toHaveLength(3);
    expect(imgs[0]).toMatchObject({ width: 2048, height: 2048 });
    expect(imgs[1]).toMatchObject({ width: 3307, height: 4677 });
    expect(imgs[2].url).toContain('Same_white_pouch_design');
    expect(imgs.every((i) => i.url.startsWith('https://'))).toBe(true);
  });

  it('resolves protocol-relative and relative srcs, dedupes, skips junk', () => {
    const json = { product: { images: [{ src: '//shop.example/cdn/a.png' }, { src: '/cdn/b.png', alt: 'Bag' }, { src: '//shop.example/cdn/a.png' }, { src: 42 }, {}] } };
    expect(shopifyImages(json, 'https://shop.example/products/x.json')).toEqual([
      { url: 'https://shop.example/cdn/a.png', alt: '', width: null, height: null },
      { url: 'https://shop.example/cdn/b.png', alt: 'Bag', width: null, height: null }
    ]);
  });

  it('is empty for something that is not a product', () => {
    expect(shopifyImages(null, 'https://x.example/')).toEqual([]);
    expect(shopifyImages({ products: [] }, 'https://x.example/')).toEqual([]);
  });
});

describe('htmlImages', () => {
  it('Picky Chemist (Wix, captured): the JSON-LD ImageObjects; og:image is a duplicate', () => {
    const imgs = htmlImages(fixture('picky-chemist.html'), 'https://en.thepickychemist.com/product-page/ethiopia-gesha-village-lot-26-136-oma-honey');
    expect(imgs.map((i) => [i.url.match(/d61d15_[0-9a-f]+/)?.[0], i.width, i.height])).toEqual([
      ['d61d15_6699fd7c385b4783a3fb559ec8ab3e9b', 2826, 2826],
      ['d61d15_42a03ff026934f17a0433e16cc4cda1c', 2000, 2000],
      ['d61d15_6925b04ee88e42c185275c3b067dce9c', 1000, 1000]
    ]);
  });

  it('XLIII (WordPress, captured): JSON-LD, then <img> with srcset or both sides ≥ 300; small icons skipped', () => {
    const imgs = htmlImages(fixture('xliii.html'), 'https://xliiicoffee.com/en/product/kinini/');
    expect(imgs.map((i) => i.url.split('/').pop())).toEqual([
      '202604250114-Kinini-Village-by-Dufatanye-Farmer-Group-03732.webp',
      '202601020445-webbb-480x267.webp',
      '202409180245-202405020250-49ae025877e4d9ba80f51-1.webp'
    ]);
    expect(imgs[0]).toMatchObject({ width: 1920, height: 1280 });
    expect(imgs[1].alt).toBe('XLIII Coffee - Specialty Coffee in Vietnam');
  });

  it('resolves a relative og:image against the page and decodes alt entities', () => {
    const html = `<meta property="og:image" content="/img/bag.png"><img src='//cdn.example/x.jpg' width="600" height="600" alt="Bag &amp; label">`;
    expect(htmlImages(html, 'https://roaster.example/p/x')).toEqual([
      { url: 'https://roaster.example/img/bag.png', alt: '', width: null, height: null },
      { url: 'https://cdn.example/x.jpg', alt: 'Bag & label', width: 600, height: 600 }
    ]);
  });

  it('skips data: and other non-http images', () => {
    expect(htmlImages(`<meta property="og:image" content="data:image/png;base64,AAAA">`, 'https://r.example/')).toEqual([]);
  });
});

describe('excerptOf', () => {
  it('plain text, entities decoded, cut on a word boundary with an ellipsis', () => {
    expect(excerptOf('<p>Fruity &amp; <b>bright</b></p>')).toBe('Fruity & bright');
    const long = excerptOf(`<p>${'word '.repeat(60)}</p>`)!;
    expect(long.length).toBeLessThanOrEqual(160);
    expect(long.endsWith('word…')).toBe(true);
  });
  it('null for empty', () => {
    expect(excerptOf('  <p> </p>')).toBeNull();
    expect(excerptOf(null)).toBeNull();
  });
});

describe('shopifyDetails', () => {
  it('captured page: published_at date and a description excerpt', () => {
    const d = shopifyDetails(JSON.parse(fixture('ordinary-faf.json')));
    expect(d.published).toBe('2026-08-24');
    expect(d.excerpt!.length).toBeLessThanOrEqual(160);
    expect(d.excerpt!.startsWith('Origin: Serra dos Ciganos, Brazil')).toBe(true);
  });
  it('falls back to created_at; junk is null', () => {
    expect(shopifyDetails({ product: { created_at: '2025-03-01T10:00:00Z' } })).toEqual({ published: '2025-03-01', excerpt: null });
    expect(shopifyDetails({ product: { published_at: 'soon' } }).published).toBeNull();
    expect(shopifyDetails(null)).toEqual({ published: null, excerpt: null });
  });
});

describe('htmlDetails', () => {
  it('XLIII (captured): JSON-LD datePublished (on the WebPage node), meta description', () => {
    expect(htmlDetails(fixture('xliii.html'))).toEqual({
      published: '2026-05-25',
      excerpt: 'Kinini Village by Dufatanye Farmer Group #03732 celebrates Rwandan excellence through sustainable collective farming.'
    });
  });
  it('article:published_time and og:description when there is no JSON-LD', () => {
    const html = `<meta property="article:published_time" content="2026-02-03T00:00:00Z"><meta property="og:description" content="Nice &amp; juicy">`;
    expect(htmlDetails(html)).toEqual({ published: '2026-02-03', excerpt: 'Nice & juicy' });
  });
  it('nothing → nulls', () => {
    expect(htmlDetails('<p>hi</p>')).toEqual({ published: null, excerpt: null });
  });
});
