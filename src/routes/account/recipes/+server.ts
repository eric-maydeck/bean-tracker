import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

// Recipes moved to the public /recipes page (2026-10-29); old links and short links keep their query.
export const GET: RequestHandler = ({ url }) => redirect(301, '/recipes' + url.search);
