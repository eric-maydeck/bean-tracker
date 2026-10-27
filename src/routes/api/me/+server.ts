import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb } from '$lib/server/db';
import { uploadGate } from '$lib/server/uploadGate';

// Bean Conqueror checks the upload credentials here before sending anything.
export const GET: RequestHandler = ({ request, getClientAddress }) =>
  uploadGate(getDb(), request, getClientAddress) ?? json({ id: 'bean-tracker', name: 'Bean Tracker' });
