import { createHmac, timingSafeEqual } from 'node:crypto';
import type { Card, Thumb } from '#lib/linkPreview.ts';
import { KINDS, type ChartTimeline } from '#lib/pourShapes.ts';

// Feature flag for epic #27 (link-preview images): off in prod until the epic ships, then delete it and its checks.
export const previewCardsOn = (): boolean => process.env.PREVIEW_CARDS === '1';

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
    const [big, label, t, th] = JSON.parse(Buffer.from(c, 'base64url').toString('utf8'));
    if (typeof big !== 'string' || typeof label !== 'string') return null;
    const timeline = t == null ? undefined : decodeTimeline(t);
    if (timeline === null) return null;
    const thumb = th === undefined ? undefined : decodeThumb(th);
    if (thumb === null) return null;
    return { big, label, ...(timeline && { timeline }), ...(thumb && { thumb }) };
  } catch {
    return null;
  }
}

// Signed, but still untrusted shape: finite, bounded numbers and capped lengths, so a bad card can't make the renderer do unbounded work.
const MAX_POURS = 60, MAX_S = 7200, MAX_G = 5000;
const num = (v: unknown, max: number): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= max;
const list = (v: unknown, cap: number): v is unknown[] => Array.isArray(v) && v.length <= cap;
const row = (v: unknown, n: number): v is unknown[] => Array.isArray(v) && v.length === n;

const MAX_TEXT = 80, MAX_ROWS = 5, MAX_TILES = 6;
const text = (v: unknown): v is string => typeof v === 'string' && v.length <= MAX_TEXT;

function decodeThumb(t: unknown): Thumb | null {
  if (!Array.isArray(t)) return null;
  if (t[0] === 'bars' && row(t, 3) && list(t[1], MAX_ROWS) && t[1].length > 0) {
    const rows: [string, string, number][] = [];
    for (const r of t[1]) {
      if (!row(r, 3) || !text(r[0]) || !text(r[1]) || !num(r[2], 1)) return null;
      rows.push([r[0], r[1], r[2]]);
    }
    return { kind: 'bars', rows, ...(t[2] === 1 && { plain: true }) };
  }
  if (t[0] === 'tile' && row(t, 4) && text(t[1]) && text(t[2]) && text(t[3])) return { kind: 'tile', value: t[1], holder: t[2], ...(t[3] && { date: t[3] }) };
  if (t[0] === 'grid' && row(t, 2) && list(t[1], MAX_TILES) && t[1].length > 0) {
    const tiles: [string, string][] = [];
    for (const r of t[1]) {
      if (!row(r, 2) || !text(r[0]) || !text(r[1])) return null;
      tiles.push([r[0], r[1]]);
    }
    return { kind: 'grid', tiles };
  }
  return null;
}

function decodeTimeline(t: unknown): ChartTimeline | null {
  if (!row(t, 4)) return null;
  const [pours, swirls, totalS, windows] = t;
  if (!list(pours, MAX_POURS) || !list(swirls, MAX_POURS) || !list(windows, MAX_POURS) || !num(totalS, MAX_S)) return null;
  const out: ChartTimeline = { pours: [], swirls: [], totalS, windows: [] };
  for (const p of pours) {
    if (!row(p, 4) || !num(p[0], MAX_S) || !num(p[1], MAX_S) || !num(p[2], MAX_G) || !Number.isInteger(p[3]) || !KINDS[p[3] as number]) return null;
    out.pours.push({ startS: p[0], durationS: p[1], grams: p[2], kind: KINDS[p[3] as number] });
  }
  for (const s of swirls) {
    if (!num(s, MAX_S)) return null;
    out.swirls.push(s);
  }
  for (const w of windows) {
    if (!row(w, 3) || !num(w[0], MAX_S) || !num(w[1], MAX_S) || !num(w[2], 20)) return null;
    out.windows!.push({ startS: w[0], targetS: w[1], bloom: w[2] });
  }
  return out;
}
