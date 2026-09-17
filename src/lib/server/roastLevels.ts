import type { DatabaseSync } from 'node:sqlite';
import type { RoastLevelRow } from '../types';

export function getRoastLevels(db: DatabaseSync): RoastLevelRow[] {
  return db.prepare(`SELECT * FROM roast_levels ORDER BY degrees_of_roast ASC`).all() as RoastLevelRow[];
}
