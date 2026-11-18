import { pickOne, type ReadParams } from './pageUrlState';

// /account view state: the Not yet tracked list is capped at 3 rows; `untracked=all` opens it. Bare = capped.
export const UNTRACKED_CAP = 3;
export const parseAccount = (p: ReadParams) => ({ untracked: pickOne(p, 'untracked', ['all'] as const) });
export const accountQuery = (a: { untracked?: 'all' }) => (a.untracked ? `?untracked=${a.untracked}` : '');
