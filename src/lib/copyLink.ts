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

// A section heading's or tile caption's link to itself (HeadingAnchor, TileCaption, the overview's .caption-link):
// a plain click still does what the link does (updates the address bar), and also copies the full URL it points
// to (filters and #anchor included) with a "Link copied" toast, as GitHub / MDN heading links do. The URL is the
// anchor's resolved href, read at click time, so a chart link (?…&chart=<id>#<id>) copies the URL it produces
// even before its replaceState lands.
export function copyOnClick(node: HTMLAnchorElement): { destroy: () => void } {
  function onclick(e: MouseEvent) {
    if (!plainClick(e)) return;
    void copyText(node.href).then((r) => r === 'copied' && showToast('Link copied'));
  }
  node.addEventListener('click', onclick);
  return { destroy: () => node.removeEventListener('click', onclick) };
}
