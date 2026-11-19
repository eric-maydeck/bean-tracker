import { createHmac, timingSafeEqual } from 'node:crypto';
import { PHOTO_RE, THUMB_TOKENS, type Card, type Thumb, type ThumbSeries } from '#lib/linkPreview.ts';
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
    const [big, label, t, th, ph] = JSON.parse(Buffer.from(c, 'base64url').toString('utf8'));
    if (typeof big !== 'string' || typeof label !== 'string') return null;
    const timeline = t == null ? undefined : decodeTimeline(t);
    if (timeline === null) return null;
    const thumb = th == null ? undefined : decodeThumb(th);
    if (thumb === null) return null;
    const photo = ph != null && row(ph, 2) && typeof ph[0] === 'string' && PHOTO_RE.test(ph[0]) && typeof ph[1] === 'string' && /^#[0-9a-f]{6}$/i.test(ph[1]);
    if (ph != null && !photo && !row(ph, 0)) return null;
    return { big, label, ...(timeline && { timeline }), ...(thumb && { thumb }), ...(ph && { coffee: photo ? { photo: { src: ph[0], fill: ph[1] } } : {} }) };
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

const MAX_SERIES = 3, MAX_POINTS = 40;
// A chart thumbnail's series: 1..3, each [label, THUMB_TOKENS index, values]; 2..40 equal-length ints 0..100 (`null` gaps only when `gaps`).
function decodeSeries(v: unknown, gaps: boolean): ThumbSeries[] | null {
  if (!list(v, MAX_SERIES) || !v.length) return null;
  const out: ThumbSeries[] = [];
  for (const r of v) {
    if (!row(r, 3) || !text(r[0]) || !Number.isInteger(r[1]) || (r[1] as number) < 0 || (r[1] as number) >= THUMB_TOKENS.length) return null;
    const vals = r[2];
    if (!Array.isArray(vals) || vals.length < 2 || vals.length > MAX_POINTS || vals.length !== (out[0]?.values.length ?? vals.length)) return null;
    if (!vals.every((x) => (gaps && x === null) || (Number.isInteger(x) && x >= 0 && x <= 100))) return null;
    out.push({ label: r[0], color: r[1] as number, values: vals });
  }
  return out;
}

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
  if (t[0] === 'vbars' && row(t, 3)) {
    const series = decodeSeries(t[1], false);
    return series && { kind: 'vbars', series, ...(t[2] === 1 && { stacked: true }) };
  }
  if (t[0] === 'lines' && row(t, 2)) {
    const series = decodeSeries(t[1], true);
    return series && { kind: 'lines', series };
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
