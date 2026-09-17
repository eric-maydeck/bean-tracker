import { DatabaseSync } from 'node:sqlite';
import { readFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const SCHEMA_PATH = join(dirname(fileURLToPath(import.meta.url)), 'schema.sql');

export function applySchema(db: DatabaseSync): void {
  const schema = readFileSync(SCHEMA_PATH, 'utf-8');
  db.exec(schema);
}

export function createDb(path: string): DatabaseSync {
  if (path !== ':memory:') {
    mkdirSync(dirname(path), { recursive: true });
  }
  const db = new DatabaseSync(path);
  applySchema(db);
  return db;
}

let singleton: DatabaseSync | undefined;

export function getDb(): DatabaseSync {
  if (!singleton) {
    singleton = createDb(process.env.DB_PATH ?? 'data/bean-tracker.db');
  }
  return singleton;
}
