// One stored pour reading per Bean Conqueror brew with flow (plan 2026-10-27-pour-reading-recipes).
import type { DatabaseSync } from 'node:sqlite';
import { DETECTOR_VERSION, type PourReading } from '$lib/pours';
import { expandFlow } from './bcFlow';
import { readPours } from './pourDetector';
import { rematchBrews } from './recipes';

interface Row {
  bc_uuid: string;
  weights: string;
  uploaded_at: string;
  water_g: number | null;
  dose_g: number | null;
  brew_time: string | null;
}

const FROM = `FROM beanconqueror_brew_flows f JOIN beanconqueror_brews b ON b.bc_uuid = f.bc_uuid`;
const COLS = `f.bc_uuid, f.weights, f.uploaded_at, b.water_amount_g water_g, b.ground_coffee_g dose_g, b.brew_time`;
const STALE = `${FROM} LEFT JOIN brew_pour_readings r ON r.bc_uuid = f.bc_uuid
  WHERE r.bc_uuid IS NULL OR r.detector_version <> ${DETECTOR_VERSION} OR r.flow_uploaded_at <> f.uploaded_at
    OR r.water_g IS NOT b.water_amount_g OR r.dose_g IS NOT b.ground_coffee_g
    OR r.logged_brew_time IS NOT b.brew_time`;

const UPSERT = `INSERT OR REPLACE INTO brew_pour_readings (bc_uuid, detector_version, flow_uploaded_at, water_g,
  dose_g, logged_brew_time, structure_key, pattern, pour_count, bloom_count, bloom_hold_s, ratio, ratio_source,
  total_s, drawdown_s, swirl_count, low_confidence, immersion, reading, read_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

function store(db: DatabaseSync, r: Row): void {
  let x: PourReading | null = null;
  try {
    const w = JSON.parse(r.weights);
    if (!Array.isArray(w)) throw new Error('weights is not an array');
    const c = expandFlow({ v: 1, stepMs: 50, w });
    const secs = r.brew_time == null || r.brew_time.trim() === '' ? NaN : Number(r.brew_time);
    x = readPours(c.t, c.g, {
      waterG: r.water_g,
      doseG: r.dose_g,
      brewTimeS: Number.isFinite(secs) ? secs : null
    });
  } catch (err) {
    console.warn(`pour readings: could not read ${r.bc_uuid}: ${err instanceof Error ? err.message : err}`);
  }
  const head = [r.bc_uuid, DETECTOR_VERSION, r.uploaded_at, r.water_g, r.dose_g, r.brew_time];
  const now = new Date().toISOString();
  if (!x) {
    // stored empty so it isn't stale again next boot
    db.prepare(UPSERT).run(...head, null, '', 0, 0, null, null, null, null, null, 0, 1, 0, '{}', now);
    return;
  }
  db.prepare(UPSERT).run(
    ...head, x.structureKey, x.pattern, x.pours.length, x.bloomCount, x.bloomHoldS, x.ratio, x.ratioSource,
    x.totalS, x.drawdownS, x.swirls.length, x.lowConfidence ? 1 : 0, x.immersion ? 1 : 0, JSON.stringify(x),
    now
  );
}

/** Reads and upserts one brew; false while its brew row or flow is missing. */
export function readBrew(db: DatabaseSync, bcUuid: string): boolean {
  const row = db.prepare(`SELECT ${COLS} ${FROM} WHERE f.bc_uuid = ?`).get(bcUuid) as Row | undefined;
  if (!row) return false;
  store(db, row);
  const brew = db.prepare(`SELECT id FROM beanconqueror_brews WHERE bc_uuid = ?`).get(bcUuid) as { id: number } | undefined;
  if (brew) rematchBrews(db, [brew.id]);
  return true;
}

/** Reads up to `limit` stale brews in one transaction (-1 = all); returns how many. */
export function readStale(db: DatabaseSync, limit = 25): number {
  const rows = db.prepare(`SELECT ${COLS} ${STALE} LIMIT ?`).all(limit) as unknown as Row[];
  if (!rows.length) return 0;
  db.exec('BEGIN');
  try {
    for (const r of rows) store(db, r);
    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
  return rows.length;
}

// ponytail: module-level flag, one node process
let running: Promise<number> | null = null;
let again = false;

export function queueReadings(db: DatabaseSync): Promise<number> {
  if (running) {
    again = true;
    return running;
  }
  running = (async () => {
    const t0 = Date.now();
    let total = 0;
    do {
      again = false;
      for (let n; (n = readStale(db)) > 0; ) {
        total += n;
        await new Promise((r) => setImmediate(r));
      }
    } while (again);
    rematchBrews(db); // an import can change notes without changing a reading
    if (total) console.log(`pour readings: ${total} read in ${Date.now() - t0} ms`);
    return total;
  })().finally(() => (running = null));
  return running;
}
