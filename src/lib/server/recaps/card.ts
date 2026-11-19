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
import type { Thumb } from '#lib/linkPreview.ts';
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
const fit = (text: string, size: number) => Math.max(24, Math.min(size, Math.floor(WIDTH / (0.62 * Math.max(1, ...text.split(/\s+/).map((w) => [...w].length))))));
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
const BAR = '#c06408',
   MEDAL_FILL = ['#f5c518', '#cfc9c1', '#d79a62'];
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
function thumbnail(t: Thumb) {
  const box = (children: unknown) => el('div', { display: 'flex', flexDirection: 'column', height: THUMB_H, flexShrink: 0, marginTop: 12, marginBottom: 24 }, children);
  if (t.kind === 'bars') {
    const sizes = valueSizes(t.rows.map((r) => r[1]), 30, 150);
    return box(t.rows.map(([label, value, frac], i) => el('div', { display: 'flex', alignItems: 'center', height: THUMB_H / 5, ...karla, fontSize: 30 }, [
      el('div', { display: 'flex', alignItems: 'center', justifyContent: 'center', width: 50, height: 50, borderRadius: 25, marginRight: 14, flexShrink: 0, fontSize: 34, background: !t.plain && i < 3 ? MEDAL_FILL[i] : 'transparent' }, String(i + 1)),
      named(label, 40, { ...clipLine, width: 380, flexShrink: 0 }),
      el('div', { display: 'flex', flexGrow: 1, height: 28, margin: '0 20px' }, el('div', { width: `${Math.max(2, Math.round(frac * 100))}%`, height: 28, background: BAR, borderRadius: 6 })),
      el('div', { display: 'flex', justifyContent: 'flex-end', width: 150, flexShrink: 0, whiteSpace: 'nowrap', fontSize: sizes[i] }, value)
    ])));
  }
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
  ({ tone: Tone; page?: undefined; timeline?: undefined; thumb?: undefined } | { page: true; tone?: undefined; timeline?: ChartTimeline; thumb?: Thumb });
export async function cardSvg(c: CardIn): Promise<string> {
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
