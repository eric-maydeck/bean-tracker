import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { diffShots } from './shotsDiff.ts';

it('lists added, changed and removed PNGs; a missing prev dir means all added', () => {
  const root = mkdtempSync(join(tmpdir(), 'shots-'));
  const cur = join(root, 'c');
  const prev = join(root, 'p');
  mkdirSync(cur);
  writeFileSync(join(cur, 'a.png'), '1');
  expect(diffShots(cur, prev)).toEqual({ added: ['a.png'], changed: [], removed: [] });
  mkdirSync(prev);
  const put = (d: string, f: string, s: string) => writeFileSync(join(d, f), s);
  put(prev, 'a.png', '1');
  put(cur, 'chg.png', '2'); put(prev, 'chg.png', '3');
  put(cur, 'new.png', '4'); put(prev, 'gone.png', '5'); put(cur, 'note.txt', 'x');
  expect(diffShots(cur, prev)).toEqual({ added: ['new.png'], changed: ['chg.png'], removed: ['gone.png'] });
});
