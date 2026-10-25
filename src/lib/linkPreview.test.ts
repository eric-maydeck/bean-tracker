import { describe, expect, it } from 'vitest';
import { absoluteImage, coffeePreview, coffeesPreview, fitList, onDeckPreview, plural, statsPreview, subscriptionsPreview, waterPreview } from './linkPreview';

const kenya = { roaster: 'The Picky Chemist', coffee_name: 'Kenya AA Inoi Kianderi', origin: 'Kenya', processing: 'Washed', amount_g: 250, roast_date: '2026-10-03' };

describe('absoluteImage', () => {
  it('prefixes paths, keeps http(s), drops the rest', () => {
    expect(absoluteImage('/img/coffees/ab.webp', 'https://fuhnoo.coffee')).toBe('https://fuhnoo.coffee/img/coffees/ab.webp');
    expect(absoluteImage('https://x.example/a.jpg', 'https://o')).toBe('https://x.example/a.jpg');
    expect(absoluteImage('http://x.example/a.jpg', 'https://o')).toBe('http://x.example/a.jpg');
    expect(absoluteImage('data:image/svg+xml,%3Csvg', 'https://o')).toBeNull();
    expect(absoluteImage('', 'https://o')).toBeNull();
  });
});

describe('fitList', () => {
  it('fits, cuts and appends the more-line', () => {
    expect(fitList(['a', 'b', 'c'], ' · ', false, 100)).toBe('a · b · c');
    expect(fitList(['aaaa', 'bbbb', 'cccc'], ' · ', false, 11)).toBe('aaaa · bbbb');
    expect(fitList(['aaaa', 'bbbb', 'cccc', 'dddd'], '\n', true, 16)).toBe('aaaa\n…and 3 more');
    expect(fitList(['aaaa', 'bbbb'], '\n', true, 16)).toBe('aaaa\nbbbb');
    const long = fitList(['x'.repeat(400)], '\n', true);
    expect(long).toHaveLength(300);
    expect(long.endsWith('…')).toBe(true);
  });
});

describe('plural', () => {
  it('pluralises and groups', () => {
    expect(plural(1, 'coffee')).toBe('1 coffee');
    expect(plural(23, 'coffee')).toBe('23 coffees');
    expect(plural(1234, 'brew')).toBe('1,234 brews');
  });
});

describe('coffeePreview', () => {
  it('builds title and description', () => {
    expect(coffeePreview(kenya, null)).toEqual({ title: 'Kenya AA Inoi Kianderi', description: 'The Picky Chemist\n🇰🇪 Kenya · Washed · 250g · Roasted 2026-10-03', image: null });
  });
  it('skips missing fields', () => {
    expect(coffeePreview({ ...kenya, origin: null, processing: '  ', amount_g: null, roast_date: null }, null).description).toBe('The Picky Chemist');
  });
  it('shows free-text origins without a flag', () => {
    expect(coffeePreview({ ...kenya, origin: 'Ethiopia, Colombia' }, null).description.split('\n')[1]).toMatch(/^Ethiopia, Colombia · Washed/);
  });
  it('shows the amount left only when known and under the bag size', () => {
    const line = (grams_left: number | null | undefined) => coffeePreview({ ...kenya, grams_left }, null).description.split('\n')[1];
    expect(line(44)).toBe('🇰🇪 Kenya · Washed · 250g (44g left) · Roasted 2026-10-03');
    expect(line(0)).toBe('🇰🇪 Kenya · Washed · 250g (0g left) · Roasted 2026-10-03');
    expect(line(250)).toBe('🇰🇪 Kenya · Washed · 250g · Roasted 2026-10-03');
    expect(line(null)).toBe('🇰🇪 Kenya · Washed · 250g · Roasted 2026-10-03');
    expect(line(undefined)).toBe('🇰🇪 Kenya · Washed · 250g · Roasted 2026-10-03');
  });
  it('formats kg and passes the image', () => {
    const image = { src: 'https://o/a.webp', alt: 'x' };
    const p = coffeePreview({ ...kenya, amount_g: 1500 }, image);
    expect(p.description).toContain('1.5kg');
    expect(p.image).toBe(image);
  });
});

describe('waterPreview', () => {
  it('recipe mode', () => {
    expect(waterPreview({ mode: 'recipe', recipe: 'Holy Water', ml: 900, drops: { mg: 7, ca: 0, na: 1, k: 4 }, gh: 62.5, kh: 17.857 })).toEqual({
      title: 'Water: Holy Water',
      description: 'Lotus drop calculator\nWater: 900 mL\nCa: 0 drops\nMg: 7 drops\nNa: 1 drop\nK: 4 drops\nGH: 62.5 ppm\nKH: 17.9 ppm'
    });
  });
  it('drops mode ignores the recipe', () => {
    expect(waterPreview({ mode: 'drops', recipe: 'Holy Water', ml: 800, drops: { mg: 5, ca: 3, na: 0, k: 0 }, gh: 80.357, kh: 0 })).toEqual({
      title: 'Water: Custom drops',
      description: 'Lotus drop calculator\nWater: 800 mL\nCa: 3 drops\nMg: 5 drops\nNa: 0 drops\nK: 0 drops\nGH: 80.4 ppm\nKH: 0 ppm'
    });
  });
  it('target mode', () => {
    expect(waterPreview({ mode: 'target', recipe: 'x', ml: 800, drops: { mg: 4, ca: 4, na: 0, k: 0 }, gh: 80.357, kh: 0, target: { gh: 80, kh: 0 } })).toEqual({
      title: 'Water: Custom target',
      description: 'Lotus drop calculator\nWater: 800 mL\nTarget: GH 80 · KH 0 ppm\nCa: 4 drops\nMg: 4 drops\nNa: 0 drops\nK: 0 drops\nGH: 80.4 ppm\nKH: 0 ppm'
    });
  });
});

describe('onDeckPreview', () => {
  it('lists, handles empties and caps', () => {
    expect(onDeckPreview('open', 'all', [{ coffee_name: 'A', roaster: 'R1' }, { coffee_name: 'B', roaster: 'R2' }])).toEqual({ title: 'On Deck: Currently open', description: '1. R1 · A\n2. R2 · B' });
    expect(onDeckPreview('next', 'decaf', [])).toEqual({ title: 'On Deck: Next up · Decaf', description: 'Backlog is empty.' });
    expect(onDeckPreview('open', 'caffeinated', [])).toEqual({ title: 'On Deck: Currently open · Caffeinated', description: 'Nothing open right now.' });
    const many = Array.from({ length: 40 }, (_, i) => ({ coffee_name: `Coffee name number ${String(i + 1).padStart(2, '0')}`, roaster: 'R' }));
    const d = onDeckPreview('open', 'all', many).description;
    const lines = d.split('\n');
    expect(d.length).toBeLessThanOrEqual(300);
    expect(lines.at(-1)).toMatch(/…and \d+ more$/);
    for (const l of lines.slice(0, -1)) expect(l).toMatch(/^\d+\. /);
  });
});

describe('subscriptionsPreview', () => {
  const subs = [
    { subscription_name: 'Explorer Series: Origins of the World', roaster_service: 'A Very Long Roaster Service Name' },
    { subscription_name: 'Paused Monthly', roaster_service: 'Ceto', paused: 1, price: 22, next_renewal_date: null },
    { subscription_name: null, roaster_service: 'Sey' }
  ];
  it('one roaster · name line per subscription, no status', () => {
    expect(subscriptionsPreview(subs)).toEqual({
      title: 'Subscriptions',
      description: [
        '3 subscriptions',
        'A Very Long Roaster Service Name · Explorer Series: Origins of the World',
        'Ceto · Paused Monthly',
        'Sey'
      ].join('\n')
    });
  });
  it('handles none and caps', () => {
    expect(subscriptionsPreview([]).description).toBe('No subscriptions.');
    const many = Array.from({ length: 30 }, (_, i) => ({ subscription_name: `Subscription number ${i}`, roaster_service: 'Roaster' }));
    const d = subscriptionsPreview(many).description;
    expect(d.length).toBeLessThanOrEqual(300);
    expect(d.split('\n').at(-1)).toMatch(/…and \d+ more$/);
  });
});
