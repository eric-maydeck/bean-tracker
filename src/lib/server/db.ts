import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { schema } from './schema.ts';

export function applySchema(db: DatabaseSync): void {
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
