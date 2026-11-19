import { mkdirSync, readdirSync, readFileSync, renameSync, unlinkSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import satori from 'satori';
import sharp from 'sharp';
import { glue } from '#lib/unitGap.ts';
import { FLAG_SVG } from './flags';
import karlaLatin from './fonts/karla-latin-700-normal.woff?inline';
import karlaExt from './fonts/karla-latin-ext-700-normal.woff?inline';
import loraLatin from './fonts/lora-latin-600-normal.woff?inline';
import loraExt from './fonts/lora-latin-ext-600-normal.woff?inline';
import { pourShapes, type ChartTimeline } from '#lib/pourShapes.ts';
import { THUMB_TOKENS, type Thumb } from '#lib/linkPreview.ts';
import { smooth } from '#lib/smoothPath.ts';
import type { Tone } from './types';

export const CARD = { width: 1200, height: 630 };
const CARD_VERSION = 2; // bump when the template changes (cache file name)
const PAD = 72;

// Fonts are inlined (base64) so the adapter-node bundle needs no asset paths; text becomes paths, so no system fonts.
const font = (name: string, uri: string, weight: 600 | 700) => ({ name, data: Buffer.from(uri.slice(uri.indexOf(',') + 1), 'base64'), weight, style: 'normal' as const });
const FONTS = [font('Lora', loraLatin, 600), font('Lora', loraExt, 600), font('Karla', karlaLatin, 700), font('Karla', karlaExt, 700)];

// The tone hexes of src/app.css (light theme); dark ink on the light tones, cream elsewhere (as Slide.svelte).
const BG: Record<Tone, string> = {
  espresso: '#5c3a24', red: '#b23b3b', sun: '#f5c518', plum: '#8f456b', brown: '#8a5a3b', green: '#4a7c59', blue: '#2e6f9e',
  teal: '#2f7d6b', amber: '#e8a95c', violet: '#6a5acd', gold: '#a2600a', ink: '#2b211b', cream: '#f2ebe1'
};
const INK = '#2b211b', CREAM = '#faf7f2';
const ESPRESSO = '#5c3a24'; // --color-label: a page card's text and chart lines, on the app's page background
const fg = (t: Tone) => (t === 'sun' || t === 'amber' || t === 'cream' ? INK : CREAM);

export function cardFontSize(text: string, kind: 'big' | 'label'): number {
  const n = [...text].length;
  if (kind === 'label') return n <= 30 ? 48 : n <= 60 ? 40 : 32;
  return n <= 6 ? 220 : n <= 10 ? 160 : n <= 16 ? 120 : n <= 26 ? 88 : 64;
}

const WIDTH = CARD.width - 2 * PAD;
// A word never breaks mid-word: shrink below the step until the longest word fits one line (~0.62em per char, Lora caps).
const fit = (text: string, size: number, width = WIDTH) => Math.max(24, Math.min(size, Math.floor(width / (0.62 * Math.max(1, ...text.split(/\s+/).map((w) => [...w].length))))));
const el = (type: string, style: Record<string, unknown>, children?: unknown) => ({ type, props: { style, children } });

// A recipe's pour chart on a page card (the PourTimeline shapes), in card-legible colours: solid fills, no hairlines, bold swirls.
// Colours are the light theme's own (src/app.css): --fill-bloom = 50% mix of --series-4 and --series-11, --fill-fast = 75% --series-8 + white,
// --series-5 (medium), --series-6 (slow); bands --series-9, -7, -3 (a step lighter than the page's 0.6). Lines and swirls are espresso.
const CHART_H = 130;
const KIND_FILL = { bloom: '#df954a', fast: '#8faafe', medium: '#d8db80', slow: '#92dba9' };
const BAND_FILL = ['#ae57bb', '#7fdcea', '#ffb7c1'];
// A vertical sine line, 3 full waves over the chart height, as short segments (smooth at 2px steps).
const wave = (x: number) => Array.from({ length: CHART_H / 2 + 1 }, (_, i) => `${i ? 'L' : 'M'}${(x + 4 * Math.sin((i * 2 / CHART_H) * 6 * Math.PI)).toFixed(1)} ${i * 2}`).join(' ');
function chart(t: ChartTimeline) {
  const g = pourShapes(t, WIDTH, CHART_H), H = CHART_H;
  const node = (type: string, props: Record<string, unknown>) => ({ type, props });
  // One outline along the top of every pour's ramp and the holds between them, so it reads as a single line with no gaps at the joins.
  const top = g.shapes.map((sh) => { const p = sh.points.split(' '); return `${g.shapes[0] === sh ? 'M' : 'L'}${p[1].replace(',', ' ')} L${p[2].replace(',', ' ')}${sh.hold ? ` L${sh.hold.x1} ${sh.hold.y}` : ''}`; }).join(' ');
  const children = [
    ...g.windows.map((w) => node('rect', { x: w.x0, y: 0, width: w.x1 - w.x0, height: H, fill: BAND_FILL[Math.min(w.bloom, 2)], fillOpacity: 0.4 })),
    ...g.shapes.map((sh) => node('polygon', { points: sh.points, fill: KIND_FILL[sh.kind] })),
    node('rect', { x: 0, y: H - 4, width: WIDTH, height: 4, fill: ESPRESSO }),
    node('path', { d: top, fill: 'none', stroke: ESPRESSO, strokeWidth: 4, strokeLinejoin: 'round' }),
    ...g.swirls.map((x) => node('path', { d: wave(x), fill: 'none', stroke: ESPRESSO, strokeWidth: 5, strokeLinecap: 'round', strokeLinejoin: 'round' }))
  ];
  return node('svg', { width: WIDTH, height: H, viewBox: `0 0 ${WIDTH} ${H}`, style: { display: 'flex', flexShrink: 0, marginBottom: 24 }, children });
}

// A Stats view's thumbnail (the lower part of a page card, THUMB_H tall): app light-theme colours, nothing under 22px, no hairlines.
// Bars are --series-11 (#c06408) on the page background; medals are the gold/silver/bronze of the text preview's emoji.
const THUMB_H = 290;
const MEDAL_FILL = ['#f5c518', '#cfc9c1', '#d79a62'];
// Grid tiles cycle these by position (neighbours differ): [fill, title, edge] per series colour of src/app.css (light theme), in the order
// --series-1 blue, -4 orange, -6 green, -2 violet, -3 pink, -7 cyan. Fill = 25% of the series colour over --color-surface (#fff);
// edge = the series colour itself; title = the series' -ink mixed 30% into --color-text (#2b211b), >= 5.8:1 on its fill (values are espresso, >= 8.6:1).
const TILE_COLORS = [['#e9effe', '#4357a1', '#a8bffd'], ['#fef0e2', '#8b4a08', '#fdc58b'], ['#e4f6ea', '#10663a', '#92dba9'],
  ['#f6e9f8', '#824387', '#d9a6e3'], ['#ffedf0', '#9a3948', '#ffb7c1'], ['#dff6fa', '#11646a', '#7fdcea']];
// A name that starts with a flag emoji ("🇪🇹 Ethiopia", from originWithFlag) draws that flag as its own round image (the vendored
// circle-flags SVG, flags.ts) `flag` px wide, centred on the line, then the name, which truncates after it. No network, no emoji font.
const FLAG_START = /^([\u{1F1E6}-\u{1F1FF}]{2}) /u;
const flagUri = (emoji: string) => {
  const svg = FLAG_SVG[String.fromCharCode(...[...emoji].map((c) => c.codePointAt(0)! - 0x1f1e6 + 97))];
  return svg && `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
};
function named(text: string, flag: number, style: Record<string, unknown>) {
  const m = FLAG_START.exec(text), uri = m && flagUri(m[1]);
  if (!uri) return el('div', style, text);
  return el('div', { ...style, display: 'flex', alignItems: 'center', whiteSpace: 'normal' }, [
    { type: 'img', props: { src: uri, width: flag, height: flag, style: { flexShrink: 0, marginRight: 10 } } },
    el('div', { ...clipLine, flexGrow: 1, minWidth: 0 }, text.slice(m![0].length))
  ]);
}
const clipLine = { display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' };
const karla = { fontFamily: 'Karla', fontWeight: 700 };
// Values are never truncated, they shrink to fit `avail` px (~0.6em a character). Like values share one size when the longest
// only needs a small step down (VALUE_STEP: at least 80% of the default); a bigger step shrinks that value alone, so one long
// value doesn't make the rest look small. Never under `floor` (22px, or 30px for the grid, still legible at ~500px wide): a
// value that still doesn't fit there (an unreasonably long text, e.g. a grind setting) is cut with an ellipsis by the renderer.
const VALUE_STEP = 0.8;
export function valueSizes(values: string[], size: number, avail: number, floor = 22): number[] {
  const need = values.map((v) => Math.max(floor, Math.min(size, Math.floor(avail / (0.6 * Math.max(1, [...v].length))))));
  const least = Math.min(...need);
  return least >= size * VALUE_STEP ? need.map(() => least) : need;
}
// THUMB_TOKENS' light-theme hexes (src/app.css :root), by wire index.
const TOKEN_HEX = ['#a8bffd', '#d9a6e3', '#ffb7c1', '#fdc58b', '#d8db80', '#92dba9', '#7fdcea', '#698dfd', '#ae57bb', '#fc7184', '#c06408', '#abac11', '#069954', '#01baca', '#d2a679', '#b0703f', '#73503a', '#a8a8a8'];
if (TOKEN_HEX.length !== THUMB_TOKENS.length) throw new Error('TOKEN_HEX out of step with THUMB_TOKENS');
const LEGEND_H = 40, GAP = 8, STROKE = 7, LABEL = 28, XROW = 38, VAL_ROOM = 36;
// The page's soft bar fill (colour at b3 alpha) over the card background; bars get its --slice-line outline (INK), 2px at 1200 wide.
const soft = (hex: string, a = 0.7) => '#' + [1, 3, 5].map((i) => Math.round(parseInt(hex.slice(i, i + 2), 16) * a + parseInt(CREAM.slice(i, i + 2), 16) * (1 - a)).toString(16).padStart(2, '0')).join('');
const textW = (s: string) => Math.ceil(s.length * LABEL * 0.58); // Karla bold, generous
// Axis tick labels left to right: the first always shows, the last wins over the ones it would touch, any other that would overlap is dropped.
export function pickTicks(ticks: { cx: number; w: number }[], min = 10): number[] {
  const clash = (a: number, b: number) => Math.abs(ticks[a].cx - ticks[b].cx) < (ticks[a].w + ticks[b].w) / 2 + min;
  const keep: number[] = [];
  for (let i = 0; i < ticks.length - 1; i++) if (!keep.length || !clash(keep.at(-1)!, i)) keep.push(i);
  if (ticks.length > 1) {
    while (keep.length > 1 && clash(keep.at(-1)!, ticks.length - 1)) keep.pop();
    keep.push(ticks.length - 1);
  } else if (ticks.length) keep.push(0);
  return keep;
}
// A line's runs as monotone cubic Béziers (the page's Chart.js monotone, smoothPath.ts); a run of one point is a dot (round cap).
export function linePath(pts: ([number, number] | null)[]): string {
  const runs: [number, number][][] = [[]];
  for (const p of pts) { if (p) runs.at(-1)!.push(p); else if (runs.at(-1)!.length) runs.push([]); }
  const f = ([x, y]: [number, number]) => `${x.toFixed(1)} ${y.toFixed(1)}`;
  return runs.filter((r) => r.length).map((r) => (r.length === 1 ? `M${f(r[0])}L${f(r[0])}` : smooth(r))).join(' ');
}
// A chart (vbars / lines, chartThumb.ts): a legend row (more than one series), then the plot with its y labels on the left, data labels over
// the bars and a row of x tick labels under it. Everything is measured from the box, nothing overflows it.
function chartShape(t: Extract<Thumb, { kind: 'vbars' | 'lines' }>) {
  const node = (type: string, props: Record<string, unknown>) => ({ type, props });
  const n = t.series[0].values.length, k = t.series.length;
  const ticks = t.x ?? [];
  // Data labels go only where each fits over its own bar; they replace the y labels and rules (which would repeat them).
  const fits = (pw: number) => t.kind === 'vbars' && t.vals && t.vals.every((v) => textW(v) <= (pw - GAP * (n - 1)) / n + GAP - 4);
  const vals = fits(WIDTH) ? t.vals! : null;
  const y = vals ? undefined : t.y;
  const gutter = y ? Math.max(textW(y[0]), textW(y[1])) + 12 : 0;
  const PW = WIDTH - gutter, w = (PW - GAP * (n - 1)) / n;
  const top = vals ? VAL_ROOM : y ? LABEL / 2 + 1 : 0, bot = ticks.length ? XROW : 0;
  const legend = k > 1 ? LEGEND_H : 0, H = THUMB_H - legend - top - bot;
  const hex = (i: number, c = -1) => TOKEN_HEX[t.series[i].colors?.[c] ?? t.series[i].color];
  const kids: unknown[] = [];
  const over: unknown[] = []; // labels, absolutely placed in box coordinates
  const label = (s: string, left: number, y: number, width: number, align: 'center' | 'flex-end') => over.push(el('div', { position: 'absolute', left, top: y, width, height: LABEL, display: 'flex', justifyContent: align, alignItems: 'center', whiteSpace: 'nowrap', ...karla, fontSize: LABEL, lineHeight: 1, opacity: 0.85 }, s));
  const cx = (c: number) => gutter + (t.kind === 'vbars' ? c * (w + GAP) + w / 2 : STROKE / 2 + 1 + c * (PW - STROKE - 2) / (n - 1));
  if (y) { // two faint rules (the top value and the baseline) with their labels in the gutter
    kids.push(node('rect', { x: gutter, y: 0, width: PW, height: 2, fill: ESPRESSO, opacity: 0.15 }), node('rect', { x: gutter, y: H - 2, width: PW, height: 2, fill: ESPRESSO, opacity: 0.15 }));
    label(y[1], 0, top - LABEL / 2, gutter - 8, 'flex-end');
    label(y[0], 0, top + H - LABEL - 3, gutter - 8, 'flex-end'); // above the baseline, clear of the x row
  }
  if (t.kind === 'vbars') {
    const x0 = (c: number) => gutter + c * (w + GAP), bar = (x: number, y: number, bw: number, h: number, fill: string) => kids.push(node('rect', { x, y, width: bw, height: h, rx: Math.min(5, bw / 2, h / 2), fill: soft(fill), stroke: INK, strokeWidth: 2 }));
    for (let c = 0; c < n; c++) {
      let topY = H;
      if (t.stacked) {
        t.series.forEach((s, i) => { const h = (s.values[c] ?? 0) / 100 * H; if (h > 0) { topY -= h; bar(x0(c), topY, w, h, hex(i, c)); } });
      } else {
        t.series.forEach((s, i) => { const h = Math.max(3, (s.values[c] ?? 0) / 100 * H); topY = Math.min(topY, H - h); bar(x0(c) + i * w / k, H - h, w / k, h, hex(i, c)); });
      }
      if (vals) label(vals[c], x0(c) - GAP / 2, top + topY - LABEL - 6, w + GAP, 'center');
    }
  } else {
    const pad = STROKE / 2 + 1;
    t.series.forEach((s, i) => {
      const d = linePath(s.values.map((v, c) => (v == null ? null : [cx(c), H - pad - v / 100 * (H - 2 * pad)] as [number, number])));
      kids.push(node('path', { d, fill: 'none', stroke: hex(i), strokeWidth: STROKE, strokeLinecap: 'round', strokeLinejoin: 'round' }));
    });
  }
  if (ticks.length) {
    const spans = ticks.map(([i, s]) => ({ cx: cx(i), w: textW(s) }));
    for (const j of pickTicks(spans)) {
      const left = Math.min(WIDTH - spans[j].w, Math.max(0, spans[j].cx - spans[j].w / 2));
      label(ticks[j][1], left, top + H + (XROW - LABEL) / 2 + 2, spans[j].w, 'center');
    }
  }
  return [
    ...(k > 1 ? [el('div', { display: 'flex', alignItems: 'center', height: LEGEND_H, flexShrink: 0, overflow: 'hidden', ...karla, fontSize: 28 },
      t.series.map((s, i) => el('div', { display: 'flex', alignItems: 'center', marginRight: 32, whiteSpace: 'nowrap', maxWidth: WIDTH / k - 32, minWidth: 0, flexShrink: 1 }, [
        el('div', { width: 26, height: 26, boxSizing: 'border-box', borderRadius: 6, marginRight: 10, flexShrink: 0, background: soft(hex(i)), border: `2px solid ${INK}` }), el('div', { ...clipLine, minWidth: 0 }, s.label)])))] : []),
    el('div', { display: 'flex', position: 'relative', width: WIDTH, height: top + H + bot, flexShrink: 0 }, [
      node('svg', { width: WIDTH, height: H, viewBox: `0 0 ${WIDTH} ${H}`, style: { position: 'absolute', left: 0, top }, children: kids }),
      ...over
    ])
  ];
}
function thumbnail(t: Thumb) {
  const box = (children: unknown) => el('div', { display: 'flex', flexDirection: 'column', height: THUMB_H, flexShrink: 0, marginTop: 12, marginBottom: 24 }, children);
  if (t.kind === 'bars') {
    const sizes = valueSizes(t.rows.map((r) => r[1]), 30, 150);
    return box(t.rows.map(([label, value, frac], i) => el('div', { display: 'flex', alignItems: 'center', height: THUMB_H / 5, ...karla, fontSize: 30 }, [
      el('div', { display: 'flex', alignItems: 'center', justifyContent: 'center', width: 50, height: 50, borderRadius: 25, marginRight: 14, flexShrink: 0, fontSize: 34, background: !t.plain && i < 3 ? MEDAL_FILL[i] : 'transparent' }, String(i + 1)),
      named(label, 40, { ...clipLine, width: 380, flexShrink: 0 }),
      el('div', { display: 'flex', flexGrow: 1, height: 28, margin: '0 20px' }, el('div', { width: `${Math.max(2, Math.round(frac * 100))}%`, height: 28, boxSizing: 'border-box', background: soft('#8a5a3b', 0.28), // the page's leaderboard value bar: --map-high at --bar-alpha (28%) over the page background
     border: `2px solid ${INK}`, borderRadius: 6 })),
      el('div', { display: 'flex', justifyContent: 'flex-end', width: 150, flexShrink: 0, whiteSpace: 'nowrap', fontSize: sizes[i] }, value)
    ])));
  }
  if (t.kind === 'vbars' || t.kind === 'lines') return box(chartShape(t));
  if (t.kind === 'tile') {
    return box([
      el('div', { display: 'block', whiteSpace: 'nowrap', fontFamily: 'Lora', fontWeight: 600, fontSize: valueSizes([t.value], 150, WIDTH)[0], lineHeight: 1.1 }, t.value),
      named(t.holder, 44, { ...clipLine, ...karla, fontSize: 44, marginTop: 8 }),
      ...(t.date ? [el('div', { ...clipLine, ...karla, fontSize: 34, marginTop: 6, opacity: 0.85 }, t.date)] : [])
    ]);
  }
  // Up to 6 tiles, 3 across: the label (2 lines at most) over its value.
  const sizes = valueSizes(t.tiles.map((x) => x[1]), 52, 288, 30);
  const cell = (label: string, value: string, size: number, [fill, title, edge]: string[]) => el('div', { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', width: 336, height: 133, boxSizing: 'border-box', padding: '0 21px', background: fill, border: `3px solid ${edge}`, borderRadius: 16 }, [
    el('div', { display: 'block', lineClamp: 2, textOverflow: 'ellipsis', ...karla, color: title, fontSize: 26, lineHeight: 1.1 }, label),
    el('div', { ...clipLine, width: 288, textAlign: [...value].length * 0.6 * size > 288 ? 'left' : 'center', fontFamily: 'Lora', fontWeight: 600, fontSize: size, lineHeight: 1.15, marginTop: 6 }, value)
  ]);
  return el('div', { display: 'flex', flexWrap: 'wrap', gap: 24, width: WIDTH, height: THUMB_H, flexShrink: 0, marginTop: 12, marginBottom: 24 }, t.tiles.map(([l, v], j) => cell(l, v, sizes[j], TILE_COLORS[j % TILE_COLORS.length])));
}

// A page card (a page's link-preview) is always light, so it takes no tone; a recap card takes its tone.
type CardIn = { big: string; label: string; year: number; dark?: false; cover?: true } &
  ({ tone: Tone; page?: undefined; timeline?: undefined; thumb?: undefined } | { page: true; tone?: undefined; timeline?: ChartTimeline; thumb?: Thumb; coffee?: { photo?: { src: string; fill: string } } });
// A coffee card: the name from the top (a smaller step for a longer name, then cut), the roaster at the bottom, always smaller than
// the name; Bean Tracker small in the corner. With a photo, the photo full height on the right on the image's backdrop, the text beside it.
// ponytail: roaster is one line (cut), so the name's line cap needs no measuring.
export const PHOTO_W = 400, PHOTO_H = CARD.height - 2 * PAD;
const PHOTO_GAP = 48;
function coffeeCard(big: string, label: string, photo?: { src: string; fill: string }) {
  const w = photo ? WIDTH - PHOTO_W - PHOTO_GAP : WIDTH, size = fit(big, [...big].length <= 40 ? 96 : 72, w);
  return el('div', { display: 'flex', width: CARD.width, height: CARD.height, padding: PAD, boxSizing: 'border-box', background: CREAM, color: ESPRESSO, gap: PHOTO_GAP, position: 'relative' }, [
    el('div', { display: 'flex', flexDirection: 'column', justifyContent: 'space-between', width: w }, [
      el('div', { fontFamily: 'Lora', fontWeight: 600, lineHeight: 1.05, display: 'block', lineClamp: size > 72 ? 4 : 5, fontSize: size }, glue(big)),
      el('div', { fontFamily: 'Lora', fontWeight: 600, fontSize: Math.min(60, size - 12), lineHeight: 1.2, ...clipLine }, glue(label))
    ]),
    ...(photo ? [el('div', { display: 'flex', alignItems: 'center', justifyContent: 'center', width: PHOTO_W, height: PHOTO_H, flexShrink: 0, background: photo.fill, borderRadius: 16, overflow: 'hidden' },
      { type: 'img', props: { src: photo.src, width: PHOTO_W, height: PHOTO_H, style: { objectFit: 'contain' } } })] : []),
    el('div', { position: 'absolute', right: 32, bottom: 18, fontFamily: 'Karla', fontWeight: 700, fontSize: 30, opacity: 0.85 }, 'Bean Tracker')
  ]);
}

export async function cardSvg(c: CardIn): Promise<string> {
  if (c.page && c.coffee) return satori(coffeeCard(c.big, c.label, c.coffee.photo) as never, { width: CARD.width, height: CARD.height, fonts: FONTS });
  const color = c.page ? ESPRESSO : fg(c.tone);
  // "Roaster · Coffee" (a bag): two lines, the roaster smaller above the coffee name. `page` (a page's link-preview card) keeps big as one text, with a larger label and footer.
  const [rn, cn] = !c.page && c.big.includes(' · ') ? c.big.split(' · ', 2) : [null, c.big];
  // A page card keeps fixed sizes (cards side by side look alike): one headline size, a smaller step only for very long text.
  const bigSize = fit(cn, c.thumb ? 76 : c.page ? ([...cn].length <= 40 ? 96 : 72) : cardFontSize(rn ? (rn.length > cn.length ? rn : cn) : cn, 'big'));
  const bigStyle = { fontFamily: 'Lora', fontWeight: 600, lineHeight: 1.05, display: 'block', lineClamp: 2 };
  const lblSize = fit(c.label, c.thumb ? 38 : c.page ? 52 : cardFontSize(c.label, 'label'));
  const tree = el('div', { display: 'flex', flexDirection: 'column', justifyContent: 'space-between', width: CARD.width, height: CARD.height, padding: PAD, boxSizing: 'border-box', background: c.page ? CREAM : BG[c.tone], color }, [
    el('div', { display: 'flex', flexDirection: 'column', flexGrow: 1, justifyContent: c.thumb ? 'flex-start' : 'center' }, [
      ...(rn ? [el('div', { ...bigStyle, fontSize: Math.round(bigSize * 0.55), opacity: 0.85, marginBottom: 12 }, glue(rn))] : []),
      el('div', { ...bigStyle, fontSize: bigSize, ...(c.thumb && { lineClamp: 1 }) }, glue(cn)),
      el('div', { fontFamily: 'Karla', fontWeight: 700, fontSize: lblSize, lineHeight: 1.2, marginTop: c.thumb ? 8 : 20, display: 'block', lineClamp: c.thumb ? 1 : 2, textOverflow: 'ellipsis' }, glue(c.label))
    ]),
    ...(c.page && c.timeline?.pours.length ? [chart(c.timeline)] : []),
    ...(c.page && c.thumb ? [thumbnail(c.thumb)] : []),
    el('div', { display: 'flex', justifyContent: 'space-between', fontFamily: 'Karla', fontWeight: 700, fontSize: c.page ? 40 : 30, opacity: 0.85 }, [
      el('div', {}, c.cover ? '' : `${c.year} in coffee`), el('div', {}, 'Bean Tracker')
    ])
  ]);
  return satori(tree as never, { width: CARD.width, height: CARD.height, fonts: FONTS });
}

export const cardPng = (svg: string): Promise<Buffer> => sharp(Buffer.from(svg)).png().toBuffer();

// Next to the DB, outside data/images. ':memory:' (tests) falls back to data/.
export function cardsRoot(dbPath = process.env.DB_PATH ?? 'data/bean-tracker.db'): string {
  return join(dbPath === ':memory:' ? 'data' : dirname(dbPath), 'recap-cards');
}

// "_" can't occur in a slide id, so a prefix is exact. Written to a temp name (no "_" prefix match) then renamed: readers never see a partial file.
export async function cachedCard(key: { year: number; slide: string; stamp: string }, make: () => Promise<Buffer>): Promise<Buffer> {
  const root = cardsRoot(), prefix = `${key.year}_${key.slide}_`, name = `${prefix}${key.stamp}_v${CARD_VERSION}.png`, file = join(root, name);
  if (existsSync(file)) return readFileSync(file);
  const png = await make();
  try {
    mkdirSync(root, { recursive: true });
    const tmp = join(root, `.tmp-${process.pid}-${Math.random().toString(36).slice(2)}`);
    writeFileSync(tmp, png);
    renameSync(tmp, file);
    for (const f of readdirSync(root)) if (f.startsWith(prefix) && f !== name) try { unlinkSync(join(root, f)); } catch { /* already gone */ }
  } catch { /* the cache is best effort: serve the card anyway */ }
  return png;
}
