import { fail, redirect } from '@sveltejs/kit';
import type { Actions } from './$types';
import { SESSION_COOKIE_NAME, createSessionCookieValue, verifyPassword } from '$lib/server/auth';

export const actions: Actions = {
  login: async ({ request, cookies }) => {
    const formData = await request.formData();
    const password = String(formData.get('password') ?? '');
    const storedHash = process.env.ADMIN_PASSWORD_HASH;
    if (!storedHash || !password || !verifyPassword(password, storedHash)) {
      return fail(400, { error: 'Incorrect password' });
    }
    cookies.set(SESSION_COOKIE_NAME, createSessionCookieValue(), {
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
      // SvelteKit defaults `secure: true` for any hostname other than
      // literally 'localhost' — the app is served over plain HTTP today
      // (LAN, and the server's current public URL), so a `Secure` cookie would
      // be silently dropped by the browser and never sent back, leaving
      // every login look successful but never actually authenticate.
      // Revisit once/if this sits behind TLS (see spec's non-goals).
      secure: false,
      maxAge: 60 * 60 * 24
    });
    redirect(303, '/');
  },
  logout: async ({ cookies }) => {
    cookies.delete(SESSION_COOKIE_NAME, { path: '/', secure: false });
    redirect(303, '/');
  }
};
