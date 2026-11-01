import { describe, expect, it } from 'vitest';
import { RECIPE_PREVIEW_MAX, recipePreview, recipesPreview, absoluteImage, coffeePreview, coffeesPreview, fitList, onDeckPreview, ownerName, plural, statsPreview, subscriptionsPreview, waterPreview } from './linkPreview';

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
    expect(waterPreview({ tip: 'round', mode: 'recipe', recipe: 'Holy Water', ml: 900, drops: { mg: 7, ca: 0, na: 1, k: 4 }, gh: 62.5, kh: 17.857, target: { gh: 60, kh: 20 }, idealMl: 800 })).toEqual({
      title: 'Water: Holy Water',
      description: 'Lotus drop calculator\nWater: 900mL (recipe 800mL)\nDropper: Round tip\nCa: 0 drops\nMg: 7 drops\nNa: 1 drop\nK: 4 drops\nGH: 62.5ppm (recipe 60ppm)\nKH: 17.9ppm (recipe 20ppm)'
    });
  });
  it('drops mode ignores the recipe', () => {
    expect(waterPreview({ tip: 'round', mode: 'drops', recipe: 'Holy Water', ml: 800, drops: { mg: 5, ca: 3, na: 0, k: 0 }, gh: 80.357, kh: 0 })).toEqual({
      title: 'Water: Custom drops',
      description: 'Lotus drop calculator\nWater: 800mL\nDropper: Round tip\nCa: 3 drops\nMg: 5 drops\nNa: 0 drops\nK: 0 drops\nGH: 80.4ppm\nKH: 0ppm'
    });
  });
  it('target mode', () => {
    expect(waterPreview({ tip: 'round', mode: 'target', recipe: 'x', ml: 800, drops: { mg: 4, ca: 4, na: 0, k: 0 }, gh: 80.357, kh: 0, target: { gh: 80, kh: 0 } })).toEqual({
      title: 'Water: Custom target',
      description: 'Lotus drop calculator\nWater: 800mL\nDropper: Round tip\nCa: 4 drops\nMg: 4 drops\nNa: 0 drops\nK: 0 drops\nGH: 80.4ppm (target 80ppm)\nKH: 0ppm (target 0ppm)'
    });
  });
});

describe('waterPreview tip', () => {
  const base = { mode: 'drops' as const, recipe: 'x', ml: 800, drops: { mg: 7, ca: 7, na: 4, k: 4 }, gh: 80, kh: 20 };
  it('names the tip in every mode', () => {
    for (const mode of ['recipe', 'drops', 'target'] as const) {
      expect(waterPreview({ ...base, mode, tip: 'precision' }).description).toContain('\nWater: 800mL\nDropper: Precision\nCa: 7 drops');
      expect(waterPreview({ ...base, mode, tip: 'round' }).description).toContain('\nWater: 800mL\nDropper: Round tip\nCa: 7 drops');
    }
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

describe('coffeesPreview', () => {
  it('status, then filters, then count and weight', () => {
    expect(coffeesPreview({ count: 99, grams: 11300, status: ['backlog', 'open'], query: '', chips: ['Caffeinated only', 'Not frozen'] })).toEqual({
      title: 'Coffee Collection', description: 'Backlog + Open\nCaffeinated only · Not frozen\n99 coffees · 11.3kg'
    });
  });
  it('skips the filters line when there are none; keeps the search', () => {
    expect(coffeesPreview({ count: 1, grams: 250, status: ['backlog'], query: '', chips: [] }).description).toBe('Backlog\n1 coffee · 250g');
    expect(coffeesPreview({ count: 2, grams: 500, status: ['all'], query: ' gesha ', chips: ['Origin: Kenya'] }).description).toBe('All\nOrigin: Kenya · “gesha”\n2 coffees · 500g');
  });
});

describe('ownerName / statsPreview', () => {
  it('names the owner from the host', () => {
    expect(ownerName('coffee.maydeck.net')).toBe('Eric');
    for (const h of ['fuhnoo.coffee', 'localhost:4173', '192.0.2.5:5173']) expect(ownerName(h)).toBe('fuhnoo');
  });
  it('stats previews: summary then numbers', () => {
    const v = { owner: 'Eric', opened: 3, unopened: 5, onHandG: 1500, finished: 40 };
    expect(statsPreview({ ...v, tab: 'general' })).toEqual({ title: 'Stats: General', description: "Eric's collection totals\n3 open · 5 unopened · 1.5kg on hand · 40 finished" });
    expect(statsPreview({ ...v, owner: 'fuhnoo', tab: 'bq' })).toEqual({ title: 'Stats: Bean Conqueror', description: "fuhnoo's Bean Conqueror stats\n3 open · 5 unopened · 1.5kg on hand · 40 finished" });
  });
});

describe('recipesPreview', () => {
  it('lists recipe names, or says there are none', () => {
    expect(recipesPreview(['A', 'B'])).toEqual({ title: 'Recipes', description: '2 recipes\nA\nB' });
    expect(recipesPreview([]).description).toBe('No saved recipes.');
  });
});

describe('recipePreview', () => {
  const base = { name: 'Floral', description: 'Two blooms · ~1:16', steps: '0:00 - bloom\n0:45 - pour', tempNotes: '93°C · rinse', n: 311, avgRating: 7.1 };
  it('lists the one-liner, steps, temperature and notes, then the brew stats', () => {
    expect(recipePreview(base)).toEqual({ title: 'Floral', description: 'Two blooms · ~1:16\n0:00 - bloom\n0:45 - pour\n93°C · rinse\n311 brews · avg 7.1' });
    expect(recipePreview({ ...base, tempNotes: null }).description).toBe('Two blooms · ~1:16\n0:00 - bloom\n0:45 - pour\n311 brews · avg 7.1');
    expect(recipePreview({ ...base, steps: '', tempNotes: null, n: 1, avgRating: null }).description).toBe('Two blooms · ~1:16\n1 brew');
  });
  it('drops the one-liner first when over the budget, then truncates', () => {
    const steps = Array.from({ length: 6 }, (_, i) => `${i}:00 - ${'pour '.repeat(9).trim()}`).join('\n');
    const d = recipePreview({ ...base, steps, description: 'x'.repeat(40) }).description;
    expect(d).not.toContain('xxx');
    expect(d.length).toBeLessThanOrEqual(RECIPE_PREVIEW_MAX);
    const long = recipePreview({ ...base, steps: 'y'.repeat(400) }).description;
    expect(long).toHaveLength(RECIPE_PREVIEW_MAX);
    expect(long.endsWith('…')).toBe(true);
  });
});
