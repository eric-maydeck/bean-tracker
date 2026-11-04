import { mkdirSync, readdirSync, readFileSync, renameSync, unlinkSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import satori from 'satori';
import sharp from 'sharp';
import { glue } from '$lib/unitGap';
import karlaLatin from './fonts/karla-latin-700-normal.woff?inline';
import karlaExt from './fonts/karla-latin-ext-700-normal.woff?inline';
import loraLatin from './fonts/lora-latin-600-normal.woff?inline';
import loraExt from './fonts/lora-latin-ext-600-normal.woff?inline';
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

export async function cardSvg(c: { big: string; label: string; year: number; tone: Tone; dark?: false; cover?: true }): Promise<string> {
  const color = fg(c.tone);
  // "Roaster · Coffee" (a bag): two lines, the roaster smaller above the coffee name.
  const [rn, cn] = c.big.includes(' · ') ? c.big.split(' · ', 2) : [null, c.big];
  const bigSize = fit(cn, cardFontSize(rn ? (rn.length > cn.length ? rn : cn) : cn, 'big'));
  const bigStyle = { fontFamily: 'Lora', fontWeight: 600, lineHeight: 1.05, display: 'block', lineClamp: 2 };
  const lblSize = fit(c.label, cardFontSize(c.label, 'label'));
  const tree = el('div', { display: 'flex', flexDirection: 'column', justifyContent: 'space-between', width: CARD.width, height: CARD.height, padding: PAD, boxSizing: 'border-box', background: BG[c.tone], color }, [
    el('div', { display: 'flex', flexDirection: 'column', flexGrow: 1, justifyContent: 'center' }, [
      ...(rn ? [el('div', { ...bigStyle, fontSize: Math.round(bigSize * 0.55), opacity: 0.85, marginBottom: 12 }, glue(rn))] : []),
      el('div', { ...bigStyle, fontSize: bigSize }, glue(cn)),
      el('div', { fontFamily: 'Karla', fontWeight: 700, fontSize: lblSize, lineHeight: 1.2, marginTop: 20, display: 'block', lineClamp: 2, textOverflow: 'ellipsis' }, glue(c.label))
    ]),
    el('div', { display: 'flex', justifyContent: 'space-between', fontFamily: 'Karla', fontWeight: 700, fontSize: 30, opacity: 0.85 }, [
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
