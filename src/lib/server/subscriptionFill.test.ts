import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { parseShopifyProduct } from './productParse';
import { parseBags, parseRenewalDay, buildSubscriptionFill } from './subscriptionFill';

// The six subscriptions' real Shopify product JSON, captured 2026-10-08.
const page = (name: string, currency = 'USD') =>
  parseShopifyProduct(
    JSON.parse(readFileSync(new URL(`./fixtures/product-pages/sub-${name}.json`, import.meta.url), 'utf8')),
    { currency }
  );
const ctx = (url: string) => ({ url, history: [], rates: { date: '2026-10-08', rates: { GBP: 0.75 } } });

describe('parseBags', () => {
  it.each([
    ['3x 100g bags (300g total)', 3, 100],
    ['2 bags, 250g (8.8oz) each', 2, 250],
    ['1 bag, 125g (4.4oz)', 1, 125],
    ['3 x 200g Bag', 3, 200],
    ['1 x 1kg Bag', 1, 1000],
    ['Lil Bit Of Everything Subscription x2 (20gx8)', 8, 20],
    ['- 2 x 60g bags of coffee (120g total) of the same coffee', 2, 60],
    ['4x125g bag sub: 4 bags of lightly roasted coffee', 4, 125],
    ['4 bag', 4, null],
    ['2 tins', 2, null]
  ])('%s -> %s × %s', (text, bags, grams) => {
    expect(parseBags(text)).toEqual({ bags, gramsPerBag: grams });
  });

  it.each(['norml coffee ppl subscription - 120g (4.23oz)', '(300g total)', 'Default Title', '', '3x coffees'])(
    '%s -> nothing',
    (text) => {
      expect(parseBags(text)).toEqual({ bags: null, gramsPerBag: null });
    }
  );

  it('prefers the match with the given bag count', () => {
    expect(parseBags('2x125g bag sub ... 4x150g bag sub', 4)).toEqual({ bags: 4, gramsPerBag: 150 });
    expect(parseBags('2x125g bag sub', 4)).toEqual({ bags: 2, gramsPerBag: 125 });
  });
});

describe('parseRenewalDay', () => {
  it.each([
    ['Orders close on the 1st. Renewal on the 1st.', 1],
    ['Subscriptions renew on the 10th of each month', 10],
    ['billed the 5th of every month', 5],
    ['will be billed by the 14th of every month', 14],
    ['Ships out on the 15th.', null],
    ['First Friday of the month', null],
    ['renews on the 45th', null]
  ])('%s -> %s', (text, day) => {
    expect(parseRenewalDay(text)).toBe(day);
  });
});

describe('buildSubscriptionFill (real pages)', () => {
  it('Airworks: two variants, bags and g/bag from the labels, renewal 1', () => {
    const f = buildSubscriptionFill(page('airworks'), ctx('https://airworkscoffee.com/products/ultralight-sub'));
    expect(f.fields).toEqual({
      roaster_service: 'Airworks Coffee',
      subscription_name: 'Ultralight Subscription',
      renewal_day: 1
    });
    expect(f.variants).toEqual([
      { label: '3x 100g bags (300g total)', price: 48, originalPrice: null, bags: 3, gramsPerBag: 100 },
      { label: '3x 200g bags (600g total)', price: 80, originalPrice: null, bags: 3, gramsPerBag: 200 }
    ]);
    expect(f.selected).toBeNull();
    expect(f.notes).toContain('pick an option below');
  });

  it('H&S: the 2 × 250g variant, renewal 10', () => {
    const f = buildSubscriptionFill(page('hs'), ctx('https://hscoffeeroasters.com/products/roasters-choice-subscription'));
    expect(f.fields.subscription_name).toBe("Roaster's Choice Subscription");
    expect(f.fields.renewal_day).toBe(10);
    expect(f.variants[3]).toEqual({ label: '2 bags, 250g (8.8oz) each', price: 56, originalPrice: null, bags: 2, gramsPerBag: 250 });
    expect(f.variants[0]).toMatchObject({ bags: 1, gramsPerBag: 125, price: 16 });
  });

  it('Shoebox: count from the variant, 125g from the description, renewal 5', () => {
    const f = buildSubscriptionFill(page('shoebox'), ctx('https://shoebox.coffee/products/shoebox-monthly-subscription'));
    expect(f.fields).toMatchObject({ subscription_name: 'Shoebox Monthly Subscription', renewal_day: 5 });
    expect(f.variants).toEqual([
      { label: '2 bag', price: 32, originalPrice: null, bags: 2, gramsPerBag: 125 },
      { label: '4 bag', price: 58, originalPrice: null, bags: 4, gramsPerBag: 125 }
    ]);
  });

  it('norml: single variant applied, 2 × 60g from the description (not the title total), renewal 14', () => {
    const f = buildSubscriptionFill(page('norml'), ctx('https://normlppl.coffee/products/norml-subscription'));
    expect(f.fields).toEqual({
      roaster_service: 'norml coffee ppl',
      subscription_name: 'norml coffee ppl subscription',
      price: 38.95,
      bag_count: 2,
      amount_per_bag_g: 60,
      renewal_day: 14
    });
    expect(f.variants).toEqual([]);
  });

  it('Scenery: GBP converted to USD, no renewal day', () => {
    const f = buildSubscriptionFill(page('scenery', 'GBP'), ctx('https://scenery.coffee/products/light-sub'));
    expect(f.fields.renewal_day).toBeUndefined();
    expect(f.variants[2]).toEqual({ label: '3 x 200g Bag', price: 56, originalPrice: '£42.00 GBP', bags: 3, gramsPerBag: 200 });
    expect(f.notes).toContain('renewal day not found');
    expect(f.notes).toContain('prices converted from GBP (rate 2026-10-08)');
  });

  it('Ceto: 8 × 20g from the title, $32, title bag text dropped from the name', () => {
    const f = buildSubscriptionFill(
      page('ceto'),
      ctx('https://ceto.coffee/products/lil-bit-of-everything-subscription-x1-20gx4-copy')
    );
    expect(f.fields).toEqual({
      roaster_service: 'CETO',
      subscription_name: 'Lil Bit Of Everything Subscription x2',
      price: 32,
      bag_count: 8,
      amount_per_bag_g: 20
    });
  });

  it('uses an existing subscription on the same site for the roaster name', () => {
    const f = buildSubscriptionFill(page('hs'), {
      ...ctx('https://hscoffeeroasters.com/products/roasters-choice-subscription'),
      history: [{ roaster: 'H&S Coffee Roasters', product_url: 'https://hscoffeeroasters.com/products/x' }]
    });
    expect(f.fields.roaster_service).toBe('H&S Coffee Roasters');
  });

  it('applies the variant named in the URL', () => {
    const p = page('airworks');
    p.variants[1].id = 42;
    const f = buildSubscriptionFill(p, ctx('https://airworkscoffee.com/products/ultralight-sub?variant=42'));
    expect(f.selected).toBe(1);
    expect(f.fields).toMatchObject({ price: 80, bag_count: 3, amount_per_bag_g: 200 });
  });

  it('leaves the price blank when the currency cannot be converted', () => {
    const f = buildSubscriptionFill({ ...page('norml'), currency: 'EUR' }, ctx('https://normlppl.coffee/products/norml-subscription'));
    expect(f.fields.price).toBeUndefined();
    expect(f.notes.some((n) => n.includes("couldn't convert to USD"))).toBe(true);
  });
});
