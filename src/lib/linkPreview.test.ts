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
  it('formats kg and passes the image', () => {
    const image = { src: 'https://o/a.webp', alt: 'x' };
    const p = coffeePreview({ ...kenya, amount_g: 1500 }, image);
    expect(p.description).toContain('1.5kg');
    expect(p.image).toBe(image);
  });
});

describe('waterPreview', () => {
  it('recipe mode', () => {
    expect(waterPreview({ mode: 'recipe', recipe: 'Holy Water', ml: 900, drops: { mg: 7, ca: 0, na: 0, k: 4 }, gh: 62.5, kh: 17.857 })).toEqual({
      title: 'Water: Holy Water',
      description: 'Lotus drop calculator\n900 mL: Ca 0 · Mg 7 · Na 0 · K 4 drops\nGH 62.5 · KH 17.9 ppm'
    });
  });
  it('drops mode ignores the recipe', () => {
    expect(waterPreview({ mode: 'drops', recipe: 'Holy Water', ml: 800, drops: { mg: 5, ca: 3, na: 0, k: 0 }, gh: 80.357, kh: 0 })).toEqual({
      title: 'Water: Custom drops',
      description: 'Lotus drop calculator\n800 mL: Ca 3 · Mg 5 · Na 0 · K 0 drops\nGH 80.4 · KH 0 ppm'
    });
  });
  it('target mode', () => {
    expect(waterPreview({ mode: 'target', recipe: 'x', ml: 800, drops: { mg: 4, ca: 4, na: 0, k: 0 }, gh: 80.357, kh: 0, target: { gh: 80, kh: 0 } })).toEqual({
      title: 'Water: Custom target',
      description: 'Lotus drop calculator\nTarget GH 80 · KH 0 ppm\n800 mL: Ca 4 · Mg 4 · Na 0 · K 0 drops\nGH 80.4 · KH 0 ppm'
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
    { subscription_name: 'Explorer Series: Origins of the World', roaster_service: 'A Very Long Roaster Service Name', bag_count: 2, amount_per_bag_g: 250, price: 44.5, paused: 0, next_renewal_date: '2026-11-15' },
    { subscription_name: 'Paused Monthly', roaster_service: 'Ceto', bag_count: 1, amount_per_bag_g: 250, price: 22, paused: 1, next_renewal_date: null },
    { subscription_name: null, roaster_service: 'Sey', bag_count: 1, amount_per_bag_g: 250, price: 30, paused: 0, next_renewal_date: '2026-11-01' }
  ];
  it('one line per subscription', () => {
    expect(subscriptionsPreview(subs)).toEqual({
      title: 'Subscriptions',
      description: [
        '3 subscriptions · 1 paused',
        'A Very Long Roaster Service Name · Explorer Series: Origins of the World · 2 × 250g · $44.50 · Renews 2026-11-15',
        'Ceto · Paused Monthly · 1 × 250g · $22.00 · Paused',
        'Sey · 1 × 250g · $30.00 · Renews 2026-11-01'
      ].join('\n')
    });
  });
  it('skips missing parts and handles none paused / empty', () => {
    const p = subscriptionsPreview([{ ...subs[2], price: null, bag_count: null, next_renewal_date: null }, subs[0]]);
    expect(p.description.split('\n')[0]).toBe('2 subscriptions');
    expect(p.description.split('\n')[1]).toBe('Sey');
    // A zero count or size never shows as "0 × 0g".
    expect(subscriptionsPreview([{ ...subs[2], bag_count: 0, amount_per_bag_g: 0 }]).description.split('\n')[1]).toBe('Sey · $30.00 · Renews 2026-11-01');
    expect(subscriptionsPreview([]).description).toBe('No subscriptions.');
  });
});

describe('coffeesPreview', () => {
  it('summarises the view', () => {
    expect(coffeesPreview({ count: 23, status: ['backlog'], query: '', chips: [] })).toEqual({ title: 'Coffee Collection', description: '23 coffees · Backlog' });
    expect(coffeesPreview({ count: 1, status: ['open', 'archive'], query: 'gesha', chips: ['Origin: Kenya', 'Process: Washed'] }).description).toBe('1 coffee · Open + Archive · Origin: Kenya · Process: Washed · “gesha”');
    expect(coffeesPreview({ count: 5, status: ['all'], query: '', chips: [] }).description).toBe('5 coffees · All');
  });
});

describe('statsPreview', () => {
  it('summarises per tab', () => {
    const v = { tab: 'general' as const, opened: 4, unopened: 6, onHandG: 3200, finished: 12 };
    expect(statsPreview(v)).toEqual({ title: 'Stats: General', description: '4 open · 6 unopened · 3.2kg on hand · 12 finished' });
    expect(statsPreview({ ...v, tab: 'bq' }).title).toBe('Stats: Bean Conqueror');
  });
});
