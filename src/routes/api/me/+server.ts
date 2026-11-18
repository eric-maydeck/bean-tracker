import type { RequestHandler } from './$types';
import { uploadGate } from '#lib/server/uploadGate.ts';

// Bean Conqueror checks the upload credentials here before sending anything.
export const GET: RequestHandler = async ({ request, getClientAddress }) =>
  (await uploadGate(request, getClientAddress)) ?? Response.json({ id: 'bean-tracker', name: 'Bean Tracker' });
