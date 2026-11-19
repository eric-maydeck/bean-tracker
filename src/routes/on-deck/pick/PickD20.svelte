<script lang="ts">
  import { onMount } from 'svelte';
  import type { Mesh, MeshStandardMaterial, Quaternion, WebGLRenderer } from 'three';
  import type { D20Pose } from '#lib/pick/types.ts';

  let { pose, disabled, onresult, critFor, onfail, onstart }: {
    pose: D20Pose | null;
    disabled: boolean;
    onresult: (n: number, pose: D20Pose) => void;
    onfail?: () => void;
    onstart?: () => void;
    critFor: (n: number) => 'success' | 'fail' | null;
  } = $props();

  const RESTART_MS = 5000; // if a roll hasn't settled by then, let the user throw again

  let stage: HTMLDivElement;
  let lens: HTMLDivElement;
  let ready = $state(false);
  let failed = $state(false);
  let rolling = $state(false);
  let again = $state(false);
  let lensClass = $state('');
  let lensLabel = $state('Top of die');
  let rolled = $state('');
  let doRoll: ((forced?: number) => void) | null = null;

  export function roll() { doRoll?.(); }

  function show() { const n = Number(rolled); if (Number.isInteger(n) && n >= 1 && n <= 20) doRoll?.(n); }

  function setLens(n: number) {
    const crit = critFor(n);
    lensClass = crit === 'success' ? 'win' : crit === 'fail' ? 'fail' : 'done';
    lensLabel = crit === 'success' ? 'Critical success' : crit === 'fail' ? 'Critical fail' : `Rolled ${n}`;
  }

  onMount(() => {
    const undo: (() => void)[] = []; // cleanups, run in reverse
    let dead = false;
    const dispose = () => { doRoll = null; undo.splice(0).reverse().forEach((f) => f()); };
    (async () => {
      try {
      const THREE = await import('three');
      const sim = await import('./d20Sim'); // pulls in cannon-es
      const { paintBoard, paintCounter, WALNUT_DARK } = await import('./wood');
      if (dead) return;
      if (!stage.clientWidth || !stage.clientHeight) { // hidden or not laid out yet: wait for a real size (one-shot)
        await new Promise<void>((res) => { const ro = new ResizeObserver(() => { if (stage.clientWidth && stage.clientHeight) { ro.disconnect(); res(); } }); ro.observe(stage); undo.push(() => ro.disconnect()); });
        if (dead) return;
      }
      const { V, F, C, num, trayFor, simulate, symmetry } = sim;

      let W = stage.clientWidth, H = stage.clientHeight;
      const dpr = Math.min(devicePixelRatio, 2);
      const renderer: WebGLRenderer = new THREE.WebGLRenderer({ antialias: true });
      renderer.setPixelRatio(dpr); renderer.setSize(W, H);
      renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      stage.appendChild(renderer.domElement);
      undo.push(() => { renderer.setAnimationLoop(null); renderer.dispose(); renderer.forceContextLoss(); renderer.domElement.remove(); });
      const scene = new THREE.Scene(); scene.background = new THREE.Color(WALNUT_DARK);
      const camera = new THREE.PerspectiveCamera(36, W / H, 0.1, 100);
      camera.position.set(0, 10, 7); camera.lookAt(0, 0, 0.2);
      scene.add(new THREE.AmbientLight('#fff4e6', 0.85));
      const sun = new THREE.DirectionalLight('#ffe9cc', 2); sun.position.set(-4, 12, 6); sun.castShadow = true;
      sun.shadow.mapSize.set(1024, 1024); Object.assign(sun.shadow.camera, { left: -8, right: 8, top: 8, bottom: -8 }); scene.add(sun);
      // A coffee-bar counter: walnut all round, the tray an oak board with a brass inlay (canvas-painted, see wood.ts).
      const canvasTex = (w: number, h: number, paint: (g: CanvasRenderingContext2D) => void) => {
        const cv = document.createElement('canvas'); cv.width = w; cv.height = h; paint(cv.getContext('2d')!);
        const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
      };
      const counter = canvasTex(1024, 512, (g) => paintCounter(g, 1024, 512)); counter.wrapS = counter.wrapT = THREE.RepeatWrapping; counter.repeat.set(2, 2);
      const floor = new THREE.Mesh(new THREE.PlaneGeometry(30, 20), new THREE.MeshStandardMaterial({ map: counter, roughness: 0.9 }));
      floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
      let { TX, TZ, DR } = trayFor({ w: W, h: H });
      const DR0 = DR; // the die mesh is built at this radius and scaled on resize
      // The board is exactly the tray (the walls sit on its edge), repainted at the tray's shape when that changes.
      const boardMat = new THREE.MeshStandardMaterial({ roughness: 0.9 });
      const board = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), boardMat);
      board.rotation.x = -Math.PI / 2; board.position.y = 0.01; board.receiveShadow = true; scene.add(board);
      function paintBoardTex() {
        const h = 1024, w = Math.round(h * TX / TZ);
        boardMat.map?.dispose(); boardMat.map = canvasTex(w, h, (g) => paintBoard(g, w, h, h * 0.045, h * 0.016)); boardMat.needsUpdate = true;
      }
      // A resize stretches the old picture at once and repaints when the size has settled, not on every step of a drag.
      let boardTimer: ReturnType<typeof setTimeout> | undefined;
      function layBoard() {
        board.scale.set(TX * 2, TZ * 2, 1);
        clearTimeout(boardTimer); boardTimer = setTimeout(() => { paintBoardTex(); dirty = true; }, 150);
      }
      undo.push(() => clearTimeout(boardTimer));
      board.scale.set(TX * 2, TZ * 2, 1); paintBoardTex();

      // An ivory die with espresso numerals. The face that lands on top is redrawn: gold for a critical success,
      // dark red for a critical fail (the pop-up's colours), a brass outline for any other number.
      function faceTexture(n: number, top?: 'success' | 'fail' | 'plain') {
        const cv = document.createElement('canvas'); cv.width = cv.height = 256; const g = cv.getContext('2d')!;
        g.fillStyle = '#fffaf0';
        if (top === 'success') { const gr = g.createLinearGradient(0, 40, 256, 256); gr.addColorStop(0, '#b8862b'); gr.addColorStop(0.5, '#ffe9a8'); gr.addColorStop(1, '#c9952c'); g.fillStyle = gr; }
        if (top === 'fail') { const gr = g.createRadialGradient(128, 150, 10, 128, 150, 170); gr.addColorStop(0, '#a31515'); gr.addColorStop(1, '#3a0505'); g.fillStyle = gr; }
        g.fillRect(0, 0, 256, 256);
        if (top === 'plain') { g.strokeStyle = '#c9952c'; g.lineWidth = 12; g.lineJoin = 'round'; g.beginPath(); g.moveTo(128, 14); g.lineTo(10, 216); g.lineTo(246, 216); g.closePath(); g.stroke(); } // the face's triangle in uv space
        g.fillStyle = top === 'fail' ? '#ffe6e0' : '#3b2415'; g.font = `800 ${n >= 10 ? 74 : 86}px system-ui, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
        g.fillText(String(n), 128, 152);
        if (n === 6 || n === 9) g.fillRect(104, 196, 48, 7);
        const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
      }
      const geo = new THREE.BufferGeometry(), gpos: number[] = [], uv: number[] = [];
      F.forEach((f, i) => { f.forEach((k) => gpos.push(V[k].x * DR, V[k].y * DR, V[k].z * DR)); uv.push(0.5, 1, 0, 0.134, 1, 0.134); geo.addGroup(i * 3, 3, i); });
      geo.setAttribute('position', new THREE.Float32BufferAttribute(gpos, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geo.computeVertexNormals();
      const mats: MeshStandardMaterial[] = F.map((_, i) => new THREE.MeshStandardMaterial({ map: faceTexture(num[i]), roughness: 0.35, metalness: 0.15, flatShading: true }));
      const die: Mesh = new THREE.Mesh(geo, mats); die.castShadow = true; die.position.set(0, 1, 0); scene.add(die);

      // Close-up lens: a second camera hovering above the die, turned so the top face's number reads upright.
      let LS = lens.clientWidth;
      const insetRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      insetRenderer.setPixelRatio(dpr); insetRenderer.setSize(LS, LS); lens.appendChild(insetRenderer.domElement);
      undo.push(() => { insetRenderer.dispose(); insetRenderer.forceContextLoss(); insetRenderer.domElement.remove(); });
      const closeCam = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
      const wc = new THREE.Vector3(), wa = new THREE.Vector3(), up = new THREE.Vector3(), Y = new THREE.Vector3(0, 1, 0);
      const SCREEN_UP = new THREE.Vector3(0, 0, -1);
      let turn: { from: number; to: number; t0: number } | null = null;
      let lensAngle = 0;
      // While rolling the lens holds a fixed orientation (same "up" as the main view); once settled it turns until the number reads upright.
      function uprightAngle() {
        let best = -2, i = 0;
        C.forEach((c, k) => { const y = wc.copy(c).applyQuaternion(die.quaternion).y; if (y > best) { best = y; i = k; } });
        wc.copy(C[i]).applyQuaternion(die.quaternion); wa.copy(V[F[i][0]]).applyQuaternion(die.quaternion);
        const u = wa.sub(wc); return Math.atan2(u.x, -u.z);
      }
      function aimCloseCam(now: number) {
        if (turn) { const k = Math.min((now - turn.t0) / 500, 1), e = 1 - Math.pow(1 - k, 3); lensAngle = turn.from + (turn.to - turn.from) * e; if (k >= 1) turn = null; }
        up.copy(SCREEN_UP).applyAxisAngle(Y, -lensAngle);
        closeCam.position.set(die.position.x, die.position.y + 5, die.position.z); closeCam.up.copy(up); closeCam.lookAt(die.position);
      }

      let topFace: { i: number; map: MeshStandardMaterial['map'] } | null = null; // the highlighted face and its everyday texture
      const unlight = () => { if (!topFace) return; mats[topFace.i].map?.dispose(); mats[topFace.i].map = topFace.map; topFace = null; };
      const light = (n: number) => { unlight(); const i = num.indexOf(n); topFace = { i, map: mats[i].map }; mats[i].map = faceTexture(n, critFor(n) ?? 'plain'); };
      const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
      const tmpQ = new THREE.Quaternion();
      let dirty = true; // render both views only while something moves, plus one frame after any change
      let play: { frames: Float32Array[]; sym: Quaternion; t0: number; n: number } | null = null;

      function finish(now: number, n: number) {
        light(n);
        setLens(n);
        play = null; rolling = false; again = false; dirty = true;
        if (resizePending) applySize();
        let to = uprightAngle(); while (to - lensAngle > Math.PI) to -= 2 * Math.PI; while (to - lensAngle < -Math.PI) to += 2 * Math.PI;
        if (reduced()) { lensAngle = to; turn = null; } else turn = { from: lensAngle, to, t0: now };
        onresult(n, { pos: die.position.toArray() as [number, number, number], quat: die.quaternion.toArray().slice(0, 4) as [number, number, number, number], sym: n, lensAngle: to });
      }

      doRoll = (forced) => {
        if (disabled || (play && performance.now() - play.t0 < RESTART_MS)) return;
        onstart?.();
        unlight();
        const { frames, top } = simulate(Math.random, { w: W, h: H });
        const n = forced ?? top;
        play = { frames, sym: new THREE.Quaternion().fromArray(symmetry(n, top)), t0: performance.now(), n };
        rolling = true; again = false; lensClass = ''; lensLabel = 'Top of die';
        turn = { from: lensAngle, to: 0, t0: performance.now() };
        if (reduced()) { const f = frames[frames.length - 1]; die.position.set(f[0], f[1], f[2]); die.quaternion.copy(tmpQ.set(f[3], f[4], f[5], f[6])).multiply(play.sym); finish(performance.now(), n); }
      };

      // Re-measure when the container changes; the tray, die and lens follow, but never mid-throw.
      let resizePending = false;
      function applySize() {
        const w = stage.clientWidth, h = stage.clientHeight;
        if (!w || !h || (w === W && h === H && lens.clientWidth === LS)) return;
        if (play) { resizePending = true; return; }
        resizePending = false;
        const old = { TX, DR };
        W = w; H = h; ({ TX, TZ, DR } = trayFor({ w, h }));
        renderer.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix();
        layBoard();
        die.scale.setScalar(DR / DR0);
        die.position.set(die.position.x * TX / old.TX, die.position.y * DR / old.DR, die.position.z); // ponytail: scaling keeps the resting die inside the new tray; exact only for x/y
        LS = lens.clientWidth; insetRenderer.setSize(LS, LS);
        dirty = true;
      }
      for (const c of [renderer.domElement, insetRenderer.domElement]) { // render-on-demand: redraw after a lost context returns
        const redraw = () => { dirty = true; };
        c.addEventListener('webglcontextrestored', redraw); undo.push(() => c.removeEventListener('webglcontextrestored', redraw));
      }
      const ro = new ResizeObserver(applySize); ro.observe(stage); ro.observe(lens);
      undo.push(() => ro.disconnect());

      // Restore a resting die and lens with no animation.
      if (pose) {
        die.position.fromArray(pose.pos); die.quaternion.fromArray(pose.quat);
        die.position.y = DR * 0.7947; // resting on a face at this tray's die size, whatever size it was saved at
        die.position.x = Math.max(-(TX - DR), Math.min(TX - DR, die.position.x)); die.position.z = Math.max(-(TZ - DR), Math.min(TZ - DR, die.position.z));
        lensAngle = pose.lensAngle; light(pose.sym); setLens(pose.sym);
      }

      renderer.setAnimationLoop((now) => {
        if (play) {
          const i = Math.max(0, Math.min(Math.floor((now - play.t0) / (1000 / 60)), play.frames.length - 1)), f = play.frames[i];
          die.position.set(f[0], f[1], f[2]); die.quaternion.copy(tmpQ.set(f[3], f[4], f[5], f[6])).multiply(play.sym);
          if (now - play.t0 > RESTART_MS && !again) again = true;
          if (i === play.frames.length - 1) finish(now, play.n);
        }
        if (!play && !turn && !dirty) return;
        dirty = false;
        renderer.render(scene, camera);
        aimCloseCam(now); insetRenderer.render(scene, closeCam);
      });
      ready = true;
      undo.push(() => {
        sun.shadow.map?.dispose();
        for (const m of [floor, board]) { m.geometry.dispose(); m.material.map?.dispose(); m.material.dispose(); }
        unlight(); geo.dispose(); mats.forEach((m) => { m.map?.dispose(); m.dispose(); });
      });
      } catch {
        dispose(); failed = true; onfail?.();
      }
    })();
    return () => { dead = true; dispose(); };
  });

  const blocked = $derived(disabled || !ready || (rolling && !again));
</script>

<div class="d20">
  <div class="stage" bind:this={stage}>
    <div class="inset {lensClass}">
      <div class="lens" bind:this={lens}></div>
      <span class="inset-label">{lensLabel}</span>
      <button type="button" class="button button-solid roll" class:idle={!blocked} disabled={blocked} onclick={() => roll()}>{rolling ? (again ? 'Roll again' : 'Rolling…') : 'Roll'}</button>
    </div>
  </div>
  {#if failed}<p class="hint">3D dice need WebGL; try the wheel.</p>{/if}
  <div class="form-field group-field entry">
    <label class="someone" for="d20-rolled">Someone rolled for me:</label>
    <div class="search-row pair">
      <input id="d20-rolled" type="number" min="1" max="20" step="1" inputmode="numeric" placeholder="1–20" aria-label="Number someone rolled" bind:value={rolled} disabled={disabled || !ready} />
      <button type="button" class="button button-secondary" disabled={blocked} onclick={show}>Show</button>
    </div>
  </div>
</div>

<style>
  .d20 { container-type: inline-size; width: 100%; min-width: 0; }
  .stage { position: relative; width: 100%; height: 360px; border-radius: var(--radius); overflow: hidden; background: #1a100a; } /* wood.ts WALNUT_DARK */
  .inset { position: absolute; z-index: 1; top: 12px; left: 12px; width: clamp(104px, 26cqw, 168px); text-align: center; pointer-events: none; }
  .lens { width: 100%; aspect-ratio: 1; border-radius: 50%; overflow: hidden; background: #2a1a10; border: 4px solid #b8862b;
    box-shadow: 0 6px 18px rgba(0, 0, 0, 0.55), inset 0 0 22px rgba(0, 0, 0, 0.7);
    transition: border-color 0.3s, box-shadow 0.3s, transform 0.3s cubic-bezier(0.3, 1.6, 0.6, 1); }
  .lens :global(canvas) { display: block; width: 100% !important; height: 100% !important; }
  .inset.done .lens { border-color: #f3d58a; transform: scale(1.06); }
  .inset.win .lens { border-color: #ffe08a; box-shadow: 0 0 22px #d4a73a, inset 0 0 22px rgba(0, 0, 0, 0.5); transform: scale(1.08); }
  .inset.fail .lens { border-color: #d01c1c; box-shadow: 0 0 22px #7a0a0a, inset 0 0 22px rgba(0, 0, 0, 0.7); transform: scale(1.08); }
  .inset-label { display: inline-block; margin-top: 6px; font-size: 11px; letter-spacing: 0.1em; text-transform: uppercase; color: #f3ece2; background: rgba(22, 19, 15, 0.8); padding: 2px 8px; border-radius: 99px; }
  /* Primary call to action: the site's solid .button, enlarged; same width as the lens, pulses while idle (like the wheel's SPIN hub). */
  .roll { display: block; width: 100%; min-height: 48px; margin: var(--space-6) 0 0; padding: 0 4px; pointer-events: auto; white-space: nowrap;
    font-size: clamp(0.8rem, 3.4cqw, 1.3rem); font-weight: 800; letter-spacing: 0.02em; }
  .roll.idle { animation: pulse 1.8s infinite; }
  .roll:disabled { cursor: default; filter: grayscale(0.6) brightness(0.8); }
  @keyframes pulse {
    0% { box-shadow: 0 0 0 0 color-mix(in srgb, var(--color-accent) 70%, transparent); }
    70% { box-shadow: 0 0 0 16px transparent; }
    100% { box-shadow: 0 0 0 0 transparent; }
  }
  .entry { margin: var(--space-2) 0 0; } /* tight, so the whole Out row stays on a 1280x800 screen */ /* the site's label-above-input + button pairing (.search-row) */
  .pair { align-items: end; margin-bottom: 0; }
  .pair .button { margin: 0; }
  .pair input { width: 6rem; } /* look comes from the site's .form-field input */
  .someone { font-size: 1.1rem; font-weight: 700; color: var(--color-accent); }
  .hint { font-size: 13px; color: var(--color-text-muted, inherit); }
  @media (prefers-reduced-motion: reduce) { .lens { transition: none; } .roll.idle { animation: none; } }
</style>
