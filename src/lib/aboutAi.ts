import { pickOne } from './pageUrlState';

// The contact address by request host: fuhnoo.coffee (and subdomains) has its own; everything else (maydeck.net, LAN, localhost) uses the personal one.
export function contactEmailFor(host: string): string {
  const h = host.toLowerCase().replace(/:\d+$/, '').replace(/\.$/, '');
  return h === 'fuhnoo.coffee' || h.endsWith('.fuhnoo.coffee') ? 'contact@example.com' : 'eric@maydeck.net';
}

// `?about=ai` opens the "How this site was built" dialog.
export const aboutAiOpen = (p: URLSearchParams): boolean => pickOne(p, 'about', ['ai'] as const) === 'ai';
