import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import type { DatabaseSync } from 'node:sqlite';
import { createDb } from './db';
import { compactFlow } from './bcFlow';
import { saveShot } from './visualizerUpload';
import { importBeanConquerorData } from './beanconqueror';
import * as pr from './pourReadings';
import { DETECTOR_VERSION } from '$lib/pours';

const BBS = '/fixtures/bcflow/bbs.json';
const flow = compactFlow(JSON.parse(readFileSync(new URL(`.${BBS}`, import.meta.url), 'utf8')))!;
const uuid = (i: number) => `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`;
const addBrew = (db: DatabaseSync, i: number) =>
  db
    .prepare(
      `INSERT INTO beanconqueror_brews (bc_created_at, bc_uuid, water_amount_g, ground_coffee_g, brew_time, has_flow_profile, imported_at)
       VALUES (?, ?, 295.3, 18, '117', 1, 'x')`
    )
    .run(`2026-01-${String(i).padStart(2, '0')}T00:00:00Z`, uuid(i));
const readings = (db: DatabaseSync) =>
  db.prepare(`SELECT * FROM brew_pour_readings ORDER BY bc_uuid`).all() as Record<string, unknown>[];

describe('pour readings', () => {
  it('saveShot for a known brew stores a reading; unknown waits for the import', () => {
    const db = createDb(':memory:');
    addBrew(db, 1);
    saveShot(db, { uuid: uuid(1), flow });
    expect(readings(db)).toHaveLength(1);
    expect(readings(db)[0]).toMatchObject({ pattern: 'FFFS', water_g: 295.3, dose_g: 18 });

    saveShot(db, { uuid: uuid(2), flow });
    expect(readings(db)).toHaveLength(1);
    const brew = { bcUuid: uuid(2), bcCreatedAt: '2026-06-01T12:00:00.000Z', beanId: null, preparationId: null, millId: null, grindSetting: null, groundCoffeeG: 18, brewTemperature: null, beanType: null, grindSpeedRpm: null, grindTime: null, profile: null, preparationTools: null, temperatureTime: null, brewTime: null, bloomTime: null, firstDripTime: null, waterAmountG: 295.3, coffeeType: null, coffeeConcentration: null, rating: 7, notes: null, beverageQuantity: null, tdsPercent: null, extractionYieldPercent: null, brewRatio: null, beanAgeDays: null, bcArchived: false, water: null, hasFlowProfile: true };
    importBeanConquerorData(db, { beans: [], beanOrigins: [], methods: [], grinders: [], brews: [brew] });
    expect(pr.readStale(db)).toBe(1);
    expect(readings(db)).toHaveLength(2);
  });

  it('re-reads only what changed: new upload, changed inputs, older detector', () => {
    const db = createDb(':memory:');
    for (const i of [1, 2, 3]) {
      addBrew(db, i);
      saveShot(db, { uuid: uuid(i), flow });
    }
    expect(pr.readStale(db)).toBe(0);
    db.prepare(`UPDATE beanconqueror_brew_flows SET uploaded_at = 'later' WHERE bc_uuid = ?`).run(uuid(1));
    expect(pr.readStale(db)).toBe(1);
    db.prepare(`UPDATE beanconqueror_brews SET water_amount_g = 300 WHERE bc_uuid = ?`).run(uuid(2));
    expect(pr.readStale(db)).toBe(1);
    expect(pr.readStale(db)).toBe(0);
    db.prepare(`UPDATE brew_pour_readings SET detector_version = ?`).run(DETECTOR_VERSION - 1);
    expect(pr.readStale(db, -1)).toBe(3);
  });

  it('an unreadable flow warns once and is stored empty, not stale', () => {
    const db = createDb(':memory:');
    addBrew(db, 1);
    saveShot(db, { uuid: uuid(1), flow });
    db.prepare(`UPDATE beanconqueror_brew_flows SET weights = '[1,2'`).run();
    db.prepare(`UPDATE beanconqueror_brew_flows SET uploaded_at = 'again'`).run();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(pr.readStale(db)).toBe(1);
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
    expect(readings(db)[0]).toMatchObject({ pattern: '', pour_count: 0, low_confidence: 1 });
    expect(pr.readStale(db)).toBe(0);
  });

  it('queueReadings batches and is single flight', async () => {
    const db = createDb(':memory:');
    const w = JSON.stringify(flow.w);
    for (let i = 1; i <= 60; i++) {
      addBrew(db, i);
      db.prepare(`INSERT INTO beanconqueror_brew_flows VALUES (?, 1, 50, ?, ?, 't')`).run(uuid(i), flow.w.length, w);
    }
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const prepare = vi.spyOn(db, 'prepare');
    const [a, b] = await Promise.all([pr.queueReadings(db), pr.queueReadings(db)]);
    // 25 per batch: 25 + 25 + 10, then the empty one that ends the loop
    const batches = prepare.mock.calls.filter(([sql]) => /LIMIT \?/.test(sql)).length;
    prepare.mockRestore();
    expect(batches).toBeGreaterThanOrEqual(3);
    expect(a).toBe(60);
    expect(b).toBe(60);
    expect(readings(db)).toHaveLength(60);
    expect(log).toHaveBeenCalledTimes(1);
    log.mockRestore();
    expect(await pr.queueReadings(db)).toBe(0);
  });

  it('createDb twice keeps the readings', () => {
    const dir = mkdtempSync(join(tmpdir(), 'pr-'));
    try {
      const f = join(dir, 'a.db');
      const db = createDb(f);
      addBrew(db, 1);
      saveShot(db, { uuid: uuid(1), flow });
      db.close();
      expect(readings(createDb(f))).toHaveLength(1);
    } finally {
      rmSync(dir, { recursive: true });
    }
  });
});
