import ExcelJS from 'exceljs';
import { parseArgs } from 'node:util';
import { createDb } from '../src/lib/server/db.ts';
import { createCoffee, type NewCoffeeInput } from '../src/lib/server/coffees.ts';
import { createSubscription } from '../src/lib/server/subscriptions.ts';

export function cellText(value: unknown): string | null {
  if (value == null) return null;
  const s = String(value).trim();
  return s === '' ? null : s;
}

export function cellNumber(value: unknown): number | null {
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function excelSerialToISODate(value: unknown): string | null {
  if (value == null) return null;
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }
  return null;
}

interface ParsedCoffeeRow extends Omit<NewCoffeeInput, 'status'> {}

function readCoffeeSheet(worksheet: ExcelJS.Worksheet): ParsedCoffeeRow[] {
  const rows: ParsedCoffeeRow[] = [];
  worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) return;
    const get = (col: number) => row.getCell(col).value;
    const roaster = cellText(get(1));
    const coffeeName = cellText(get(2));
    if (!roaster && !coffeeName) return;
    rows.push({
      roaster: roaster ?? '',
      coffee_name: coffeeName ?? '',
      origin: cellText(get(3)),
      roast_level: cellText(get(4)),
      processing: cellText(get(5)),
      amount_g: cellNumber(get(6)),
      cost: cellNumber(get(7)),
      roast_date: excelSerialToISODate(get(9)),
      frozen_start_date: excelSerialToISODate(get(10)),
      frozen_end_date: excelSerialToISODate(get(11)),
      rest_days_low: cellNumber(get(12)),
      rest_days_high: cellNumber(get(13)),
      image_url: null
    });
  });
  return rows;
}

async function main() {
  const { values } = parseArgs({
    options: {
      file: { type: 'string' },
      'dry-run': { type: 'boolean', default: false },
      db: { type: 'string', default: 'data/bean-tracker.db' },
      clear: { type: 'boolean', default: false }
    }
  });

  if (!values.file) {
    console.error('Usage: node scripts/migrate.ts --file "<path to xlsx>" [--dry-run] [--clear] [--db <path>]');
    process.exit(1);
  }

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(values.file);

  const backlogSheet = workbook.getWorksheet('Bean backlog');
  const finishedSheet = workbook.getWorksheet('Finished beans');
  const subsSheet = workbook.getWorksheet('Subscriptions');

  if (!backlogSheet || !finishedSheet) {
    console.error('Expected sheets "Bean backlog" and "Finished beans" not found.');
    process.exit(1);
  }

  const activeRows = readCoffeeSheet(backlogSheet);
  const finishedRows = readCoffeeSheet(finishedSheet);
  const badRows = [...activeRows, ...finishedRows].filter((r) => !r.roaster || !r.coffee_name);

  console.log(`Active coffees found: ${activeRows.length}`);
  console.log(`Finished coffees found: ${finishedRows.length}`);
  if (badRows.length > 0) {
    console.log(`Rows missing roaster/coffee name, skipped: ${badRows.length}`);
  }

  if (values['dry-run']) {
    console.log('Dry run — no data written.');
    return;
  }

  const db = createDb(values.db);

  // Check for existing data to prevent duplicate insertion on re-run
  const coffeeCount = (db.prepare('SELECT COUNT(*) as count FROM coffees').get() as { count: number }).count;
  const subCount = (db.prepare('SELECT COUNT(*) as count FROM subscriptions').get() as { count: number }).count;

  if ((coffeeCount > 0 || subCount > 0) && !values.clear) {
    console.error('Error: target database already contains data.');
    console.error('Re-running the migration would duplicate existing rows.');
    console.error('To clear existing coffees and subscriptions and re-run, use the --clear flag:');
    console.error('  node scripts/migrate.ts --file "<path>" --clear --db <path>');
    process.exit(1);
  }

  if (values.clear && (coffeeCount > 0 || subCount > 0)) {
    db.exec('DELETE FROM coffees');
    db.exec('DELETE FROM subscriptions');
  }

  for (const row of activeRows) {
    createCoffee(db, { ...row, status: 'active' });
  }
  for (const row of finishedRows) {
    createCoffee(db, { ...row, status: 'finished' });
  }

  if (subsSheet) {
    subsSheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      if (rowNumber === 1) return;
      const roasterService = cellText(row.getCell(1).value);
      if (!roasterService) return;
      createSubscription(db, {
        roaster_service: roasterService,
        subscription_name: cellText(row.getCell(2).value),
        price: cellNumber(row.getCell(3).value),
        bag_count: cellNumber(row.getCell(4).value),
        amount_per_bag_g: cellNumber(row.getCell(5).value)
      });
    });
  }

  console.log('Migration complete.');
}

if (import.meta.main) {
  main();
}
