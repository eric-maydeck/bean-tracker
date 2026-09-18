import type { Handle } from '@sveltejs/kit';
import { SESSION_COOKIE_NAME, verifySessionCookieValue } from '$lib/server/auth';

export const handle: Handle = async ({ event, resolve }) => {
  const cookie = event.cookies.get(SESSION_COOKIE_NAME);
  event.locals.isAdmin = cookie != null && verifySessionCookieValue(cookie);
  return resolve(event);
};
