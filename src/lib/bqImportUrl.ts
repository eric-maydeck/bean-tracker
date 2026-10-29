// /coffees/<slug>?bq=import opens the page with its Bean Conqueror import panel showing.
export const bqImportHref = (slug: string) => `/coffees/${slug}?bq=import`;
export const bqImportRequested = (p: URLSearchParams) => p.get('bq') === 'import';

// /coffees/<slug>?edit=1 opens the page already in its top Edit mode (On Deck's tile menu); the page strips it once used.
export const editHref = (slug: string) => `/coffees/${slug}?edit=1`;
export const editRequested = (p: URLSearchParams) => p.get('edit') === '1';
