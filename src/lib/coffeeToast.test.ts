import { describe, it, expect } from 'vitest';
import { coffeeToast, undoable } from './coffeeToast';

const name = (id: number) => `C${id}`;
describe('coffeeToast', () => {
  it('names a single coffee', () => {
    expect(coffeeToast([{ id: 1, statusAction: 'freeze' }], name)).toBe('Coffee "C1" frozen.');
    expect(coffeeToast([{ id: 1, statusAction: 'thaw' }], name)).toBe('Coffee "C1" unfrozen.');
    expect(coffeeToast([{ id: 1, statusAction: 'open' }], name)).toBe('Coffee "C1" marked as open.');
    expect(coffeeToast([{ id: 1, statusAction: 'unarchive' }], name)).toBe('Coffee "C1" unarchived.');
    expect(coffeeToast([{ id: 1 }], name)).toBe('Coffee "C1" saved.');
  });
  it('counts a batch', () => {
    expect(coffeeToast([1, 2, 3].map((id) => ({ id, statusAction: 'archive' })), name)).toBe('3 coffees archived.');
    expect(coffeeToast([1, 2].map((id) => ({ id, statusAction: 'open' })), name)).toBe('2 coffees opened.');
    expect(coffeeToast([{ id: 1, statusAction: 'archive' }, { id: 2 }], name)).toBe('2 coffees updated.');
  });
  it('is silent for nothing', () => expect(coffeeToast([], name)).toBeNull());
});

describe('undoable', () => {
  it('is true for status actions only', () => {
    expect(undoable([{ statusAction: 'archive' }, { statusAction: 'freeze' }])).toBe(true);
    expect(undoable([{}])).toBe(false);
    expect(undoable([{ statusAction: 'delete' }])).toBe(false);
    expect(undoable([{ statusAction: 'archive', fields: {} }])).toBe(false);
    expect(undoable([])).toBe(false);
  });
});
