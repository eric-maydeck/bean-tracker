// src/lib/server/beanConquerorJson.test.ts
import { describe, it, expect } from 'vitest';
import {
  bcTimestamp, bcRoastDate, parseBeanConquerorJson, readBeanConquerorZip, BeanConquerorZipError
} from './beanConquerorJson';
import { importBeanConquerorData } from './beanconqueror';
import { createCoffee } from './coffees';
import { createDb } from './db';
import { fixtureFiles, fixtureText, fixtureZip, zipOf } from './fixtures/beanconqueror/fixture';

type Json = Record<string, any>; // test-only access to the raw export
const main = (f: ReturnType<typeof fixtureFiles>) => f.main as Json;

describe('bcTimestamp', () => {
  it('writes the America/Denver wall clock with a Z, matching the xlsx-era rows', () => {
    expect(bcTimestamp(1736946000)).toBe('2025-01-15T06:00:00.000Z'); // MST
    expect(bcTimestamp(1752589800)).toBe('2025-07-15T08:30:00.000Z'); // MDT
  });
  it('writes local midnight as 00, not 24', () => {
    expect(bcTimestamp(Date.UTC(2026, 6, 1, 6) / 1000)).toBe('2026-07-01T00:00:00.000Z');
  });
});

describe('bcRoastDate', () => {
  it('keeps a date-only value and takes the local date of a full timestamp', () => {
    expect(bcRoastDate('2025-06-20')).toBe('2025-06-20');
    expect(bcRoastDate('2025-01-16T03:41:12.500Z')).toBe('2025-01-15');
  });
  it('returns null for empty or unreadable values', () => {
    for (const v of ['', undefined, null, 'soon', 42]) expect(bcRoastDate(v)).toBeNull();
  });
});

describe('parseBeanConquerorJson', () => {
  const parsed = parseBeanConquerorJson(fixtureFiles());
  const brew = (uuid: string) => parsed.brews.find((b) => b.bcUuid === uuid)!;

  it('reads every entity, brews from both files', () => {
    expect({
      beans: parsed.beans.length, origins: parsed.beanOrigins.length, methods: parsed.methods.length,
      grinders: parsed.grinders.length, waters: parsed.waters!.length, brews: parsed.brews.length
    }).toEqual({ beans: 10, origins: 10, methods: 14, grinders: 3, waters: 17, brews: 68 });
  });

  it('maps a bean like the xlsx import stored it', () => {
    expect(parsed.beans.find((b) => b.id === '03f16a50-741b-442b-acb4-c00e2ab3b622')).toEqual({
      id: '03f16a50-741b-442b-acb4-c00e2ab3b622', name: '101 - Sample Ridge Lot', roaster: 'Sample Roasters',
      roastDate: '2024-07-24', roastType: 'Filter', degreeOfRoast: 2, customDegreeOfRoast: null,
      blend: 'Single Origin', weightG: 200, cost: 41.8, aromatics: null, cuppingPoints: null,
      decaffeinated: false, url: null, eanArticleNumber: null, notes: null, rating: 7,
      bcCreatedAt: '2024-08-15T20:36:39.000Z', bcArchived: true
    });
    expect(parsed.beanOrigins.find((o) => o.beanId === '03f16a50-741b-442b-acb4-c00e2ab3b622')).toMatchObject({
      componentNumber: 1, country: 'Ethiopia', processing: 'Natural', region: null, percentage: null
    });
  });

  it('maps bean labels, decaf and a date-only roast date', () => {
    const bean = (id: string) => parsed.beans.find((b) => b.id === id)!;
    expect(bean('dd362ea7-4ab2-486f-a146-ed67ea4f8bb1').blend).toBe('Blend');
    expect(bean('41443c78-01fa-4389-a527-a84310f7c4f4').decaffeinated).toBe(true);
    expect(bean('c96f13f6-a7ba-4e8f-a1b8-3661f14ddc06')).toMatchObject({
      roastDate: '2025-02-25', blend: null, roastType: null, bcArchived: false
    });
  });

  it('maps a preparation, a mill and a water', () => {
    expect(parsed.methods.find((m) => m.id === '94687711-12cc-449f-afe3-0117459f8177')).toEqual({
      id: '94687711-12cc-449f-afe3-0117459f8177', preparationMethod: 'V60', name: 'Cone Dripper - Paper A',
      preparationStyle: 'POUR OVER', preparationTools: 'Paper A', notes: null, bcArchived: false,
      bcCreatedAt: '2024-08-12T23:50:00.000Z'
    });
    expect(parsed.grinders.find((g) => g.id === '61c23d36-8129-4642-adb7-a94757da0d57')).toEqual({
      id: '61c23d36-8129-4642-adb7-a94757da0d57', name: 'Hand Grinder A (Sample)', notes: null, bcArchived: false,
      bcCreatedAt: '2024-08-12T23:50:10.000Z'
    });
    expect(parsed.waters!.find((w) => w.id === '71073031-615b-4d58-a92e-b7469089d4fa')).toEqual({
      id: '71073031-615b-4d58-a92e-b7469089d4fa', name: 'Drop Mix A - bright',
      calcium: 10, magnesium: 7.5, sodium: 3.1, potassium: 2.8, chloride: 40.2, sulfate: 0, tds: 0,
      storedGh: 55, storedGhType: 'PPM', storedKh: 12, storedKhType: 'PPM', type: 'CUSTOM_WATER',
      note: 'Mg 3, Ca 2, Na 1, K 1', bcArchived: false
    });
  });

  it('maps a brew with every field the import keeps', () => {
    expect(brew('5d4e1700-b578-436c-a381-fe0472143f1a')).toEqual({
      bcUuid: '5d4e1700-b578-436c-a381-fe0472143f1a', bcCreatedAt: '2024-07-24T13:13:37.000Z',
      beanId: '6f81941d-d82c-468a-a84b-aac2ace069c0', preparationId: '94687711-12cc-449f-afe3-0117459f8177',
      millId: '61c23d36-8129-4642-adb7-a94757da0d57', grindSetting: '1.5.5', groundCoffeeG: 15,
      brewTemperature: 90, beanType: 'Mirador Sample Lot', grindSpeedRpm: 0, grindTime: '0', profile: null,
      preparationTools: null, temperatureTime: '0', brewTime: '150', bloomTime: '45', firstDripTime: '0',
      waterAmountG: 240, coffeeType: null, coffeeConcentration: null, rating: 6, notes: null,
      beverageQuantity: 0, tdsPercent: 0, extractionYieldPercent: 0, brewRatio: '1 / 16.00', beanAgeDays: 21,
      bcArchived: true, water: 'Packet Profile - third strength',
      waterId: 'fca07f5d-1244-452a-b022-777f37b1584a', bestBrew: true, favourite: false, vesselName: null,
      hasFlowProfile: false
    });
  });

  it('computes the ratio from the beverage when there is no water amount, and null at dose 0', () => {
    expect(brew('da1ff7be-70d7-4cab-ae3b-47151ac679a9')).toMatchObject({
      bcCreatedAt: '2024-09-13T16:59:05.000Z', brewRatio: '1 / 10.00'
    });
    expect(brew('2b47b5ec-5269-4e5d-a632-7c4e6b5a1734').brewRatio).toBeNull();
  });

  it('keeps both brews of a same-second same-bean pair, and brews without water', () => {
    const a = brew('4f3b0d02-cf2e-466e-a022-991984ae325d');
    const b = brew('53bcdf62-ef68-4a54-a2db-e65785463053');
    expect([a.bcCreatedAt, a.beanId]).toEqual([b.bcCreatedAt, b.beanId]);
    expect(brew('f8d2646d-dc56-4181-ad24-711aa70e3865')).toMatchObject({ waterId: null, water: null });
  });

  it('reads the flags', () => {
    expect(parsed.brews.filter((b) => b.bestBrew)).toHaveLength(9);
    expect(parsed.brews.filter((b) => b.hasFlowProfile)).toHaveLength(55);
  });

  it('drops a water UUID that is not in WATER (no foreign-key failure later)', () => {
    const files = fixtureFiles();
    main(files).BREWS[0].water = 'not-a-water';
    expect(parseBeanConquerorJson(files).brews.find((b) => b.bcUuid === main(files).BREWS[0].config.uuid))
      .toMatchObject({ waterId: null, water: null });
  });

  it('nulls bean, preparation and mill links that were not parsed, and imports without an FK error', () => {
    const files = fixtureFiles();
    const m = main(files);
    m.BREWS[0].bean = 'not-a-bean';
    m.BREWS[1].method_of_preparation = 'not-a-method';
    m.BREWS[2].mill = 'not-a-mill';
    const nameless = m.BEANS[0];
    delete nameless.name; // parser skips nameless beans
    const orphan = m.BREWS.find((b: Json, i: number) => i > 2 && b.bean === nameless.config.uuid);
    const parsed = parseBeanConquerorJson(files);
    const byUuid = (i: number) => parsed.brews.find((b) => b.bcUuid === m.BREWS[i].config.uuid);
    expect(byUuid(0)).toMatchObject({ beanId: null });
    expect(byUuid(1)).toMatchObject({ preparationId: null });
    expect(byUuid(2)).toMatchObject({ millId: null });
    expect(parsed.beans.some((b) => b.id === nameless.config.uuid)).toBe(false);
    if (orphan) expect(parsed.brews.find((b) => b.bcUuid === orphan.config.uuid)?.beanId).toBeNull();
    expect(parsed.brews.every((b) => !b.beanId || parsed.beans.some((x) => x.id === b.beanId))).toBe(true);
    expect(() => importBeanConquerorData(createDb(':memory:'), parsed)).not.toThrow();
  });

  it('tolerates missing optional fields', () => {
    const files = fixtureFiles();
    const raw = main(files).BREWS[0];
    for (const k of ['vessel_name', 'best_brew', 'favourite', 'flow_profile', 'coffee_first_drip_time', 'water']) delete raw[k];
    expect(parseBeanConquerorJson(files).brews.find((b) => b.bcUuid === raw.config.uuid)).toMatchObject({
      vesselName: null, bestBrew: false, favourite: false, hasFlowProfile: false, firstDripTime: null, waterId: null
    });
  });

  it('skips a brew whose uuid is blank', () => {
    const files = fixtureFiles();
    const raw = main(files).BREWS[0];
    raw.config.uuid = '  ';
    const parsed = parseBeanConquerorJson(files);
    expect(parsed.brews.some((b) => !b.bcUuid)).toBe(false);
    expect(parsed.brews).toHaveLength(67);
  });

  it('numbers blend components, skipping empty ones', () => {
    const files = fixtureFiles();
    const bean = main(files).BEANS[0];
    bean.bean_information = [{ country: 'Brazil' }, { country: '', processing: '' }, { country: 'Colombia', percentage: 40 }];
    const origins = parseBeanConquerorJson(files).beanOrigins.filter((o) => o.beanId === bean.config.uuid);
    expect(origins.map((o) => [o.componentNumber, o.country, o.percentage])).toEqual([[1, 'Brazil', null], [3, 'Colombia', 40]]);
  });

  it('rejects something that is not a Bean Conqueror export', () => {
    expect(() => parseBeanConquerorJson({ main: { hello: 1 }, brewFiles: [] })).toThrow(/doesn't look like a Bean Conqueror export/);
    expect(() => parseBeanConquerorJson({ main: main(fixtureFiles()), brewFiles: [{}] })).toThrow(/Brews file/);
  });
});

describe('JSON import over an xlsx-imported database', () => {
  it('updates rows in place: links kept, every brew gets its UUID, re-import changes nothing', () => {
    const db = createDb(':memory:');
    const parsed = parseBeanConquerorJson(fixtureFiles());
    // Fakes the xlsx import by stripping fields from the JSON parse.
    // What the xlsx import of the same data left: no UUIDs, waters or new fields.
    const legacy = {
      ...parsed,
      waters: [],
      brews: parsed.brews.map(({ bcUuid, waterId, bestBrew, favourite, vesselName, hasFlowProfile, ...rest }) => rest)
    };
    importBeanConquerorData(db, legacy);
    const count = (sql: string) => (db.prepare(sql).get() as { n: number }).n;
    expect(count('SELECT COUNT(*) n FROM beanconqueror_brews')).toBe(67); // the same-second pair merged
    const { id: coffeeId } = createCoffee(db, {
      roaster: 'Sample Roasters', coffee_name: 'Sample Ridge Lot', origin: null, roast_level: null, processing: null, amount_g: null,
      cost: null, roast_date: null, frozen_start_date: null, frozen_end_date: null, rest_days_low: null,
      rest_days_high: null, image_url: null
    });
    db.prepare(`UPDATE beanconqueror_beans SET coffee_id = ? WHERE id = ?`).run(coffeeId, '03f16a50-741b-442b-acb4-c00e2ab3b622');
    const legacyIds = (db.prepare(`SELECT id FROM beanconqueror_brews ORDER BY id`).all() as { id: number }[]).map((r) => r.id);

    for (let i = 0; i < 2; i++) {
      importBeanConquerorData(db, parsed);
      expect(count('SELECT COUNT(*) n FROM beanconqueror_brews')).toBe(68);
      expect(count('SELECT COUNT(*) n FROM beanconqueror_brews WHERE bc_uuid IS NULL')).toBe(0);
      expect(count('SELECT COUNT(*) n FROM beanconqueror_beans')).toBe(10);
      expect(count('SELECT COUNT(*) n FROM beanconqueror_waters')).toBe(17);
      expect(db.prepare(`SELECT coffee_id FROM beanconqueror_beans WHERE id = ?`).get('03f16a50-741b-442b-acb4-c00e2ab3b622'))
        .toEqual({ coffee_id: coffeeId });
      const ids = (db.prepare(`SELECT id FROM beanconqueror_brews ORDER BY id`).all() as { id: number }[]).map((r) => r.id);
      expect(ids.slice(0, 67)).toEqual(legacyIds); // legacy rows updated in place, one inserted
    }
  });
});

const brewCount = async (data: Uint8Array) =>
  parseBeanConquerorJson(await readBeanConquerorZip(data)).brews.length;

describe('readBeanConquerorZip', () => {
  it('reads the regular export', async () => {
    expect(await brewCount(await fixtureZip())).toBe(68);
  });

  it('reads Beanconqueror.zip inside the full export, ignoring photos and flow profiles', async () => {
    const full = await zipOf({
      'Beanconqueror.zip': await fixtureZip(),
      'brews/4f3b0d02-cf2e-466e-a022-991984ae325d_flow_profile.json': '{"weight":[]}',
      'photo_c82d5c0d.jpg': 'not really a jpeg'
    });
    expect(await brewCount(full)).toBe(68);
  });

  it('ignores macOS resource-fork entries', async () => {
    const zip = await zipOf({
      'Beanconqueror.json': fixtureText('Beanconqueror.json'),
      'Beanconqueror_Brews_1.json': fixtureText('Beanconqueror_Brews_1.json'),
      '__MACOSX/._Beanconqueror.json': 'binary junk',
      '__MACOSX/._Beanconqueror_Brews_1.json': 'binary junk'
    });
    expect(await brewCount(zip)).toBe(68);
  });

  it('rejects a file that is not a zip', async () => {
    await expect(readBeanConquerorZip(new TextEncoder().encode('hello'))).rejects.toThrow(
      new BeanConquerorZipError('Could not read that file as a .zip')
    );
  });

  it('rejects a zip without Beanconqueror.json', async () => {
    await expect(readBeanConquerorZip(await zipOf({ 'notes.txt': 'hi' }))).rejects.toThrow(
      /isn't a Bean Conqueror export/
    );
  });

  it('rejects malformed JSON', async () => {
    await expect(readBeanConquerorZip(await zipOf({ 'Beanconqueror.json': '{nope' }))).rejects.toThrow(
      /Beanconqueror.json is not valid JSON/
    );
  });

  it('rejects JSON over the size cap before decompressing it', async () => {
    await expect(readBeanConquerorZip(await fixtureZip(), { maxJsonBytes: 1000 })).rejects.toThrow(
      /too large/
    );
  });
});
