import type { Handle, ServerInit } from '@sveltejs/kit';
import { SESSION_COOKIE_NAME, verifySessionCookieValue } from '$lib/server/auth';
import { getDb } from '$lib/server/db';
import { queueFillMissing } from '$lib/server/imageFills';

// Backdrop fills for images that have none yet (saved before fills existed,
// or failed on the last run). Not awaited: boot never waits on the network.
export const init: ServerInit = () => {
  void queueFillMissing(getDb());
};

export const handle: Handle = async ({ event, resolve }) => {
  const cookie = event.cookies.get(SESSION_COOKIE_NAME);
  event.locals.isAdmin = cookie != null && verifySessionCookieValue(cookie);
  return resolve(event);
};
