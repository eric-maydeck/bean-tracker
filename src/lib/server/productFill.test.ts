import { describe, it, expect } from 'vitest';
import type { ProductData } from './productParse';
import { parseGrams, cleanName, findOrigin, findProcessing } from './productFill';

export function product(overrides: Partial<ProductData> = {}): ProductData {
  return {
    title: null, vendor: null, siteName: null, brand: null, tags: [], description: '',
    attributes: {}, image: null, currency: 'USD', variants: [], ...overrides
  };
}

describe('parseGrams', () => {
  it.each([
    ['250g', 250], ['125g (4.4oz)', 125], ['1kg (2.2lb)', 1000], ['0.5 kg', 500], ['12oz', 340],
    ['200g / 7.05oz', 200], ['7.05oz', 200], ['250 gram', 250], ['1,000g', 1000], ['2 lb', 907]
  ])('%s -> %i', (text, grams) => {
    expect(parseGrams(text)).toBe(grams);
  });

  it.each(['Washed G1', 'Default Title', '', 'Lot 26-136', '1800 - 2000 masl', 'El Paraiso 92 Gesha'])('%s -> null', (text) => {
    expect(parseGrams(text)).toBeNull();
  });
});

describe('cleanName', () => {
  it.each([
    ['Getachew Zekele Tero Farm Washed G1 200g / 7.05oz - Roasted 09/21/2026', 'Getachew Zekele Tero Farm Washed G1'],
    ['Getachew Zekele Tero Farm Washed G1 200g (7.05oz) Roasted 09.21.2026', 'Getachew Zekele Tero Farm Washed G1'],
    ["26' New Season Panama Tierra Blanca Natural Geisha 60g", "26' New Season Panama Tierra Blanca Natural Geisha"],
    ['Ethiopia Guji (250g)', 'Ethiopia Guji'],
    ['Kenya Kiambu | 12oz', 'Kenya Kiambu'],
    ['Colombia - 250g - Pink Bourbon', 'Colombia - Pink Bourbon'],
    ['Burundi Mikuba 8', 'Burundi Mikuba 8']
  ])('%s', (title, expected) => {
    expect(cleanName(title)).toBe(expected);
  });
});

describe('findOrigin', () => {
  it('uses a labeled Country:/Origin:/Region: value, country part only', () => {
    expect(findOrigin(product({ attributes: { country: 'Panama' } }), [])).toBe('Panama');
    expect(findOrigin(product({ attributes: { region: 'Shakiso, Ethiopia' } }), [])).toBe('Ethiopia');
  });

  it('ignores a labeled region that names no country and falls through to the text (XLIII)', () => {
    const p = product({ attributes: { origin: 'Northern Province' }, description: 'celebrates Rwandan excellence' });
    expect(findOrigin(p, [])).toBe('Rwanda');
  });

  it('searches tags before title before description', () => {
    const p = product({ tags: ['africa', 'Burundi'], title: 'Kenya-style lot', description: 'Like a Colombian' });
    expect(findOrigin(p, [])).toBe('Burundi');
    expect(findOrigin(product({ title: 'Kenya Kiambu', description: 'Colombia' }), [])).toBe('Kenya');
  });

  it("prefers the user's spelling and the longest country at a position", () => {
    expect(findOrigin(product({ title: 'colombian pink bourbon' }), ['Colombia'])).toBe('Colombia');
    expect(findOrigin(product({ title: 'Papua New Guinea Sigri' }), [])).toBe('Papua New Guinea');
    expect(findOrigin(product({ title: 'Nigeria test' }), [])).toBe('Nigeria');
  });

  it('does not match a country inside another word, and returns null when none', () => {
    expect(findOrigin(product({ description: 'a woman from Indiana' }), [])).toBeNull();
    expect(findOrigin(product({ title: 'House Blend' }), [])).toBeNull();
  });
});

describe('findProcessing', () => {
  it("uses a labeled Process: value, in the user's existing spelling when it matches", () => {
    expect(findProcessing(product({ attributes: { process: 'natural' } }), ['Natural'])).toBe('Natural');
    expect(findProcessing(product({ attributes: { process: 'double ferment washed' } }), ['Double Ferment Washed'])).toBe(
      'Double Ferment Washed'
    );
    expect(findProcessing(product({ attributes: { processing: 'Wet Hulled' } }), [])).toBe('Wet Hulled');
  });

  it('otherwise takes the longest vocabulary match, tags before title before description', () => {
    expect(findProcessing(product({ tags: ['coffee', 'washed'] }), [])).toBe('Washed');
    expect(findProcessing(product({ title: 'Colombia Anaerobic Natural Gesha' }), [])).toBe('Anaerobic Natural');
    expect(findProcessing(product({ tags: ['honey'], description: 'fully washed' }), [])).toBe('Honey');
    expect(findProcessing(product({ description: 'This natural lot…' }), ['Natural'])).toBe('Natural');
  });

  it('returns null when nothing matches', () => {
    expect(findProcessing(product({ title: 'Kenya Kiambu' }), [])).toBeNull();
  });
});
