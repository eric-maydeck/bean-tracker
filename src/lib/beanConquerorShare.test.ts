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
    slug: 'test-roasters-sample-blend',
    opened_date: null,
    drank: 0,
    status: 'backlog',
    moved_date: null,
    decaf: 0,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    ...overrides
  };
}

const roastLevels: RoastLevelRow[] = [
  { roast_level: 'Light', degrees_of_roast: 2.5 },
  { roast_level: 'Dark', degrees_of_roast: 5.0 }
];

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
    const bytes = Buffer.from(base64, 'base64');
    const decoded = BeanProto.decode(bytes) as unknown as {
      name: string;
      roaster: string;
      weight: number;
      cost: number;
      decaffeinated: boolean;
      roast_range: number;
    };
    expect(decoded.name).toBe('Trip Coffee');
    expect(decoded.roaster).toBe('Round Trip Roasters');
    expect(decoded.weight).toBe(250);
    expect(decoded.cost).toBe(22);
    expect(decoded.decaffeinated).toBe(true);
    expect(decoded.roast_range).toBe(3);
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
    const decoded = BeanProto.decode(Buffer.from(base64, 'base64')) as unknown as { roast_range: number };
    expect(decoded.roast_range).toBe(5);
  });
});
