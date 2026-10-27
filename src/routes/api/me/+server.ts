import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { uploadGate } from '$lib/server/uploadGate';

// Bean Conqueror checks the upload credentials here before sending anything.
export const GET: RequestHandler = ({ request, getClientAddress }) =>
  uploadGate(request, getClientAddress) ?? json({ id: 'bean-tracker', name: 'Bean Tracker' });
