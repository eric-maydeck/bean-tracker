import { describe, it, expect } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createDb } from './db';
import { importBeanConquerorData } from './beanconqueror';
import { compactFlow } from './bcFlow';
import {
  createUploadPassword,
  verifyUploadAuth,
  parseShot,
  saveShot,
  uploadStatus,
  ShotError
} from './visualizerUpload';

const UUID = '0b1c2d3e-4f50-6172-8394-a5b6c7d8e9f0';
const sample = (n: number, k: number) =>
  Array.from({ length: n }, (_, i) => ({ brew_time: `${Math.floor(i / 4)}.${i % 4}`, actual_smoothed_weight: i * k }));
const payload = (over: Record<string, unknown> = {}) => ({
  application: 'BEANCONQUEROR',
  visualizerId: 'whatever-id',
  brew: { config: { uuid: UUID } },
  brewFlow: { weight: sample(40, 1) },
  ...over
});
const basic = (user: string, pw: string) => 'Basic ' + Buffer.from(`${user}:${pw}`).toString('base64');
const shot = (k: number, uuid = UUID) => {
  const flow = compactFlow({ weight: sample(40, k) });
  if (!flow) throw new Error('fixture');
  return { uuid, flow };
};

describe('saveShot / uploadStatus', () => {
  it('upserts one row per uuid, second weights win, same id returned', () => {
    const db = createDb(':memory:');
    const a = saveShot(db, shot(1));
    const b = saveShot(db, shot(2));
    expect(a).toEqual({ id: UUID });
    expect(b).toEqual(a);
    const rows = db.prepare('SELECT * FROM beanconqueror_brew_flows').all() as { weights: string; points: number; format: number; step_ms: number }[];
    expect(rows).toHaveLength(1);
    expect(rows[0].weights).toBe(JSON.stringify(shot(2).flow.w));
    expect(rows[0]).toMatchObject({ format: 1, step_ms: 50, points: shot(2).flow.w.length });
    const w = JSON.parse(rows[0].weights);
    expect(w.every(Number.isInteger)).toBe(true);
    expect(uploadStatus(db).lastUploadAt).toBeTruthy();
  });

  it('counts a flow without a brew as waiting until the zip import brings the brew', () => {
    const db = createDb(':memory:');
    saveShot(db, shot(1));
    expect(uploadStatus(db)).toMatchObject({ flows: 1, waiting: 1, brewsWithFlow: 0, hasPassword: false });
    const brew = { bcUuid: UUID, bcCreatedAt: '2026-06-01T12:00:00.000Z', beanId: null, preparationId: null, millId: null, grindSetting: null, groundCoffeeG: 20, brewTemperature: null, beanType: null, grindSpeedRpm: null, grindTime: null, profile: null, preparationTools: null, temperatureTime: null, brewTime: null, bloomTime: null, firstDripTime: null, waterAmountG: null, coffeeType: null, coffeeConcentration: null, rating: 7, notes: null, beverageQuantity: null, tdsPercent: null, extractionYieldPercent: null, brewRatio: null, beanAgeDays: null, bcArchived: false, water: null, hasFlowProfile: true };
    importBeanConquerorData(db, { beans: [], beanOrigins: [], methods: [], grinders: [], brews: [brew] });
    expect(uploadStatus(db)).toMatchObject({ flows: 1, waiting: 0, brewsWithFlow: 1 });
  });

  it('boot migration keeps flows when createDb runs again on the same file', () => {
    const dir = mkdtempSync(join(tmpdir(), 'vu-'));
    try {
      const path = join(dir, 't.db');
      saveShot(createDb(path), shot(1));
      expect(uploadStatus(createDb(path)).flows).toBe(1);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('parseShot', () => {
  it('returns uuid + compact flow, ignoring visualizerId', () => {
    const r = parseShot(payload({ visualizerId: 'never-issued' }));
    expect(r.uuid).toBe(UUID);
    expect(r.flow).toEqual(shot(1).flow);
  });

  it('rejects with exact messages and status 400', () => {
    const cases: [unknown, string][] = [
      [payload({ application: 'OTHER' }), 'Not a Bean Conqueror upload'],
      [null, 'Not a Bean Conqueror upload'],
      [payload({ brew: { config: { uuid: 'nope' } } }), 'Missing brew id'],
      [payload({ brew: {} }), 'Missing brew id'],
      [payload({ brew: { config: { uuid: '-'.repeat(36) } } }), 'Missing brew id'],
      ['a string', 'Not a Bean Conqueror upload'],
      [payload({ brewFlow: { weight: [] } }), 'This brew has no flow data'],
      [payload({ brewFlow: undefined }), 'This brew has no flow data']
    ];
    for (const [input, msg] of cases) {
      try {
        parseShot(input);
        expect.unreachable();
      } catch (e) {
        expect(e).toBeInstanceOf(ShotError);
        expect((e as ShotError).message).toBe(msg);
        expect((e as ShotError).status).toBe(400);
      }
    }
  });
});

describe('verifyUploadAuth', () => {
  it('is false when no password exists', () => {
    const db = createDb(':memory:');
    expect(verifyUploadAuth(db, basic('bean-tracker', 'x'))).toBe(false);
    expect(uploadStatus(db).hasPassword).toBe(false);
  });

  it('accepts any username with the right password, rejects the rest', () => {
    const db = createDb(':memory:');
    const pw = createUploadPassword(db);
    expect(uploadStatus(db).hasPassword).toBe(true);
    expect(verifyUploadAuth(db, basic('bean-tracker', pw))).toBe(true);
    expect(verifyUploadAuth(db, basic('anyone', pw))).toBe(true);
    expect(verifyUploadAuth(db, basic('anyone', pw))).toBe(true); // memo hit
    expect(verifyUploadAuth(db, basic('bean-tracker', 'wrong'))).toBe(false);
    expect(verifyUploadAuth(db, 'Basic !!!')).toBe(false);
    expect(verifyUploadAuth(db, 'Basic ' + Buffer.from('nocolon').toString('base64'))).toBe(false);
    expect(verifyUploadAuth(db, basic('u', pw).replace('Basic', 'basic'))).toBe(true);
    expect(verifyUploadAuth(db, basic('u', ''))).toBe(false);
    expect(verifyUploadAuth(db, 'Bearer ' + pw)).toBe(false);
    expect(verifyUploadAuth(db, null)).toBe(false);
  });

  it('rotating invalidates the old password even after a memoized success', () => {
    const db = createDb(':memory:');
    const old = createUploadPassword(db);
    expect(verifyUploadAuth(db, basic('u', old))).toBe(true);
    const fresh = createUploadPassword(db);
    expect(fresh).not.toBe(old);
    expect(verifyUploadAuth(db, basic('u', old))).toBe(false);
    expect(verifyUploadAuth(db, basic('u', fresh))).toBe(true);
  });
});
