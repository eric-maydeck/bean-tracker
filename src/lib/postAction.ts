import { refreshTracked } from '#lib/urlState.ts';

// A toast's Undo: posts form fields to a SvelteKit action (`?/name`, or `/path?/name`) and refreshes the page data.
// Throws (so the toast says "Could not undo that.") unless the action succeeded.
export async function postAction(url: string, fields: Record<string, string | number | string[]>): Promise<void> {
  const body = new FormData();
  for (const [k, v] of Object.entries(fields)) for (const x of [v].flat()) body.append(k, String(x));
  const res = await fetch(url, { method: 'POST', body, headers: { 'x-sveltekit-action': 'true' } });
  const out = (await res.json().catch(() => null)) as { type?: string } | null;
  if (out?.type !== 'success') throw new Error('Could not undo that.');
  await refreshTracked();
}
