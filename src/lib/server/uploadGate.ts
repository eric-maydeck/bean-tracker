import { json } from '@sveltejs/kit';
import type { DatabaseSync } from 'node:sqlite';
import { isLockedOut, recordFailedAttempt, recordSuccessfulAttempt, resolveClientIp } from './loginRateLimit';
import { verifyUploadAuth } from './visualizerUpload';

/** Rate limit + Basic auth for Bean Conqueror's calls; returns the refusal, or null when allowed. Reads no body. */
export function uploadGate(db: DatabaseSync, request: Request, getClientAddress: () => string): Response | null {
  const key = 'upload:' + resolveClientIp(request, getClientAddress);
  if (isLockedOut(key)) return json({ error: 'Too many failed uploads; try again later' }, { status: 429 });
  if (!verifyUploadAuth(db, request.headers.get('authorization'))) {
    recordFailedAttempt(key);
    return json({ error: 'Wrong upload password' }, { status: 401 });
  }
  recordSuccessfulAttempt(key);
  return null;
}
