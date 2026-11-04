import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

// The Recaps tab is the one recaps page: /recaps goes there (nothing else rides along). The tab says when there is nothing to show.
export const load: PageServerLoad = () => redirect(307, '/insights?tab=recaps');
