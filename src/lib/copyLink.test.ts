import { afterEach, describe, expect, it, vi } from 'vitest';
import { copyLinkOf, copyText, plainClick } from './copyLink';
import { toasts } from './toast.svelte';

const click = (o: Partial<MouseEvent> = {}) => ({ button: 0, metaKey: false, ctrlKey: false, shiftKey: false, altKey: false, ...o }) as MouseEvent;

function stubClipboard(writeText: (t: string) => Promise<void>) {
  const prompt = vi.fn();
  vi.stubGlobal('navigator', { clipboard: { writeText } });
  vi.stubGlobal('window', { prompt });
  return prompt;
}

const anchor = (href: string) => ({ href }) as HTMLAnchorElement;

afterEach(() => {
  vi.unstubAllGlobals();
  toasts.splice(0);
});

describe('copyText', () => {
  it('copies to the clipboard', async () => {
    const copies: string[] = [];
    const prompt = stubClipboard(async (t) => void copies.push(t));
    expect(await copyText('https://x.test/a')).toBe('copied');
    expect(copies).toEqual(['https://x.test/a']);
    expect(prompt).not.toHaveBeenCalled();
  });
  it('falls back to a prompt when the clipboard refuses', async () => {
    const prompt = stubClipboard(async () => { throw new Error('denied'); });
    expect(await copyText('https://x.test/a')).toBe('prompted');
    expect(prompt).toHaveBeenCalledWith('Copy this link', 'https://x.test/a');
  });
});

describe('plainClick', () => {
  it('is a left click with no modifier', () => {
    expect(plainClick(click())).toBe(true);
    for (const o of [{ button: 1 }, { metaKey: true }, { ctrlKey: true }, { shiftKey: true }, { altKey: true }]) expect(plainClick(click(o))).toBe(false);
  });
});

describe('copyLinkOf', () => {
  it("copies the link's full URL and toasts", async () => {
    const copies: string[] = [];
    stubClipboard(async (t) => void copies.push(t));
    await copyLinkOf(anchor('https://x.test/stats?tab=records&chart=record-a#record-a'));
    expect(copies).toEqual(['https://x.test/stats?tab=records&chart=record-a#record-a']);
    expect(toasts.map((t) => t.text)).toEqual(['Link copied']);
  });
  it('shows no toast when it fell back to the prompt', async () => {
    const prompt = stubClipboard(async () => { throw new Error('denied'); });
    await copyLinkOf(anchor('https://x.test/stats#overview-recent'));
    expect(prompt).toHaveBeenCalledWith('Copy this link', 'https://x.test/stats#overview-recent');
    expect(toasts).toHaveLength(0);
  });
});
