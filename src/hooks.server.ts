import { json, text, type Handle, type ServerInit } from '@sveltejs/kit';
import { bodyTooLarge, crossSiteBlocked, SECURITY_HEADERS } from '$lib/server/csrf';
import { SESSION_COOKIE_NAME, verifySessionCookieValue } from '$lib/server/auth';
import { getDb } from '$lib/server/db';
import { queueFillMissing } from '$lib/server/imageFills';
import { queueReadings } from '$lib/server/pourReadings';
import { backfillRoasterWebsites } from '$lib/server/roasterWebsites';

// Backdrop fills for images that have none yet (saved before fills existed,
// or failed on the last run). Not awaited: boot never waits on the network.
export const init: ServerInit = () => {
  const db = getDb();
  // Sync and local: roaster sites from known product URLs (image Suggest).
  backfillRoasterWebsites(db);
  void queueFillMissing(db);
  queueReadings(db).catch((e) => console.error('pour readings failed', e));
};

const secured = (res: Response) => {
  for (const [k, v] of Object.entries(SECURITY_HEADERS)) res.headers.set(k, v);
  return res;
};

export const handle: Handle = async ({ event, resolve }) => {
  if (crossSiteBlocked(event.request, event.url)) {
    const message = `Cross-site ${event.request.method} requests are forbidden`;
    // use:enhance only shows an ActionResult; a bare 403 left the form silently doing nothing.
    if (event.request.headers.get('x-sveltekit-action') === 'true')
      return secured(json({ type: 'error', error: { message } }, { status: 403 }));
    return secured(event.request.headers.get('accept') === 'application/json'
      ? json({ message }, { status: 403 })
      : text(message, { status: 403 }));
  }
  const cookie = event.cookies.get(SESSION_COOKIE_NAME);
  event.locals.isAdmin = cookie != null && verifySessionCookieValue(cookie);
  if (bodyTooLarge(event.request, event.url, event.locals.isAdmin))
    return secured(text('Request body too large', { status: 413 }));
  return secured(await resolve(event));
};
