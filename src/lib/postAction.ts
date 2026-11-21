import { deserialize } from '$app/forms';
import { refreshTracked } from '#lib/urlState.ts';

// A toast's Undo: posts form fields to a SvelteKit action (`?/name`, or `/path?/name`) and refreshes the page data
// (or runs `after` with the action's data instead, for an Undo that must navigate).
// Throws (so the toast says "Could not undo that.") unless the action succeeded.
export async function postAction(url: string, fields: Record<string, string | number | string[]>, after?: (data: Record<string, unknown> | undefined) => unknown): Promise<void> {
  const body = new FormData();
  for (const [k, v] of Object.entries(fields)) for (const x of [v].flat()) body.append(k, String(x));
  const res = await fetch(url, { method: 'POST', body, headers: { 'x-sveltekit-action': 'true' } });
  const out = deserialize(await res.text().catch(() => '{}'));
  if (out.type !== 'success') throw new Error('Could not undo that.');
  await (after ? after(out.data) : refreshTracked());
}
