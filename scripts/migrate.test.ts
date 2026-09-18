import { describe, it, expect } from 'vitest';
import ExcelJS from 'exceljs';
import { execFileSync } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { cellText, cellNumber, excelSerialToISODate } from './migrate';

describe('cell parsing helpers', () => {
  it('cellText trims and nulls out blanks', () => {
    expect(cellText('  Roaster  ')).toBe('Roaster');
    expect(cellText('')).toBeNull();
    expect(cellText(null)).toBeNull();
  });

  it('cellNumber parses numbers and nulls out blanks', () => {
    expect(cellNumber(200)).toBe(200);
    expect(cellNumber('')).toBeNull();
    expect(cellNumber(null)).toBeNull();
  });

  it('excelSerialToISODate converts a Date cell value', () => {
    expect(excelSerialToISODate(new Date(Date.UTC(2026, 0, 1)))).toBe('2026-01-01');
    expect(excelSerialToISODate(null)).toBeNull();
  });
});

async function buildSampleWorkbook(path: string): Promise<void> {
  const workbook = new ExcelJS.Workbook();

  const backlog = workbook.addWorksheet('Bean backlog');
  backlog.addRow([
    'Roaster', 'Coffee', 'Origin', 'Roast Level', 'Processing', 'Amount (g)', 'Cost',
    'Cost per gram', 'Roast Date', 'Frozen Start Date', 'Frozen End Date',
    'Recommended Rest Days (low)', 'Recommended Rest Days (high)',
    'Days Since Roast', 'Drink After', 'Drink Before', 'Drank?', 'Urgency Rating'
  ]);
  backlog.addRow([
    'Roaster A', 'Coffee A', 'Ethiopia', 'Light', 'Washed', 200, 18, null,
    new Date(Date.UTC(2026, 0, 1)), null, null, 10, 20, null, null, null, 'No', null
  ]);
  backlog.addRow([
    'Roaster B', 'Coffee B', 'Kenya', 'Medium', 'Natural', 250, 20, null,
    new Date(Date.UTC(2026, 0, 5)), null, null, 7, 14, null, null, null, 'No', null
  ]);

  const finished = workbook.addWorksheet('Finished beans');
  finished.addRow([
    'Roaster', 'Coffee', 'Origin', 'Roast Level', 'Processing', 'Amount (g)', 'Cost',
    'Cost per gram', 'Roast Date', 'Frozen Start Date', 'Frozen End Date',
    'Recommended Rest Days (low)', 'Recommended Rest Days (high)',
    'Days Since Roast', 'Drink After', 'Drink Before', 'Drank?', 'Moved date'
  ]);
  finished.addRow([
    'Roaster C', 'Coffee C', 'Colombia', 'Dark', 'Washed', 200, 15, null,
    new Date(Date.UTC(2025, 11, 1)), null, null, 5, 10, null, null, null, 'Yes',
    new Date(Date.UTC(2026, 0, 15))
  ]);

  const subs = workbook.addWorksheet('Subscriptions');
  subs.addRow(['Roaster/Service', 'Name of Subscription', 'Price', '# bags/tins', 'Amount per bag/tin (g)']);
  subs.addRow(['Airworks', 'Ultralight Subscription', 66, 3, 200]);

  await workbook.xlsx.writeFile(path);
}

describe('migrate.ts (end-to-end via CLI)', () => {
  it('dry-run reports counts without writing to the database', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'bean-tracker-migrate-'));
    const xlsxPath = join(dir, 'sample.xlsx');
    await buildSampleWorkbook(xlsxPath);

    const output = execFileSync(
      'node',
      ['scripts/migrate.ts', '--file', xlsxPath, '--dry-run'],
      { encoding: 'utf-8' }
    );

    expect(output).toContain('Active coffees found: 2');
    expect(output).toContain('Finished coffees found: 1');
  });

  it('writes the parsed rows into the target database', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'bean-tracker-migrate-'));
    const xlsxPath = join(dir, 'sample.xlsx');
    const dbPath = join(dir, 'out.db');
    await buildSampleWorkbook(xlsxPath);

    execFileSync('node', ['scripts/migrate.ts', '--file', xlsxPath, '--db', dbPath], {
      encoding: 'utf-8'
    });

    const db = new DatabaseSync(dbPath);
    const active = db.prepare(`SELECT COUNT(*) as count FROM coffees WHERE status = 'backlog'`).get() as {
      count: number;
    };
    const finished = db.prepare(`SELECT COUNT(*) as count FROM coffees WHERE status = 'archive'`).get() as {
      count: number;
    };
    const subs = db.prepare(`SELECT COUNT(*) as count FROM subscriptions`).get() as { count: number };
    expect(active.count).toBe(2);
    expect(finished.count).toBe(1);
    expect(subs.count).toBe(1);

    const finishedRow = db.prepare(`SELECT moved_date FROM coffees WHERE status = 'archive'`).get() as {
      moved_date: string;
    };
    expect(finishedRow.moved_date).toBe('2026-01-15');
  });

  it('prevents duplicate data insertion on second run without --clear', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'bean-tracker-migrate-'));
    const xlsxPath = join(dir, 'sample.xlsx');
    const dbPath = join(dir, 'out.db');
    await buildSampleWorkbook(xlsxPath);

    // First migration succeeds
    execFileSync('node', ['scripts/migrate.ts', '--file', xlsxPath, '--db', dbPath], {
      encoding: 'utf-8'
    });

    // Second migration without --clear should fail
    expect(() => {
      execFileSync('node', ['scripts/migrate.ts', '--file', xlsxPath, '--db', dbPath], {
        encoding: 'utf-8'
      });
    }).toThrow();

    // Verify data was not duplicated
    const db = new DatabaseSync(dbPath);
    const active = db.prepare(`SELECT COUNT(*) as count FROM coffees WHERE status = 'backlog'`).get() as {
      count: number;
    };
    const finished = db.prepare(`SELECT COUNT(*) as count FROM coffees WHERE status = 'archive'`).get() as {
      count: number;
    };
    const subs = db.prepare(`SELECT COUNT(*) as count FROM subscriptions`).get() as { count: number };
    expect(active.count).toBe(2);
    expect(finished.count).toBe(1);
    expect(subs.count).toBe(1);
  });

  it('allows re-running migration with --clear flag', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'bean-tracker-migrate-'));
    const xlsxPath = join(dir, 'sample.xlsx');
    const dbPath = join(dir, 'out.db');
    await buildSampleWorkbook(xlsxPath);

    // First migration
    execFileSync('node', ['scripts/migrate.ts', '--file', xlsxPath, '--db', dbPath], {
      encoding: 'utf-8'
    });

    // Second migration with --clear succeeds
    execFileSync('node', ['scripts/migrate.ts', '--file', xlsxPath, '--db', dbPath, '--clear'], {
      encoding: 'utf-8'
    });

    // Verify data has the expected counts (not doubled)
    const db = new DatabaseSync(dbPath);
    const active = db.prepare(`SELECT COUNT(*) as count FROM coffees WHERE status = 'backlog'`).get() as {
      count: number;
    };
    const finished = db.prepare(`SELECT COUNT(*) as count FROM coffees WHERE status = 'archive'`).get() as {
      count: number;
    };
    const subs = db.prepare(`SELECT COUNT(*) as count FROM subscriptions`).get() as { count: number };
    expect(active.count).toBe(2);
    expect(finished.count).toBe(1);
    expect(subs.count).toBe(1);
  });
});
