import { describe, it, expect } from 'vitest';
import { hostOf, hostMatchesRoaster, pickCandidate, type Candidate } from './imageSuggest';

describe('hostOf', () => {
  it('strips www and returns the hostname', () => expect(hostOf('https://www.lume.coffee/x')).toBe('lume.coffee'));
  it('returns empty for a non-URL', () => expect(hostOf('nope')).toBe(''));
});

const c: Candidate = { image: 'https://cdn.example/bag.png', pageUrl: 'https://www.lume.coffee/products/kiambu', pageTitle: 'Kiambu', provider: 'shopify', published: null, excerpt: null, closest: false };

describe('pickCandidate', () => {
  it('fills an empty product URL and stages the page origin when no site is stored', () => {
    expect(pickCandidate(c, '  ', null, 'Lume')).toEqual({
      image_url: 'https://cdn.example/bag.png',
      product_url: 'https://www.lume.coffee/products/kiambu',
      roaster_website: 'https://www.lume.coffee'
    });
  });
  it('keeps an existing product URL', () => {
    expect(pickCandidate(c, 'https://lume.coffee/old', null, 'Lume').product_url).toBeNull();
  });
  it('never replaces a stored site', () => {
    expect(pickCandidate(c, '', 'https://www.lume.coffee', 'Lume').roaster_website).toBeNull();
    expect(pickCandidate(c, '', 'https://lumecoffee.com', 'Lume').roaster_website).toBeNull();
  });
  it('stages a site only when its host carries a word from the roaster name', () => {
    const wix = { ...c, pageUrl: 'https://en.thepickychemist.com/product-page/jairo' };
    expect(pickCandidate(wix, '', null, 'The Picky Chemist').roaster_website).toBe('https://en.thepickychemist.com');
    const reseller = { ...c, pageUrl: 'https://beanhoard.com/coffees/lume-kiambu' };
    expect(pickCandidate(reseller, '', null, 'Lume').roaster_website).toBeNull();
    // generic words never match on their own
    const generic = { ...c, pageUrl: 'https://bestcoffeeroasters.com/x' };
    expect(pickCandidate(generic, '', null, 'Lume Coffee Roasters').roaster_website).toBeNull();
    // names with no usable word (H&S) never stage a site
    expect(pickCandidate({ ...c, pageUrl: 'https://hscoffee.com/x' }, '', null, 'H&S').roaster_website).toBeNull();
  });
});

describe('hostMatchesRoaster', () => {
  it('matches the whole name squashed into the host', () => {
    expect(hostMatchesRoaster('https://hscoffeeroasters.com/products/sub', 'H&S Coffee Roasters')).toBe(true);
  });
  it('matches real subscription sites', () => {
    for (const [roaster, url] of [
      ['Airworks', 'https://airworks.coffee/x'],
      ['H&S Coffee Roasters', 'https://hscoffeeroasters.com/x'],
      ['Shoebox Coffee Roaster', 'https://shoebox.coffee/x'],
      ['norml', 'https://normlppl.coffee/x'],
      ['Scenery', 'https://scenery.coffee/x'],
      ['Ceto', 'https://ceto.coffee/x']
    ]) expect(hostMatchesRoaster(url, roaster), roaster).toBe(true);
  });
  it('rejects an unrelated host', () => {
    expect(hostMatchesRoaster('https://evil.example.com', 'Ceto')).toBe(false);
    expect(hostMatchesRoaster('https://hscoffee.com/x', 'H&S')).toBe(false);
  });
});
