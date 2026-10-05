import { describe, it, expect } from 'vitest';
import { coffeeImage } from './coffeeImage';

describe('coffeeImage', () => {
  const base = { roaster: 'Norml', image_url: null, roaster_image_url: null };

  it("uses the coffee's own image with the caller's alt", () => {
    expect(coffeeImage({ ...base, image_url: 'https://img.example/bag.png', roaster_image_url: 'https://img.example/logo.png' }, ''))
      .toEqual({ src: 'https://img.example/bag.png', alt: '' });
  });

  it('falls back to the roaster default with "<roaster> logo" alt', () => {
    expect(coffeeImage({ ...base, roaster_image_url: 'https://img.example/logo.png' }, 'X label'))
      .toEqual({ src: 'https://img.example/logo.png', alt: 'Norml logo' });
  });

  it('treats an empty own image as none', () => {
    expect(coffeeImage({ ...base, image_url: '', roaster_image_url: 'https://img.example/logo.png' }, '')?.alt).toBe('Norml logo');
  });

  it('is null with neither (also when the row has no roaster_image_url field)', () => {
    expect(coffeeImage(base, '')).toBeNull();
    expect(coffeeImage({ roaster: 'Norml', image_url: null }, '')).toBeNull();
  });
});
