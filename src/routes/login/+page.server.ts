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
      maxAge: 60 * 60 * 24
    });
    redirect(303, '/');
  },
  logout: async ({ cookies }) => {
    cookies.delete(SESSION_COOKIE_NAME, { path: '/' });
    redirect(303, '/');
  }
};
