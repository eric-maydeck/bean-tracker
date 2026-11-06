import { page } from '$app/state';
import { asDateFormat, formatDay } from '$lib/localDate';

// A calendar date as text, in the account's Date format (layout data, so the server and the client agree).
// A stored UTC ISO timestamp is cut to its date part; clock times go through Stamp.svelte.
export const formatDate = (iso: string): string => formatDay(iso.slice(0, 10), asDateFormat(page.data.dateFormat));
