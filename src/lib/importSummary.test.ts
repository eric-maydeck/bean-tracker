import { describe, it, expect } from 'vitest';
import { importSummary } from './importSummary';
import type { ImportChanges } from './server/beanconqueror';

const zero: ImportChanges = {
  beans: { new: 0, updated: 0 }, brews: { new: 0, updated: 0 }, waters: { new: 0, updated: 0 },
  autoLinked: 0, untracked: { total: 0, added: 0 }
};

describe('importSummary', () => {
  it('says nothing changed when everything is zero', () => {
    expect(importSummary(zero)).toEqual({ nothing: true, lines: ['Nothing changed.'] });
  });
  it('omits zero parts and singularizes 1', () => {
    const r = importSummary({ ...zero, brews: { new: 12, updated: 1 }, beans: { new: 2, updated: 0 }, waters: { new: 1, updated: 0 } });
    expect(r.nothing).toBe(false);
    expect(r.lines).toContain('12 new brews, 1 updated');
    expect(r.lines).toContain('2 new beans');
    expect(r.lines).toContain('1 new water');
  });
  it('reports links and untracked beans', () => {
    expect(importSummary({ ...zero, autoLinked: 1 }).lines).toContain('1 bean linked to its coffee');
    expect(importSummary({ ...zero, autoLinked: 2 }).lines).toContain('2 beans linked to their coffees');
    expect(importSummary({ ...zero, untracked: { total: 3, added: 2 } }).lines).toContain('3 beans not tracked yet (2 new)');
  });
});

it('a re-upload with standing untracked beans is still "nothing changed"', () => {
  expect(importSummary({ ...zero, untracked: { total: 3, added: 0 } })).toEqual({
    nothing: true, lines: ['Nothing changed.', '3 beans not tracked yet']
  });
});
