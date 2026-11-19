// Pure D20 throw simulation (cannon-es) plus the icosahedron geometry the renderer shares. No renderer imports.
import * as CANNON from 'cannon-es';
import * as THREE from 'three';

// Icosahedron (radius 1): 12 vertices, 20 faces, outward winding; opposite faces sum to 21.
const P = (1 + Math.sqrt(5)) / 2;
export const V = [[-1,P,0],[1,P,0],[-1,-P,0],[1,-P,0],[0,-1,P],[0,1,P],[0,-1,-P],[0,1,-P],[P,0,-1],[P,0,1],[-P,0,-1],[-P,0,1]]
  .map(([x, y, z]) => new THREE.Vector3(x, y, z).normalize());
export const F: number[][] = [[0,11,5],[0,5,1],[0,1,7],[0,7,10],[0,10,11],[1,5,9],[5,11,4],[11,10,2],[10,7,6],[7,1,8],[3,9,4],[3,4,2],[3,2,6],[3,6,8],[3,8,9],[4,9,5],[2,4,11],[6,2,10],[8,6,7],[9,8,1]].map((f) => {
  const [a, b, c] = f.map((i) => V[i]);
  const n = new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(c, a));
  return n.dot(a) > 0 ? f : [f[0], f[2], f[1]];
});
export const C = F.map((f) => new THREE.Vector3().add(V[f[0]]).add(V[f[1]]).add(V[f[2]]).normalize());
/** num[faceIndex] = the number printed on that face. */
export const num: number[] = new Array(20).fill(0);
{
  let next = 1;
  for (let i = 0; i < 20; i++) {
    if (num[i]) continue;
    const o = C.findIndex((c, k) => !num[k] && k !== i && c.clone().add(C[i]).length() < 1e-6);
    num[i] = next; num[o] = 21 - next; next++;
  }
}
const idxOf = (n: number) => num.indexOf(n);
/** Outward unit normal of the face printed with n (1..20), in die-local space. */
export const faceNormal = (n: number) => C[idxOf(n)].clone();

/** Tray half-size and die radius for a stage of w x h pixels. */
export function trayFor(size: { w: number; h: number }) {
  const TZ = 3.3, TX = Math.min(5.6, TZ * (size.w / size.h) * 0.95);
  return { TX, TZ, DR: Math.min(1.35, TX / 3.4) };
}

/**
 * Rotation of the die's symmetry group taking face `from` onto face `to` (and the face's first vertex onto the other's).
 * The die looks identical, only the labels move, so a recorded throw can be relabelled to show any number on top.
 */
export function symmetry(from: number, to: number): [number, number, number, number] {
  const basis = (n: number) => {
    const i = idxOf(n), c = C[i];
    const v = V[F[i][0]].clone().sub(c.clone().multiplyScalar(V[F[i][0]].dot(c))).normalize();
    return new THREE.Matrix4().makeBasis(c, v, new THREE.Vector3().crossVectors(c, v));
  };
  const q = new THREE.Quaternion().setFromRotationMatrix(basis(to).multiply(basis(from).invert()));
  return [q.x, q.y, q.z, q.w];
}

/** Pre-simulate a whole throw. Each frame: position(3) + quaternion(4). `top` is the number face up at rest. */
export function simulate(rand: () => number, size: { w: number; h: number }): { frames: Float32Array[]; top: number } {
  const { TX, TZ, DR } = trayFor(size);
  const r = (a: number, b: number) => a + rand() * (b - a);
  const world = new CANNON.World({ gravity: new CANNON.Vec3(0, -32, 0) });
  world.allowSleep = true;
  const mat = new CANNON.Material();
  world.addContactMaterial(new CANNON.ContactMaterial(mat, mat, { friction: 0.3, restitution: 0.35 }));
  // A plane's solid side is behind its normal, so each wall's normal points into the tray.
  const wall = (nx: number, nz: number, px: number, pz: number, ny = 0) => {
    const b = new CANNON.Body({ mass: 0, material: mat, shape: new CANNON.Plane() });
    b.quaternion.setFromVectors(new CANNON.Vec3(0, 0, 1), new CANNON.Vec3(nx, ny, nz));
    b.position.set(px, 0, pz); world.addBody(b);
  };
  wall(0, 0, 0, 0, 1); wall(-1, 0, TX, 0); wall(1, 0, -TX, 0); wall(0, -1, 0, TZ); wall(0, 1, 0, -TZ);
  const body = new CANNON.Body({
    mass: 1, material: mat, linearDamping: 0.08, angularDamping: 0.08, sleepSpeedLimit: 0.12, sleepTimeLimit: 0.25,
    shape: new CANNON.ConvexPolyhedron({ vertices: V.map((v) => new CANNON.Vec3(v.x * DR, v.y * DR, v.z * DR)), faces: F }),
  });
  world.addBody(body);

  const dir = rand() < 0.5 ? 1 : -1;
  body.position.set(-dir * r(TX - 2, TX - 1.2), r(2.2, 3.4), r(-1.6, 1.6));
  body.quaternion.setFromEuler(r(0, 6.3), r(0, 6.3), r(0, 6.3));
  body.velocity.set(dir * r(9, 14) * TX / 5.6, r(1, 4), r(-4, 4));
  body.angularVelocity.set(r(-22, 22), r(-22, 22), r(-22, 22));
  body.wakeUp();
  const frames: Float32Array[] = [];
  const REST_Y = DR * 0.7947 + 0.03; // inradius: lying flat on a face
  let lastBump = -99;
  for (let i = 0; i < 60 * 8; i++) {
    // Asleep but not flat (cocked on an edge): nudge it toward the middle, like a hand would.
    if (body.sleepState === CANNON.Body.SLEEPING) {
      if (body.position.y < REST_Y) break;
      body.wakeUp();
      body.velocity.set(-Math.sign(body.position.x) * 1.5, 1.5, -Math.sign(body.position.z) * 1.5);
      body.angularVelocity.set(r(-3, 3), r(-3, 3), r(-3, 3));
    }
    // Walls act like a bumper: touching one sends the die back toward the middle with a little hop.
    const p = body.position, v = body.velocity, near = DR + 0.08;
    const hitX = TX - Math.abs(p.x) < near, hitZ = TZ - Math.abs(p.z) < near;
    if ((hitX || hitZ) && i - lastBump > 12) {
      lastBump = i;
      if (hitX) v.x = -Math.sign(p.x) * Math.max(Math.abs(v.x) * 0.6, r(2.5, 3.5));
      if (hitZ) v.z = -Math.sign(p.z) * Math.max(Math.abs(v.z) * 0.6, r(2.5, 3.5));
      v.y = Math.max(v.y, r(1.5, 2.5));
    }
    world.step(1 / 60);
    const q = body.quaternion;
    frames.push(Float32Array.of(p.x, p.y, p.z, q.x, q.y, q.z, q.w));
  }
  const q = new THREE.Quaternion(body.quaternion.x, body.quaternion.y, body.quaternion.z, body.quaternion.w);
  let top = 1, best = -2;
  for (let n = 1; n <= 20; n++) { const y = faceNormal(n).applyQuaternion(q).y; if (y > best) { best = y; top = n; } }
  return { frames, top };
}
