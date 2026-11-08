// Replaces SvelteKit's built-in origin check (svelte.config.js turns it off) so one
// path can be exempt, and widens it from form posts to every mutating request, JSON included.
const UNSAFE = ['POST', 'PUT', 'PATCH', 'DELETE'];
// Bean Conqueror's native POST may carry no Origin; this route uses HTTP Basic, never cookies.
const EXEMPT_PATH = '/api/shots/upload';

export function crossSiteBlocked(request: Request, url: URL): boolean {
  if (url.pathname === EXEMPT_PATH) return false;
  return UNSAFE.includes(request.method) && request.headers.get('origin') !== url.origin;
}

// Anonymous callers never legitimately send more than a short JSON body; the upload path has its own gate.
const MAX_ANON_BODY_BYTES = 64 * 1024;

/** True when a non-admin request carries a body over 64KB, or one of unknown size (chunked). */
export function bodyTooLarge(request: Request, url: URL, isAdmin: boolean): boolean {
  if (isAdmin || url.pathname === EXEMPT_PATH || request.body === null) return false;
  const length = request.headers.get('content-length');
  return length === null || !(Number(length) <= MAX_ANON_BODY_BYTES);
}

export const SECURITY_HEADERS: Record<string, string> = {
  'Strict-Transport-Security': 'max-age=31536000',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Content-Security-Policy': "frame-ancestors 'none'",
  'Referrer-Policy': 'strict-origin-when-cross-origin'
};
