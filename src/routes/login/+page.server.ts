import { fail, redirect } from '@sveltejs/kit';
import { dev } from '$app/environment';
import type { Actions } from './$types';
import {
  SESSION_COOKIE_NAME,
  SESSION_DURATION_MS,
  REMEMBERED_SESSION_DURATION_MS,
  createSessionCookieValue,
  safeRedirectTarget
} from '$lib/server/auth';
import { attemptLogin, resolveClientIp } from '$lib/server/loginRateLimit';

export const actions: Actions = {
  login: async ({ request, cookies, getClientAddress }) => {
    const formData = await request.formData();
    const password = String(formData.get('password') ?? '');
    const remember = formData.get('remember') != null;
    const ip = resolveClientIp(request, getClientAddress);
    const result = attemptLogin(ip, password, process.env.ADMIN_PASSWORD_HASH);
    if (!result.ok) {
      if (result.reason === 'locked') {
        return fail(429, { error: 'Too many attempts. Try again later.' });
      }
      return fail(400, { error: 'Incorrect password' });
    }
    const durationMs = remember ? REMEMBERED_SESSION_DURATION_MS : SESSION_DURATION_MS;
    cookies.set(SESSION_COOKIE_NAME, createSessionCookieValue(durationMs), {
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
      // The app is single-origin and HTTPS-only, so there is no plain-HTTP path
      // left for a Secure cookie to be silently dropped on. Exception: the local
      // dev server, which is plain HTTP; browsers only accept a Secure cookie over
      // HTTP on localhost, so logging in from a phone via the LAN IP silently failed.
      secure: !dev,
      maxAge: durationMs / 1000
    });
    redirect(303, safeRedirectTarget(String(formData.get('redirectTo') ?? '')));
  },
  logout: async ({ cookies }) => {
    cookies.delete(SESSION_COOKIE_NAME, { path: '/', secure: !dev });
    redirect(303, '/coffees');
  }
};
