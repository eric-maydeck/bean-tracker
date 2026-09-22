import { describe, it, expect, beforeEach } from 'vitest';
import type { DatabaseSync } from 'node:sqlite';
import { createDb } from './db';
import { createAlert, getActiveAlerts, markAlertRead, dismissAlert } from './alerts';

let db: DatabaseSync;

beforeEach(() => {
  db = createDb(':memory:');
});

describe('createAlert', () => {
  it('inserts a row and returns it with a generated id', () => {
    const alert = createAlert(db, { source: 'backup', message: 'Upload failed' });
    expect(alert.id).toBeGreaterThan(0);
    expect(alert.source).toBe('backup');
    expect(alert.message).toBe('Upload failed');
    expect(alert.severity).toBe('error');
    expect(alert.read_at).toBeNull();
    expect(alert.dismissed_at).toBeNull();
  });

  it('accepts an explicit severity', () => {
    const alert = createAlert(db, { source: 'backup', message: 'Heads up', severity: 'warning' });
    expect(alert.severity).toBe('warning');
  });
});

describe('getActiveAlerts', () => {
  it('returns alerts newest first', () => {
    const first = createAlert(db, { source: 'backup', message: 'First' });
    const second = createAlert(db, { source: 'backup', message: 'Second' });
    const alerts = getActiveAlerts(db);
    expect(alerts.map((a) => a.id)).toEqual([second.id, first.id]);
  });

  it('excludes dismissed alerts', () => {
    const alert = createAlert(db, { source: 'backup', message: 'Gone soon' });
    dismissAlert(db, alert.id);
    expect(getActiveAlerts(db)).toEqual([]);
  });

  it('includes read-but-not-dismissed alerts', () => {
    const alert = createAlert(db, { source: 'backup', message: 'Read but visible' });
    markAlertRead(db, alert.id);
    const alerts = getActiveAlerts(db);
    expect(alerts).toHaveLength(1);
    expect(alerts[0].read_at).not.toBeNull();
  });
});

describe('markAlertRead', () => {
  it('sets read_at', () => {
    const alert = createAlert(db, { source: 'backup', message: 'Msg' });
    markAlertRead(db, alert.id);
    const [reloaded] = getActiveAlerts(db);
    expect(reloaded.read_at).not.toBeNull();
  });
});

describe('dismissAlert', () => {
  it('sets dismissed_at and removes it from getActiveAlerts', () => {
    const alert = createAlert(db, { source: 'backup', message: 'Msg' });
    dismissAlert(db, alert.id);
    expect(getActiveAlerts(db)).toEqual([]);
  });
});
