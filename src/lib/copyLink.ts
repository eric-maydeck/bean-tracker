import { showToast } from '$lib/toast.svelte';

// Copies text to the clipboard; where the clipboard API is unavailable or refuses (plain-http LAN testing),
// a prompt shows it to copy by hand. 'copied' / 'prompted' says which happened.
export async function copyText(text: string, prompt = 'Copy this link'): Promise<'copied' | 'prompted'> {
  try {
    await navigator.clipboard.writeText(text);
    return 'copied';
  } catch {
    window.prompt(prompt, text);
    return 'prompted';
  }
}

// A plain left click: modified clicks (new tab, download, …) and other buttons are left to the browser.
export const plainClick = (e: MouseEvent): boolean => e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey;

// A heading's link icon (HeadingAnchor): copies the full URL its link points to (filters and #anchor included)
// with a "Link copied" toast, as GitHub / MDN heading links do; the heading text itself only follows the link.
// The URL is the anchor's resolved href, so a chart link copies the ?…&chart=<id>#<id> URL it produces.
export async function copyLinkOf(a: HTMLAnchorElement): Promise<void> {
  if ((await copyText(a.href)) === 'copied') showToast('Link copied');
}
