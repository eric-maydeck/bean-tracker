import { pickOne } from './pageUrlState';

// `?about=ai` opens the "How this site was built" dialog.
export const aboutAiOpen = (p: URLSearchParams): boolean => pickOne(p, 'about', ['ai'] as const) === 'ai';
