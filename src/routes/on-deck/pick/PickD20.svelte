<script lang="ts">
  import { onMount } from 'svelte';
  import type { Mesh, MeshStandardMaterial, Quaternion, WebGLRenderer } from 'three';
  import type { D20Pose } from '#lib/pick/types.ts';

  let { pose, disabled, onresult, critFor }: {
    pose: D20Pose | null;
    disabled: boolean;
    onresult: (n: number, pose: D20Pose) => void;
    critFor: (n: number) => 'success' | 'fail' | null;
  } = $props();

  const RESTART_MS = 5000; // if a roll hasn't settled by then, let the user throw again

  let stage: HTMLDivElement;
  let lens: HTMLDivElement;
  let ready = $state(false);
  let rolling = $state(false);
  let again = $state(false);
  let lensClass = $state('');
  let lensLabel = $state('Top of die');
  let rolled = $state('');
  let doRoll: ((forced?: number) => void) | null = null;

  export function roll() { doRoll?.(); }
  export function rollAs(n: number) { if (n >= 1 && n <= 20) doRoll?.(n); }

  function show() { const n = Number(rolled); if (Number.isInteger(n)) rollAs(n); }

  function setLens(n: number) {
    const crit = critFor(n);
    lensClass = crit === 'success' ? 'win' : crit === 'fail' ? 'fail' : 'done';
    lensLabel = crit === 'success' ? 'Critical success' : crit === 'fail' ? 'Critical fail' : `Rolled ${n}`;
  }

  onMount(() => {
    let dispose = () => {};
    let dead = false;
    (async () => {
      const [THREE, CANNON] = await Promise.all([import('three'), import('cannon-es')]);
      void CANNON; // loaded with the sim chunk; named here so the pair stays dynamic-only
      const sim = await import('./d20Sim');
      if (dead) return;
      const { V, F, C, num, trayFor, simulate, symmetry } = sim;

      const W = stage.clientWidth, H = stage.clientHeight;
      const dpr = Math.min(devicePixelRatio, 2);
      const renderer: WebGLRenderer = new THREE.WebGLRenderer({ antialias: true });
      renderer.setPixelRatio(dpr); renderer.setSize(W, H);
      renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      stage.appendChild(renderer.domElement);
      const scene = new THREE.Scene(); scene.background = new THREE.Color('#1b1712');
      const camera = new THREE.PerspectiveCamera(36, W / H, 0.1, 100);
      camera.position.set(0, 10, 7); camera.lookAt(0, 0, 0.2);
      scene.add(new THREE.AmbientLight('#fff4e6', 0.55));
      const sun = new THREE.DirectionalLight('#ffe9cc', 1.6); sun.position.set(-4, 12, 6); sun.castShadow = true;
      sun.shadow.mapSize.set(1024, 1024); Object.assign(sun.shadow.camera, { left: -8, right: 8, top: 8, bottom: -8 }); scene.add(sun);
      const floor = new THREE.Mesh(new THREE.PlaneGeometry(30, 20), new THREE.MeshStandardMaterial({ color: '#3b2a1a', roughness: 0.95 }));
      floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
      const { TX, TZ, DR } = trayFor({ w: W, h: H });
      const trayLine = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(TX * 2, 0.01, TZ * 2)), new THREE.LineBasicMaterial({ color: '#c8925a', transparent: true, opacity: 0.35 }));
      trayLine.position.y = 0.01; scene.add(trayLine);

      function faceTexture(n: number) {
        const cv = document.createElement('canvas'); cv.width = cv.height = 256; const g = cv.getContext('2d')!;
        g.fillStyle = '#5c348c'; g.fillRect(0, 0, 256, 256);
        g.fillStyle = '#ffffff'; g.font = `800 ${n >= 10 ? 74 : 86}px system-ui, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
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
      const LS = lens.clientWidth;
      const insetRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      insetRenderer.setPixelRatio(dpr); insetRenderer.setSize(LS, LS); lens.appendChild(insetRenderer.domElement);
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

      const glow = (n: number) => { const c = critFor(n); return c === 'success' ? '#7a5a00' : c === 'fail' ? '#6b0000' : '#4a2a10'; };
      const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
      const tmpQ = new THREE.Quaternion();
      let play: { frames: Float32Array[]; sym: Quaternion; t0: number; n: number } | null = null;

      function finish(now: number, n: number) {
        mats[num.indexOf(n)].emissive.set(glow(n));
        setLens(n);
        play = null; rolling = false; again = false;
        let to = uprightAngle(); while (to - lensAngle > Math.PI) to -= 2 * Math.PI; while (to - lensAngle < -Math.PI) to += 2 * Math.PI;
        if (reduced()) { lensAngle = to; turn = null; } else turn = { from: lensAngle, to, t0: now };
        onresult(n, { pos: die.position.toArray() as [number, number, number], quat: die.quaternion.toArray().slice(0, 4) as [number, number, number, number], sym: n, lensAngle: to });
      }

      doRoll = (forced) => {
        if (disabled || (play && performance.now() - play.t0 < RESTART_MS)) return;
        mats.forEach((m) => m.emissive.set(0));
        const { frames, top } = simulate(Math.random, { w: W, h: H });
        const n = forced ?? top;
        play = { frames, sym: new THREE.Quaternion().fromArray(symmetry(n, top)), t0: performance.now(), n };
        rolling = true; again = false; lensClass = ''; lensLabel = 'Top of die';
        turn = { from: lensAngle, to: 0, t0: performance.now() };
        if (reduced()) { const f = frames[frames.length - 1]; die.position.set(f[0], f[1], f[2]); die.quaternion.copy(tmpQ.set(f[3], f[4], f[5], f[6])).multiply(play.sym); finish(performance.now(), n); }
      };

      // Restore a resting die and lens with no animation.
      if (pose) {
        die.position.fromArray(pose.pos); die.quaternion.fromArray(pose.quat);
        lensAngle = pose.lensAngle; mats[num.indexOf(pose.sym)].emissive.set(glow(pose.sym)); setLens(pose.sym);
      }

      renderer.setAnimationLoop((now) => {
        if (play) {
          const i = Math.max(0, Math.min(Math.floor((now - play.t0) / (1000 / 60)), play.frames.length - 1)), f = play.frames[i];
          die.position.set(f[0], f[1], f[2]); die.quaternion.copy(tmpQ.set(f[3], f[4], f[5], f[6])).multiply(play.sym);
          if (now - play.t0 > RESTART_MS && !again) again = true;
          if (i === play.frames.length - 1) finish(now, play.n);
        }
        renderer.render(scene, camera);
        aimCloseCam(now); insetRenderer.render(scene, closeCam);
      });
      ready = true;
      dispose = () => {
        renderer.setAnimationLoop(null); doRoll = null;
        renderer.dispose(); insetRenderer.dispose(); geo.dispose(); mats.forEach((m) => { m.map?.dispose(); m.dispose(); });
        renderer.domElement.remove(); insetRenderer.domElement.remove();
      };
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
    </div>
  </div>
  <div class="row">
    <button type="button" class="button roll" disabled={blocked} onclick={() => roll()}>{rolling ? (again ? 'Roll for me again' : 'Rolling…') : 'Roll for me'}</button>
    <span class="hint">or someone rolled:</span>
    <input type="number" min="1" max="20" placeholder="1–20" aria-label="Number someone rolled" bind:value={rolled} disabled={disabled || !ready} />
    <button type="button" class="button button-secondary" disabled={blocked} onclick={show}>Show</button>
  </div>
</div>

<style>
  .stage { position: relative; width: 100%; height: 360px; border-radius: var(--radius); overflow: hidden; background: #1b1712; }
  .inset { position: absolute; z-index: 1; top: 12px; left: 12px; width: clamp(104px, 24vw, 168px); text-align: center; pointer-events: none; }
  .lens { width: 100%; aspect-ratio: 1; border-radius: 50%; overflow: hidden; background: #241b12; border: 4px solid #6b5640;
    box-shadow: 0 6px 18px rgba(0, 0, 0, 0.55), inset 0 0 22px rgba(0, 0, 0, 0.7);
    transition: border-color 0.3s, box-shadow 0.3s, transform 0.3s cubic-bezier(0.3, 1.6, 0.6, 1); }
  .lens :global(canvas) { display: block; width: 100% !important; height: 100% !important; }
  .inset.done .lens { border-color: #c8925a; transform: scale(1.06); }
  .inset.win .lens { border-color: #ffe08a; box-shadow: 0 0 22px #d4a73a, inset 0 0 22px rgba(0, 0, 0, 0.5); transform: scale(1.08); }
  .inset.fail .lens { border-color: #d01c1c; box-shadow: 0 0 22px #7a0a0a, inset 0 0 22px rgba(0, 0, 0, 0.7); transform: scale(1.08); }
  .inset-label { display: inline-block; margin-top: 6px; font-size: 11px; letter-spacing: 0.1em; text-transform: uppercase; color: #f3ece2; background: rgba(22, 19, 15, 0.8); padding: 2px 8px; border-radius: 99px; }
  .row { display: flex; flex-wrap: wrap; gap: var(--space-2); align-items: center; margin: var(--space-3) 0; }
  .roll { min-width: 11rem; } /* label swaps keep the button's size */
  .hint { font-size: 13px; color: var(--color-text-muted, inherit); }
  input[type='number'] { width: 5rem; min-height: 44px; font: inherit; }
  @media (prefers-reduced-motion: reduce) { .lens { transition: none; } }
</style>
