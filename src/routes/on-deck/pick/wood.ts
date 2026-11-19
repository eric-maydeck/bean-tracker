// Procedural wood for the Pick for me play surfaces (the D20 tray and the wheel's board): canvas-drawn, no image assets.
type G = CanvasRenderingContext2D;

const WALNUT = ['#3a2416', '#402818', '#352013', '#472d1b'];
const OAK = ['#a8743f', '#b07c46', '#9c6a3a', '#b98650'];
export const WALNUT_DARK = '#1a100a'; // behind the counter, before anything is painted

// Seeded, so every repaint (a resize, a restored WebGL context) draws the same boards.
function rng(seed: number) { return () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296); }

function planks(g: G, w: number, h: number, tones: string[], rows: number, seed: number) {
  const r = rng(seed), ph = h / rows;
  for (let p = 0; p < rows; p++) {
    const y0 = p * ph;
    g.fillStyle = tones[Math.floor(r() * tones.length)]; g.fillRect(0, y0, w, ph + 1);
    g.save(); g.beginPath(); g.rect(0, y0, w, ph); g.clip();
    for (let i = 0; i < 46; i++) { // grain: long wavy hairlines, dark and light
      const y = y0 + r() * ph, amp = 1 + r() * 5, f = 0.004 + r() * 0.01, ph0 = r() * 7;
      g.strokeStyle = r() > 0.35 ? `rgba(20,10,4,${0.05 + r() * 0.13})` : `rgba(255,220,170,${0.03 + r() * 0.07})`;
      g.lineWidth = 0.6 + r() * 1.6; g.beginPath();
      for (let x = 0; x <= w; x += 16) g.lineTo(x, y + Math.sin(x * f + ph0) * amp);
      g.stroke();
    }
    if (r() > 0.45) { // a knot
      const kx = r() * w, ky = y0 + ph * (0.3 + r() * 0.4);
      for (let k = 1; k < 6; k++) { g.strokeStyle = `rgba(20,10,4,${0.22 - k * 0.03})`; g.lineWidth = 1.2; g.beginPath(); g.ellipse(kx, ky, k * 7, k * 2.6, 0, 0, 7); g.stroke(); }
    }
    g.restore();
    g.fillStyle = 'rgba(0,0,0,0.5)'; g.fillRect(0, y0, w, 2); g.fillStyle = 'rgba(255,225,180,0.08)'; g.fillRect(0, y0 + 2, w, 1); // seam
    g.fillStyle = 'rgba(0,0,0,0.45)'; g.fillRect(r() * w, y0, 2, ph); // butt joint
  }
}

/** The walnut counter around the board. */
export function paintCounter(g: G, w: number, h: number) { planks(g, w, h, WALNUT, 4, 5); }

/** The oak board with its brass inlay: `inset` is the inlay's distance from the edge, `line` its width (canvas pixels). */
export function paintBoard(g: G, w: number, h: number, inset: number, line: number) {
  planks(g, w, h, OAK, 5, 9);
  const v = g.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.25, w / 2, h / 2, Math.max(w, h) * 0.72);
  v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.3)');
  g.fillStyle = v; g.fillRect(0, 0, w, h);
  const brass = g.createLinearGradient(0, 0, w, h);
  for (const [s, c] of [[0, '#8a6214'], [0.25, '#f3d58a'], [0.5, '#b8862b'], [0.75, '#ffe9a8'], [1, '#8a6214']] as const) brass.addColorStop(s, c);
  const rect = () => { g.beginPath(); g.roundRect(inset, inset, w - inset * 2, h - inset * 2, inset * 0.6); g.stroke(); };
  g.strokeStyle = 'rgba(0,0,0,0.45)'; g.lineWidth = line * 1.5; rect(); // the routed groove
  g.strokeStyle = brass; g.lineWidth = line; rect();
}
