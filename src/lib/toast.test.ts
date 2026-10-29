import { describe, it, expect, beforeEach } from 'vitest';
import { toasts, showToast, dismissToast, undoToast, remainingAfterLeave, BUMP_MS } from './toast.svelte';

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

describe('remainingAfterLeave', () => {
  it('lifts a short remainder to the bump, keeps a longer one', () => {
    expect(remainingAfterLeave(200)).toBe(BUMP_MS);
    expect(remainingAfterLeave(2500)).toBe(2500);
  });
});
