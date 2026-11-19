import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { faceNormal, simulate, symmetry } from './d20Sim';
import { seededRandom } from '#lib/pick/random.ts';

const SIZE = { w: 800, h: 360 };
const quatOf = (f: Float32Array) => new THREE.Quaternion(f[3], f[4], f[5], f[6]);

describe('d20 simulation', () => {
  const rand = seededRandom('d20');
  const runs = Array.from({ length: 200 }, () => simulate(rand, SIZE));

  it('settles within 480 frames', () => {
    for (const r of runs) {
      expect(r.frames.length).toBeGreaterThan(0);
      expect(r.frames.length).toBeLessThanOrEqual(480);
    }
  });
  it('lands on every face', () => {
    expect(new Set(runs.map((r) => r.top)).size).toBe(20);
  });
  it('top is the face whose normal is most up in the last frame', () => {
    for (const r of runs) {
      const q = quatOf(r.frames[r.frames.length - 1]);
      let best = 0, bestY = -2;
      for (let n = 1; n <= 20; n++) {
        const y = faceNormal(n).applyQuaternion(q).y;
        if (y > bestY) { bestY = y; best = n; }
      }
      expect(r.top).toBe(best);
    }
  });
  it('is deterministic for a seed', () => {
    const a = simulate(seededRandom('x'), SIZE), b = simulate(seededRandom('x'), SIZE);
    expect(Array.from(a.frames.at(-1)!)).toEqual(Array.from(b.frames.at(-1)!));
  });
});

describe('symmetry', () => {
  it('maps face from onto face to', () => {
    for (let from = 1; from <= 20; from++) for (let to = 1; to <= 20; to++) {
      const q = new THREE.Quaternion(...symmetry(from, to));
      expect(faceNormal(from).applyQuaternion(q).distanceTo(faceNormal(to))).toBeLessThan(1e-6);
    }
  });
});
