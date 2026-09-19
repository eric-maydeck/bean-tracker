import { fail, redirect } from '@sveltejs/kit';
import type { Actions } from './$types';
import { SESSION_COOKIE_NAME, createSessionCookieValue } from '$lib/server/auth';
import { attemptLogin } from '$lib/server/loginRateLimit';

// Trustworthy only because bean-tracker's container has no host port
// mapping — the proxy is the only thing that can reach it directly, and
// The proxy sets this header reliably on proxied traffic (see
// docs/superpowers/specs/2026-09-19-public-access-design.md,
// Decision 7/8). Falls back to the direct socket address for local dev
// (`npm run dev`), where there is no proxy hop at all.
function resolveClientIp(request: Request, getClientAddress: () => string): string {
  return request.headers.get('cf-connecting-ip') ?? getClientAddress();
}

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
