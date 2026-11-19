<script lang="ts">
  import { onMount, untrack } from 'svelte';
  import { sliceAt } from '#lib/pick/wheel.ts';
  import type { WheelSlice } from '#lib/pick/types.ts';
  import { paintBoard } from './wood';

  let { slices, names, angle = 0, disabled = false, onspin, onresult }: {
    slices: WheelSlice[]; names: Map<number, string>; angle: number; disabled: boolean;
    onspin: () => void; onresult: (s: WheelSlice, angle: number) => void;
  } = $props();

  const TAU = Math.PI * 2;
  const BASE = 460; // drawing space; the canvas bitmap scales from this
  // Wood-veneer wedges, each with the label colour that reads on it; the same in both themes, like the board under the wheel.
  const VENEER = [['#5c3a24', '#f6eee2'], ['#c49a6c', '#2b211b'], ['#7a4326', '#f6eee2'], ['#e3c9a0', '#2b211b'], ['#43281a', '#f6eee2'], ['#bb8350', '#2b211b']];

  let width = $state(BASE);
  let spinning = $state(false);
  let vignette = $state(false);
  let shake = $state(false);
  let wheel: HTMLCanvasElement;
  let fx: HTMLCanvasElement;
  let rot = 0; // current rotation, radians
  let shimmer = 0;
  let shakeRaf = 0;
  let board: HTMLCanvasElement;
  let boardW = $state(0);
  let boardH = $state(0);
  let confetti: { x: number; y: number; vx: number; vy: number; life: number; r: number; c: string }[] = [];
  let kindOfBurst: 'success' | 'fail' = 'success';

  // A restored angle just moves the wheel; a settled spin must not be reset by the stale prop.
  $effect(() => { const a = angle; untrack(() => { if (!spinning) rot = a; }); });

  const dpr = () => (typeof devicePixelRatio === 'number' ? devicePixelRatio : 1);
  const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

  function star(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
    ctx.beginPath();
    for (let i = 0; i < 8; i++) { const a = (i * Math.PI) / 4, rr = i % 2 ? r * 0.4 : r; ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
    ctx.closePath(); ctx.fill();
  }
  function skull(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
    ctx.fillStyle = '#e8d9d9'; ctx.beginPath(); ctx.arc(x, y - r * 0.15, r * 0.7, 0, 7); ctx.fill(); ctx.fillRect(x - r * 0.38, y + r * 0.25, r * 0.76, r * 0.45);
    ctx.fillStyle = '#120202'; ctx.beginPath(); ctx.arc(x - r * 0.27, y - r * 0.15, r * 0.18, 0, 7); ctx.arc(x + r * 0.27, y - r * 0.15, r * 0.18, 0, 7); ctx.fill();
    for (const dx of [-0.22, -0.06, 0.1]) ctx.fillRect(x + r * dx, y + r * 0.3, r * 0.05, r * 0.35);
  }

  const FONT = '600 13px system-ui'; // drawing space, so labels never depend on the canvas size
  const R = BASE / 2 - 18; // wheel radius
  const LABEL_START = BASE * 0.12 + 12; // the hub's radius (.hub is 24% wide) plus a fixed gap: every label starts here
  const LABEL_MAX = R - 14 - LABEL_START;
  let labelKey: unknown[] = [];
  let labels: string[] = [];
  // Labels are measured and truncated once per slices/names change, never per frame.
  function layoutLabels(ctx: CanvasRenderingContext2D) {
    if (labelKey[0] === slices && labelKey[1] === names) return;
    labelKey = [slices, names];
    ctx.font = FONT;
    labels = slices.map((s) => {
      const name = s.kind === 'coffee' ? (names.get(s.coffeeId!) ?? '') : '';
      let label = name;
      while (ctx.measureText(label).width > LABEL_MAX && label.length > 4) label = label.slice(0, -2);
      return label === name ? name : label.trimEnd() + '…';
    });
  }

  // One slice in wheel space (origin at the hub, no rotation applied here).
  function drawSlice(ctx: CanvasRenderingContext2D, i: number, s: WheelSlice, veneer: string[]) {
    const wedge = () => { ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, R, s.a0, s.a1); ctx.closePath(); };
    const mid = (s.a0 + s.a1) / 2;
    ctx.save(); wedge();
    if (s.kind === 'success') {
      const g = ctx.createLinearGradient(Math.cos(mid - 0.6) * R, Math.sin(mid - 0.6) * R, Math.cos(mid + 0.6) * R, Math.sin(mid + 0.6) * R);
      const t = (Math.sin(shimmer) + 1) / 2;
      g.addColorStop(0, '#8a6214'); g.addColorStop(Math.min(0.9, 0.2 + t * 0.6), '#fff2b8'); g.addColorStop(1, '#b8862b'); ctx.fillStyle = g;
    } else if (s.kind === 'fail') {
      const g = ctx.createRadialGradient(0, 0, R * 0.2, 0, 0, R); g.addColorStop(0, '#000'); g.addColorStop(0.7, '#1a0000'); g.addColorStop(1, '#7a0a0a'); ctx.fillStyle = g;
    } else ctx.fillStyle = veneer[0];
    ctx.fill();
    if (s.kind === 'coffee') { // veneer grain: faint arcs across the wedge
      ctx.save(); ctx.clip();
      for (let j = 0; j < 26; j++) {
        const q = Math.abs(Math.sin((i + 1) * 12.9898 + j * 78.233) * 43758.5453) % 1;
        ctx.beginPath(); ctx.arc(-R * 0.9 * (q - 0.2), R * 0.5 * q, R * (0.25 + 1.1 * ((q * 7) % 1)), 0, 7);
        ctx.strokeStyle = j % 3 ? 'rgba(20,10,4,0.13)' : 'rgba(255,225,180,0.12)'; ctx.lineWidth = 0.8 + q * 1.4; ctx.stroke();
      }
      ctx.restore(); wedge();
    }
    ctx.strokeStyle = s.kind === 'success' ? '#ffe08a' : s.kind === 'fail' ? '#d01c1c' : '#1d120a';
    ctx.lineWidth = s.kind === 'coffee' ? 2 : 2.5; ctx.stroke();
    ctx.rotate(mid);
    if (s.kind === 'coffee') {
      // same rule for every wedge: along the centre radius from a fixed gap outside the hub, top of the text toward the wedge's counter-clockwise side
      ctx.fillStyle = veneer[1]; ctx.font = FONT; ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
      ctx.fillText(labels[i], LABEL_START, 0);
    } else if (s.kind === 'success') {
      ctx.fillStyle = '#fff8dc'; star(ctx, R - 26, 0, 10); ctx.fillStyle = 'rgba(255,255,255,.9)'; star(ctx, R - 60 - 8 * Math.sin(shimmer * 1.7), 0, 4);
    } else skull(ctx, R - 26, 0, 12);
    ctx.restore();
  }

  // Everything that never changes while the wheel turns (the veneer wedges with their grain and labels, the fail wedge) is
  // painted once per slices/names/size change; each frame only rotates that picture and draws the shimmering gold wedge.
  let face: HTMLCanvasElement | null = null;
  let faceKey: unknown[] = [];
  function paintFace(k: number) {
    if (face && faceKey[0] === slices && faceKey[1] === names && faceKey[2] === k) return;
    face ??= document.createElement('canvas');
    faceKey = [slices, names, k];
    face.width = face.height = Math.round(BASE * k);
    const ctx = face.getContext('2d')!;
    ctx.setTransform(k, 0, 0, k, (BASE / 2) * k, (BASE / 2) * k);
    layoutLabels(ctx);
    let ci = 0;
    for (const [i, s] of slices.entries()) if (s.kind !== 'success') drawSlice(ctx, i, s, s.kind === 'coffee' ? VENEER[ci++ % VENEER.length] : []);
  }

  function drawWheel() {
    if (!wheel) return;
    const ctx = wheel.getContext('2d')!;
    const k = (width * dpr()) / BASE;
    paintFace(k);
    ctx.setTransform(k, 0, 0, k, 0, 0);
    const cx = BASE / 2, cy = BASE / 2;
    ctx.clearRect(0, 0, BASE, BASE);
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(rot);
    ctx.drawImage(face!, -BASE / 2, -BASE / 2, BASE, BASE);
    for (const [i, s] of slices.entries()) if (s.kind === 'success') drawSlice(ctx, i, s, []);
    ctx.restore();
    ctx.beginPath(); ctx.arc(cx, cy, R + 6, 0, 7); ctx.lineWidth = 10; ctx.strokeStyle = '#b8862b'; ctx.stroke(); // brass rim
    for (let i = 0; i < 24; i++) { const a = (i * Math.PI) / 12; ctx.beginPath(); ctx.arc(cx + Math.cos(a) * (R + 6), cy + Math.sin(a) * (R + 6), 2.5, 0, 7); ctx.fillStyle = '#fff2b8'; ctx.fill(); }
    // pointer at 3 o'clock, tip pointing into the wheel
    ctx.beginPath(); ctx.moveTo(BASE - 4, cy - 14); ctx.lineTo(BASE - 4, cy + 14); ctx.lineTo(BASE - 34, cy); ctx.closePath();
    ctx.fillStyle = '#e9c46a'; ctx.fill(); ctx.strokeStyle = '#3a2416'; ctx.lineWidth = 2; ctx.stroke();
  }

  function drawConfetti() {
    const ctx = fx.getContext('2d')!;
    const k = (width * dpr()) / BASE;
    ctx.setTransform(k, 0, 0, k, 0, 0);
    ctx.clearRect(0, 0, BASE, BASE);
    const ok = kindOfBurst === 'success';
    for (const p of confetti) {
      p.x += p.vx; p.y += p.vy; p.vy += ok ? 0.12 : 0.25; p.life -= 0.012;
      ctx.globalAlpha = Math.max(p.life, 0); ctx.fillStyle = p.c;
      if (ok) star(ctx, p.x, p.y, p.r * 1.6); else { ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 7); ctx.fill(); }
    }
    ctx.globalAlpha = 1;
    confetti = confetti.filter((p) => p.life > 0);
  }

  function burst(kind: 'success' | 'fail') {
    kindOfBurst = kind;
    const ok = kind === 'success', gold = ['#ffe08a', '#ffd04d', '#fff6d0', '#c9952c'], dark = ['#a31515', '#1a0000', '#5c0a0a'];
    confetti = Array.from({ length: ok ? 90 : 40 }, () => {
      const a = Math.random() * TAU, s = 2 + Math.random() * (ok ? 6 : 3), pal = ok ? gold : dark;
      return { x: BASE - 40, y: BASE / 2, vx: Math.cos(a) * s, vy: Math.sin(a) * s - (ok ? 2 : 0), life: 1, r: 2 + Math.random() * 3, c: pal[Math.floor(Math.random() * pal.length)] };
    });
  }

  // Render only while something moves: a spin, confetti, or the gold shimmer.
  let raf = 0;
  let spin: { start: number; over: number; end: number; t0: number; u: number } | null = null;
  const hasSuccess = () => !reduced() && slices.some((s) => s.kind === 'success');
  function tick(now: number) {
    raf = 0;
    if (spin) {
      const el = now - spin.t0, dur = 5200, back = 450;
      if (el < dur) rot = spin.start + (spin.over - spin.start) * (1 - Math.pow(1 - el / dur, 4));
      else rot = spin.over + (spin.end - spin.over) * (1 - Math.pow(1 - Math.min((el - dur) / back, 1), 3));
      if (el >= dur + back) { const { end, u } = spin; spin = null; rot = end % TAU; settle(sliceAt(slices, u)); }
    }
    if (hasSuccess()) shimmer += 0.04;
    drawWheel(); drawConfetti();
    if (spin || confetti.length || hasSuccess()) raf = requestAnimationFrame(tick);
  }
  const kick = () => { if (!raf) raf = requestAnimationFrame(tick); };
  $effect(() => { void [slices, names, angle, width]; kick(); });
  // The oak board under the wheel, repainted at its own size so the grain and the brass inlay never stretch.
  $effect(() => {
    if (!board || !boardW || !boardH) return;
    const k = dpr(); board.width = Math.round(boardW * k); board.height = Math.round(boardH * k);
    paintBoard(board.getContext('2d')!, board.width, board.height, 7 * k, 3 * k);
  });

  function settle(s: WheelSlice) {
    spinning = false;
    if (s.kind === 'fail') { vignette = true; shake = false; shakeRaf = requestAnimationFrame(() => (shake = true)); }
    if (s.kind !== 'coffee' && !reduced()) burst(s.kind);
    kick();
    onresult(s, rot);
  }

  /** Spin to a random point inside the target slice. */
  export function spinTo(target: WheelSlice) {
    if (spinning || disabled) return;
    vignette = false; shake = false;
    const u = target.a0 + (0.1 + Math.random() * 0.8) * (target.a1 - target.a0); // wheel-space angle under the pointer (3 o'clock)
    const start = rot;
    let end = -u;
    while (end < start + 6 * TAU) end += TAU;
    if (reduced()) { rot = end % TAU; settle(sliceAt(slices, u)); return; }
    spinning = true;
    // slight overshoot, then settle back
    spin = { start, over: end + 0.05, end, t0: performance.now(), u };
    kick();
  }

  onMount(() => {
    kick();
    return () => { cancelAnimationFrame(raf); cancelAnimationFrame(shakeRaf); };
  });
</script>

<div class="mat" bind:clientWidth={boardW} bind:clientHeight={boardH}>
<canvas class="board" bind:this={board} aria-hidden="true"></canvas>
<div class="wheel" class:shake bind:clientWidth={width}>
  <canvas bind:this={wheel} width={Math.round(width * dpr())} height={Math.round(width * dpr())} style:height="{width}px"></canvas>
  <canvas class="fx" bind:this={fx} width={Math.round(width * dpr())} height={Math.round(width * dpr())} style:height="{width}px"></canvas>
  <div class="vignette" class:on={vignette}></div>
  <button type="button" class="hub" disabled={disabled || spinning} onclick={onspin} aria-label="Spin">SPIN</button>
</div>
</div>

<style>
  /* The board: as wide as the game column, the wheel centred on it. --wheel-size is the height budget from PickForMe, board included. */
  .mat { --pad: 14px; position: relative; padding: var(--pad); border-radius: var(--radius); overflow: hidden; background: #a8743f; }
  .board { position: absolute; inset: 0; height: 100%; }
  .wheel { position: relative; width: 100%; max-width: calc(var(--wheel-size, 460px) - 2 * var(--pad)); margin: 0 auto; overflow: hidden; border-radius: 50%; box-shadow: 0 6px 14px -4px rgba(0, 0, 0, 0.55); }
  canvas { width: 100%; display: block; }
  .fx { position: absolute; inset: 0; pointer-events: none; }
  .hub {
    position: absolute; left: 50%; top: 50%; width: 24%; aspect-ratio: 1; transform: translate(-50%, -50%); border-radius: 50%;
    border: 3px solid #ffe9a8; background: radial-gradient(circle at 35% 30%, #ffe9a8, #b8862b 55%, #6e4a10); /* brass */
    color: #2b1a05; font: inherit; font-weight: 900; letter-spacing: 0.12em; font-size: clamp(14px, 4.4vw, 22px); padding: 0; cursor: pointer;
    box-shadow: 0 0 0 0 rgba(240, 194, 122, 0.7), inset 0 -4px 10px rgba(0, 0, 0, 0.35); animation: pulse 1.8s infinite;
  }
  .hub:hover { filter: brightness(1.1); }
  .hub:disabled { animation: none; cursor: default; filter: grayscale(0.6) brightness(0.8); }
  .vignette { position: absolute; inset: 0; pointer-events: none; opacity: 0; transition: opacity 0.4s; background: radial-gradient(circle, transparent 35%, rgba(120, 0, 0, 0.75) 100%); }
  .vignette.on { opacity: 1; }
  .shake { animation: shake 0.5s; }
  @keyframes pulse {
    70% { box-shadow: 0 0 0 18px rgba(240, 194, 122, 0), inset 0 -4px 10px rgba(0, 0, 0, 0.35); }
    100% { box-shadow: 0 0 0 0 rgba(240, 194, 122, 0), inset 0 -4px 10px rgba(0, 0, 0, 0.35); }
  }
  @keyframes shake { 10%, 90% { transform: translateX(-2px); } 20%, 80% { transform: translateX(4px); } 30%, 50%, 70% { transform: translateX(-8px); } 40%, 60% { transform: translateX(8px); } }
  @media (prefers-reduced-motion: reduce) { .hub, .shake { animation: none; } .vignette { transition: none; } }
</style>
