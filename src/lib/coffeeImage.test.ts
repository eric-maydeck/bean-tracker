import { describe, it, expect } from 'vitest';
import { coffeeImage, roasterDefaultFor } from './coffeeImage';
import { NEUTRAL_BACKDROP } from './imageBackdrop';

describe('coffeeImage', () => {
  const base = { roaster: 'Norml', image_url: null, roaster_image_url: null };

  it("uses the coffee's own image with the caller's alt", () => {
    expect(coffeeImage({ ...base, image_url: 'https://img.example/bag.png', roaster_image_url: 'https://img.example/logo.png' }, ''))
      .toEqual({ src: 'https://img.example/bag.png', alt: '', fill: NEUTRAL_BACKDROP });
  });

  it('falls back to the roaster default with "<roaster> logo" alt', () => {
    expect(coffeeImage({ ...base, roaster_image_url: 'https://img.example/logo.png' }, 'X label'))
      .toEqual({ src: 'https://img.example/logo.png', alt: 'Norml logo', fill: NEUTRAL_BACKDROP });
  });

  it('treats an empty own image as none', () => {
    expect(coffeeImage({ ...base, image_url: '', roaster_image_url: 'https://img.example/logo.png' }, '')?.alt).toBe('Norml logo');
  });

  it("returns the row's fill for whichever image it shows", () => {
    expect(coffeeImage({ ...base, image_url: 'https://img.example/bag.png', image_fill: '#123abc' }, '')?.fill).toBe('#123abc');
    expect(coffeeImage({ ...base, roaster_image_url: 'https://img.example/logo.png', image_fill: '#3a2f26' }, '')?.fill).toBe('#3a2f26');
  });

  it('falls back to the neutral backdrop for a missing or malformed fill', () => {
    const img = { ...base, image_url: 'https://img.example/bag.png' };
    expect(coffeeImage({ ...img, image_fill: null }, '')?.fill).toBe(NEUTRAL_BACKDROP);
    expect(coffeeImage({ ...img, image_fill: 'red;background:url(x)' }, '')?.fill).toBe(NEUTRAL_BACKDROP);
  });

  it('is null with neither (also when the row has no roaster_image_url field)', () => {
    expect(coffeeImage(base, '')).toBeNull();
    expect(coffeeImage({ roaster: 'Norml', image_url: null }, '')).toBeNull();
  });
});

describe('roasterDefaultFor', () => {
  const images = { Norml: 'https://img.example/norml.png' };

  it('finds the default ignoring case and surrounding spaces', () => {
    expect(roasterDefaultFor(images, ' NORML ')).toBe('https://img.example/norml.png');
  });

  it('is null for an unknown or empty roaster', () => {
    expect(roasterDefaultFor(images, 'Sey')).toBeNull();
    expect(roasterDefaultFor(images, '')).toBeNull();
  });

  it('folds ASCII case only, like the SQLite NOCASE join', () => {
    expect(roasterDefaultFor({ Café: 'x' }, 'CAFÉ')).toBeNull();
    expect(roasterDefaultFor({ Café: 'x' }, 'café')).toBe('x');
  });
});
