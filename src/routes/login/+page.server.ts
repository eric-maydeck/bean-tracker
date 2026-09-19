import { fail, redirect } from '@sveltejs/kit';
import type { Actions } from './$types';
import { SESSION_COOKIE_NAME, createSessionCookieValue } from '$lib/server/auth';
import { attemptLogin, resolveClientIp } from '$lib/server/loginRateLimit';

export const actions: Actions = {
  login: async ({ request, cookies, getClientAddress }) => {
    const formData = await request.formData();
    const password = String(formData.get('password') ?? '');
    const ip = resolveClientIp(request, getClientAddress);
    const result = attemptLogin(ip, password, process.env.ADMIN_PASSWORD_HASH);
    if (!result.ok) {
      if (result.reason === 'locked') {
        return fail(429, { error: 'Too many attempts. Try again later.' });
      }
      return fail(400, { error: 'Incorrect password' });
    }
    cookies.set(SESSION_COOKIE_NAME, createSessionCookieValue(), {
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
      // The app is single-origin and HTTPS-only (reverse proxy at
      // coffee.maydeck.net) as of the reverse proxy project — there is
      // no plain-HTTP path left for a Secure cookie to be silently dropped
      // on. See docs/superpowers/specs/2026-09-19-public-
      // access-design.md, Decision 9.
      secure: true,
      maxAge: 60 * 60 * 24
    });
    redirect(303, '/');
  },
  logout: async ({ cookies }) => {
    cookies.delete(SESSION_COOKIE_NAME, { path: '/', secure: true });
    redirect(303, '/');
  }
};
