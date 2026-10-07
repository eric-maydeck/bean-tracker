import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { scoreImage, rankImages } from './rankImages';
import { shopifyImages, type PageImage } from './pageImages';
import type { CandidatePage } from './types';

const img = (url: string, over: Partial<PageImage> = {}): PageImage => ({ url, alt: '', width: null, height: null, ...over });
const page = (url: string, provider = 'shopify'): CandidatePage => ({ url, title: 'T', provider });
const names = (pages: Parameters<typeof rankImages>[0], roastDate: string | null = null, site: string | null = null) =>
  rankImages(pages, roastDate, site).map((c) => c.image.split('/').pop());

describe('scoreImage', () => {
  it('bag/label/mockup/pouch hints up, in the filename or the alt', () => {
    for (const u of ['mock_light_26.png', 'x-mockup.png', 'BAG.jpg', 'label-front.png', 'pouch.png']) {
      expect(scoreImage(img(`https://s.example/${u}`), null)).toBeGreaterThan(0);
    }
    expect(scoreImage(img('https://s.example/1.png', { alt: 'Retail bag' }), null)).toBeGreaterThan(0);
  });
  it('lifestyle hints down', () => {
    for (const u of ['beans-closeup.jpg', 'cup.jpg', 'brew-guide.png', 'farm-visit.jpg']) {
      expect(scoreImage(img(`https://s.example/${u}`), null)).toBeLessThan(0);
    }
  });
  it('roast-date year in the filename up, a different year down, query string ignored', () => {
    const y26 = img('https://s.example/worka_fw_2026_shopify.png?v=2025');
    const y25 = img('https://s.example/worka_fw_2025_shopify.png');
    expect(scoreImage(y26, '2026')).toBeGreaterThan(0);
    expect(scoreImage(y25, '2026')).toBeLessThan(0);
    expect(scoreImage(y25, null)).toBe(0);
  });
  it('extreme aspect ratio down only when dimensions are known', () => {
    expect(scoreImage(img('https://s.example/a.png', { width: 1600, height: 500 }), null)).toBeLessThan(0);
    expect(scoreImage(img('https://s.example/a.png', { width: 3307, height: 4677 }), null)).toBe(0);
    expect(scoreImage(img('https://s.example/a.png'), null)).toBe(0);
  });
});

describe('rankImages', () => {
  it('captured Shopify page: the pouch mockup (third image) ranks first', () => {
    const json = JSON.parse(readFileSync(new URL('../fixtures/product-pages/ordinary-faf.json', import.meta.url), 'utf8'));
    const url = 'https://shop.ordinarycoffeeroasters.com/products/faf-coffee-brazil-anaerobic-natural-catuai';
    const ranked = rankImages([{ page: page(url), images: shopifyImages(json, `${url}.json`) }], '2026-08-01', null);
    expect(ranked[0].image).toContain('Same_white_pouch_design');
    expect(ranked[0]).toMatchObject({ pageUrl: url, pageTitle: 'T', provider: 'shopify' });
  });

  it('the roaster’s own site ranks above a higher-scoring image elsewhere', () => {
    const pages = [
      { page: page('https://www.beanhoard.example/c/1', 'tavily'), images: [img('https://cdn.example/mock_bag.png')] },
      { page: page('https://lume.coffee/products/k'), images: [img('https://cdn.example/plain.png')] }
    ];
    expect(names(pages, null, 'https://www.lume.coffee')).toEqual(['plain.png', 'mock_bag.png']);
  });

  it('ties keep page order, then position on the page', () => {
    const pages = [
      { page: page('https://a.example/1'), images: [img('https://c.example/a1.png'), img('https://c.example/a2.png')] },
      { page: page('https://a.example/2'), images: [img('https://c.example/b1.png')] }
    ];
    expect(names(pages)).toEqual(['a1.png', 'a2.png', 'b1.png']);
  });

  it('dedupes an image that appears on two pages, keeping its best placement', () => {
    const pages = [
      { page: page('https://a.example/1'), images: [img('https://c.example/same.png')] },
      { page: page('https://a.example/2'), images: [img('https://c.example/same.png'), img('https://c.example/other.png')] }
    ];
    const ranked = rankImages(pages, null, null);
    expect(ranked.map((c) => c.image.split('/').pop())).toEqual(['same.png', 'other.png']);
    expect(ranked[0].pageUrl).toBe('https://a.example/1');
  });
});

describe('rankImages by release date', () => {
  const dated = (url: string, published: string | null, image: string) => ({
    page: page(url),
    images: [img(`https://c.example/${image}`)],
    details: { published, excerpt: published ? `about ${image}` : null }
  });
  const pages = [dated('https://a.example/old', '2025-03-01', 'old.png'), dated('https://a.example/new', '2026-08-20', 'new.png')];

  it('page released nearest the roast date first and flagged closest; carries published/excerpt', () => {
    const r = rankImages(pages, '2026-09-01', null);
    expect(r.map((c) => [c.image.split('/').pop(), c.closest])).toEqual([['new.png', true], ['old.png', false]]);
    expect(r[0]).toMatchObject({ published: '2026-08-20', excerpt: 'about new.png' });
  });
  it('no roast date: old order, nothing closest', () => {
    const r = rankImages(pages, null, null);
    expect(r.map((c) => c.image.split('/').pop())).toEqual(['old.png', 'new.png']);
    expect(r.some((c) => c.closest)).toBe(false);
  });
  it('an undated page sorts after dated ones and is never closest', () => {
    const r = rankImages([dated('https://a.example/u', null, 'u.png'), ...pages], '2026-09-01', null);
    expect(r.map((c) => c.image.split('/').pop())).toEqual(['new.png', 'old.png', 'u.png']);
    expect(rankImages([dated('https://a.example/u', null, 'u.png')], '2026-09-01', null)[0].closest).toBe(false);
  });
});

describe('rankImages by coffee name', () => {
  const titled = (url: string, title: string, published: string, image: string) => ({
    page: { url, title, provider: 'tavily' },
    images: [img(`https://c.example/${image}`)],
    details: { published, excerpt: null }
  });
  const rank = (name: string, title: string) =>
    rankImages(
      [titled('https://a.example/collab', 'Bean’s Beans x Airworks Alo Gute Village', '2026-08-30', 'collab.png'), titled('https://a.example/x', title, '2025-11-01', 'match.png')],
      '2026-09-01', null, name
    ).map((c) => c.image.split('/').pop());

  it('name match beats release date', () => {
    expect(rank('Fugi Ikizere', 'Fugi Ikizere')).toEqual(['match.png', 'collab.png']);
  });
  it('equal name match: date decides', () => {
    expect(rank('Zzz', 'Fugi Ikizere')).toEqual(['collab.png', 'match.png']);
  });
  it('accents are ignored', () => {
    expect(rank('Bolaños', 'Bolanos Washed')).toEqual(['match.png', 'collab.png']);
  });
  it('a logo ranks below a plain image on the same page', () => {
    const r = names([{ page: page('https://a.example/1'), images: [img('https://c.example/logo.png'), img('https://c.example/plain.png')] }]);
    expect(r).toEqual(['plain.png', 'logo.png']);
  });
});
