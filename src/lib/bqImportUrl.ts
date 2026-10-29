// /coffees/<slug>?bq=import opens the page with its Bean Conqueror import panel showing.
export const bqImportHref = (slug: string) => `/coffees/${slug}?bq=import`;
export const bqImportRequested = (p: URLSearchParams) => p.get('bq') === 'import';
