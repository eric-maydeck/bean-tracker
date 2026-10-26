import { describe, it, expect } from 'vitest';
import protobuf from 'protobufjs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildShareUrl } from './beanConquerorShare';
import type { CoffeeRow } from './types';
import type { RoastLevelRow } from './types';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function sampleCoffee(overrides: Partial<CoffeeRow> = {}): CoffeeRow {
  return {
    id: 1,
    roaster: 'Test Roasters',
    coffee_name: 'Sample Blend',
    origin: 'Ethiopia',
    roast_level: 'Light',
    processing: 'Washed',
    amount_g: 200,
    cost: 18,
    roast_date: '2026-06-01',
    frozen_start_date: null,
    frozen_end_date: null,
    rest_days_low: 10,
    rest_days_high: 20,
    image_url: null,
    product_url: null,
    slug: 'test-roasters-sample-blend',
    opened_date: null,
    drank: 0,
    status: 'backlog',
    moved_date: null,
    decaf: 0,
    subscription_id: null,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    ...overrides
  };
}

const roastLevels: RoastLevelRow[] = [
  { roast_level: 'Light', degrees_of_roast: 2.5 },
  { roast_level: 'Dark', degrees_of_roast: 5.0 }
];

// The share URL carries raw base64, as Bean Conqueror's own share links do;
// URLSearchParams reads its '+' as a space, so put them back like Bean
// Conqueror's intent handler does (userBeanJSON.replace(/ /g, '+')).
const shareBytes = (base64: string) => Buffer.from(base64.replace(/ /g, '+'), 'base64');

describe('buildShareUrl', () => {
  it('produces a beanconqueror.com URL with chunked shareUserBean params', async () => {
    const url = await buildShareUrl(sampleCoffee(), roastLevels);
    expect(url.startsWith('https://beanconqueror.com?')).toBe(true);
    expect(url).toContain('shareUserBean0=');
  });

  it('round-trips the coffee fields through the real BeanProto schema', async () => {
    const root = await protobuf.load(path.join(__dirname, 'beanconquerorBean.proto'));
    const BeanProto = root.lookupType('beanconqueror.BeanProto');

    const url = await buildShareUrl(sampleCoffee({ roaster: 'Round Trip Roasters', coffee_name: 'Trip Coffee', amount_g: 250, cost: 22, decaf: 1 }), roastLevels);
    const query = new URL(url).searchParams;
    let base64 = '';
    for (let i = 0; ; i++) {
      const part = query.get(`shareUserBean${i}`);
      if (part == null) break;
      base64 += part;
    }
    const bytes = shareBytes(base64);
    const decoded = BeanProto.decode(bytes) as unknown as {
      name: string;
      roaster: string;
      weight: number;
      cost: number;
      decaffeinated: boolean;
      roast_range: number;
      bean_roasting_type: number;
    };
    expect(decoded.name).toBe('Trip Coffee');
    expect(decoded.roaster).toBe('Round Trip Roasters');
    expect(decoded.weight).toBe(250);
    expect(decoded.cost).toBe(22);
    expect(decoded.decaffeinated).toBe(true);
    // 'Light' is 2.5 on this app's scale; floored (not rounded) to 2 since
    // the uint64 wire format can't carry the half-step.
    expect(decoded.roast_range).toBe(2);
    // Roast type is always Filter (BeanRoastingType.FILTER = 1).
    expect(decoded.bean_roasting_type).toBe(1);
  });

  // Regression test for the wire-type bug this schema once had: our .proto
  // was copied from Bean Conqueror's `develop` branch, where weight/cost are
  // `double` (wire type 1, fixed64), while their SHIPPED app (master/v8.7.0)
  // decodes them as `uint64` (wire type 0, varint). Their generated decoder
  // guards on the exact tag byte per field and silently skips anything whose
  // wire type differs, so weight/cost vanished on import with no error — and
  // our own round-trip test above couldn't catch it, because it decodes with
  // the very same (wrong) local schema.
  //
  // This second schema is defined independently, inline, with the varint
  // types Bean Conqueror's real decoder expects. If someone ever reintroduces
  // a `double`/`float` where upstream expects a varint, the bytes we emit
  // stop decoding here and this test fails.
  const BEANCONQUEROR_SHIPPED_SCHEMA = `
    syntax = "proto3";
    package beanconqueror_shipped;

    message BeanProto {
      string name = 1;
      optional string roaster = 5;
      optional uint64 roast_range = 8;
      optional uint64 weight = 12;
      optional uint64 cost = 14;
      optional bool decaffeinated = 17;
    }
  `;

  it('emits bytes that decode against an independent schema using Bean Conqueror\'s shipped varint wire types', async () => {
    const shippedRoot = protobuf.parse(BEANCONQUEROR_SHIPPED_SCHEMA).root;
    const ShippedBeanProto = shippedRoot.lookupType('beanconqueror_shipped.BeanProto');

    // Fractional amount/cost on purpose: a uint64 field can only carry whole
    // numbers, so buildShareUrl must round before encoding.
    const url = await buildShareUrl(
      sampleCoffee({
        roaster: 'Wire Type Roasters',
        coffee_name: 'Varint Coffee',
        amount_g: 250.4,
        cost: 21.6,
        decaf: 1,
        roast_level: 'Dark'
      }),
      roastLevels
    );
    const query = new URL(url).searchParams;
    let base64 = '';
    for (let i = 0; ; i++) {
      const part = query.get(`shareUserBean${i}`);
      if (part == null) break;
      base64 += part;
    }

    const decoded = ShippedBeanProto.decode(shareBytes(base64)) as unknown as {
      name: string;
      roaster: string;
      weight: number;
      cost: number;
      decaffeinated: boolean;
      roast_range: number;
    };
    expect(decoded.name).toBe('Varint Coffee');
    expect(decoded.roaster).toBe('Wire Type Roasters');
    expect(decoded.weight).toBe(250);
    expect(decoded.cost).toBe(22);
    expect(decoded.decaffeinated).toBe(true);
    expect(decoded.roast_range).toBe(5);
  });

  it('sets beanMix to Blend when the name says blend (any case), else Single Origin', async () => {
    const root = await protobuf.load(path.join(__dirname, 'beanconquerorBean.proto'));
    const BeanProto = root.lookupType('beanconqueror.BeanProto');
    const mixOf = async (coffee_name: string) => {
      const query = new URL(await buildShareUrl(sampleCoffee({ coffee_name }), roastLevels)).searchParams;
      let base64 = '';
      for (let i = 0; query.get(`shareUserBean${i}`) != null; i++) base64 += query.get(`shareUserBean${i}`);
      return (BeanProto.decode(shareBytes(base64)) as unknown as { beanMix: number }).beanMix;
    };
    expect(await mixOf('Holiday BLEND No. 2')).toBe(2);
    expect(await mixOf('Espresso blend')).toBe(2);
    expect(await mixOf('Ethiopia Guji')).toBe(1);
  });

  it('maps roast_level to roast_range via the matching roast_levels.degrees_of_roast entry', async () => {
    const root = await protobuf.load(path.join(__dirname, 'beanconquerorBean.proto'));
    const BeanProto = root.lookupType('beanconqueror.BeanProto');
    const url = await buildShareUrl(sampleCoffee({ roast_level: 'Dark' }), roastLevels);
    const query = new URL(url).searchParams;
    let base64 = '';
    for (let i = 0; ; i++) {
      const part = query.get(`shareUserBean${i}`);
      if (part == null) break;
      base64 += part;
    }
    const decoded = BeanProto.decode(shareBytes(base64)) as unknown as { roast_range: number };
    expect(decoded.roast_range).toBe(5);
  });

  // Regression test for a real live-testing report: 'Light' (2.5 on this
  // app's scale) was rounding to Bean Conqueror's "3", which read as
  // visibly darker than intended in their app. Floors instead, so a
  // half-step roast level always maps to the lighter of its two
  // neighboring whole numbers rather than the darker one.
  it('floors a half-step roast_level rather than rounding to the nearest whole number', async () => {
    const root = await protobuf.load(path.join(__dirname, 'beanconquerorBean.proto'));
    const BeanProto = root.lookupType('beanconqueror.BeanProto');
    const url = await buildShareUrl(sampleCoffee({ roast_level: 'Light' }), roastLevels);
    const query = new URL(url).searchParams;
    let base64 = '';
    for (let i = 0; ; i++) {
      const part = query.get(`shareUserBean${i}`);
      if (part == null) break;
      base64 += part;
    }
    const decoded = BeanProto.decode(shareBytes(base64)) as unknown as { roast_range: number };
    expect(decoded.roast_range).toBe(2);
  });
});
