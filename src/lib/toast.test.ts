import { describe, it, expect } from 'vitest';
import { toast, showToast } from './toast.svelte';

describe('showToast', () => {
  it('sets the text and restarts on a repeat', () => {
    showToast('Added 20 g.');
    const n = toast.n;
    showToast('Added 20 g.');
    expect(toast).toMatchObject({ text: 'Added 20 g.', n: n + 1 });
  });
});
