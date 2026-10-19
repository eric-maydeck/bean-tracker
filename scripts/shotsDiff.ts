// Diff two screenshot dirs by content hash: which PNGs are new, changed or gone.
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const hashes = (dir: string) =>
  new Map(
    (existsSync(dir) ? readdirSync(dir) : [])
      .filter((f) => f.endsWith('.png'))
      .map((f) => [f, createHash('sha1').update(readFileSync(join(dir, f))).digest('hex')])
  );

export function diffShots(cur: string, prev: string) {
  const a = hashes(cur);
  const b = hashes(prev);
  return {
    added: [...a.keys()].filter((f) => !b.has(f)).sort(),
    changed: [...a].filter(([f, h]) => b.has(f) && b.get(f) !== h).map(([f]) => f).sort(),
    removed: [...b.keys()].filter((f) => !a.has(f)).sort()
  };
}
