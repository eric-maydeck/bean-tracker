import { json } from '@sveltejs/kit';
import { guardedCheck, resolveClientIp } from './loginRateLimit';
import { verifyUploadAuth } from './visualizerUpload';

/** Rate limit + Basic auth for Bean Conqueror's calls; returns the refusal, or null when allowed. Reads no body. */
export async function uploadGate(request: Request, getClientAddress: () => string): Promise<Response | null> {
  const r = await guardedCheck('upload:' + resolveClientIp(request, getClientAddress), () => verifyUploadAuth(request.headers.get('authorization')));
  if (r.ok) return null;
  return r.reason === 'locked'
    ? json({ error: 'Too many failed uploads; try again later' }, { status: 429 })
    : json({ error: 'Wrong password' }, { status: 401 });
}
