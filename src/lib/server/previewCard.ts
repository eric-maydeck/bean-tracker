import { createHmac, timingSafeEqual } from 'node:crypto';
import type { Card } from '#lib/linkPreview.ts';

// The default preview card's text rides in its URL (/preview.png?c=…), so the URL is signed: only text a page
// rendered gets drawn, never text someone typed into a link. No SESSION_SECRET: nothing is signed or drawn.
const sig = (c: string, secret: string) => createHmac('sha256', secret).update(`preview-card:${c}`).digest('base64url').slice(0, 22);

// SSR HTML: append the signature to each card URL PreviewMeta wrote (in an attribute, so `&amp;`).
export function signPreviewUrls(html: string, secret = process.env.SESSION_SECRET): string {
  return secret ? html.replace(/\/preview\.png\?c=([A-Za-z0-9_-]+)/g, (m, c: string) => `${m}&amp;s=${sig(c, secret)}`) : html;
}

export function verifyCard(c: string | null, s: string | null, secret = process.env.SESSION_SECRET): Card | null {
  if (!secret || !c || !s) return null;
  const want = Buffer.from(sig(c, secret)), got = Buffer.from(s);
  if (want.length !== got.length || !timingSafeEqual(want, got)) return null;
  try {
    const [big, label] = JSON.parse(Buffer.from(c, 'base64url').toString('utf8'));
    return typeof big === 'string' && typeof label === 'string' ? { big, label } : null;
  } catch {
    return null;
  }
}
