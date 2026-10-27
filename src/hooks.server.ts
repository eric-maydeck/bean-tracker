import { json, text, type Handle, type ServerInit } from '@sveltejs/kit';
import { crossSiteFormBlocked } from '$lib/server/csrf';
import { SESSION_COOKIE_NAME, verifySessionCookieValue } from '$lib/server/auth';
import { getDb } from '$lib/server/db';
import { queueFillMissing } from '$lib/server/imageFills';
import { backfillRoasterWebsites } from '$lib/server/roasterWebsites';

// Backdrop fills for images that have none yet (saved before fills existed,
// or failed on the last run). Not awaited: boot never waits on the network.
export const init: ServerInit = () => {
  const db = getDb();
  // Sync and local: roaster sites from known product URLs (image Suggest).
  backfillRoasterWebsites(db);
  void queueFillMissing(db);
};

export const handle: Handle = async ({ event, resolve }) => {
  if (crossSiteFormBlocked(event.request, event.url)) {
    const message = `Cross-site ${event.request.method} form submissions are forbidden`;
    return event.request.headers.get('accept') === 'application/json'
      ? json({ message }, { status: 403 })
      : text(message, { status: 403 });
  }
  const cookie = event.cookies.get(SESSION_COOKIE_NAME);
  event.locals.isAdmin = cookie != null && verifySessionCookieValue(cookie);
  return resolve(event);
};
