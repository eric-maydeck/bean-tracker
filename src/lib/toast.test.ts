import { describe, it, expect, beforeEach } from 'vitest';
import { toasts, showToast, dismissToast, undoToast } from './toast.svelte';

beforeEach(() => toasts.splice(0));

describe('toasts', () => {
  it('stacks newer after older and dismisses by id', () => {
    const a = showToast('A');
    const b = showToast('B');
    expect(toasts.map((t) => t.text)).toEqual(['A', 'B']);
    dismissToast(a);
    expect(toasts.map((t) => t.id)).toEqual([b]);
  });

  it('undo runs the reverse action, drops the toast and says Undone.', async () => {
    let ran = 0;
    showToast('Archived', { undo: () => void ran++ });
    await undoToast(toasts[0]);
    expect(ran).toBe(1);
    expect(toasts.map((t) => t.text)).toEqual(['Undone.']);
  });

  it('a failing undo shows the error text', async () => {
    showToast('Archived', { undo: () => { throw new Error('Nope'); } });
    await undoToast(toasts[0]);
    expect(toasts.map((t) => t.text)).toEqual(['Nope']);
  });
});
