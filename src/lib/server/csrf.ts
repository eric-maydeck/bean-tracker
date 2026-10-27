// Re-implements SvelteKit's form-origin check (runtime/server/respond.js) so one
// path can be exempt; svelte.config.js turns the built-in check off.
const FORM_TYPES = [
  'application/x-www-form-urlencoded',
  'multipart/form-data',
  'text/plain',
  'application/x-sveltekit-formdata'
];
const UNSAFE = ['POST', 'PUT', 'PATCH', 'DELETE'];
// Bean Conqueror's native POST may carry no Origin; this route uses HTTP Basic, never cookies.
const EXEMPT_PATH = '/api/shots/upload';

export function crossSiteFormBlocked(request: Request, url: URL): boolean {
  if (url.pathname === EXEMPT_PATH) return false;
  const type = request.headers.get('content-type')?.split(';', 1)[0].trim().toLowerCase() ?? '';
  return (
    FORM_TYPES.includes(type) &&
    UNSAFE.includes(request.method) &&
    request.headers.get('origin') !== url.origin
  );
}
