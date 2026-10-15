/**
 * Flow that looks alive: curl noise. The curl of a smooth noise field is divergence-free, so particles
 * that follow it swirl and stream like smoke or a flock instead of jittering. 3D simplex noise
 * (Gustavson's, seeded) and the curl by central differences of three offset noise fields.
 */
import * as THREE from "three";

const GRAD = new Float32Array([
  1, 1, 0, -1, 1, 0, 1, -1, 0, -1, -1, 0, 1, 0, 1, -1, 0, 1, 1, 0, -1, -1, 0, -1, 0, 1, 1, 0, -1, 1,
  0, 1, -1, 0, -1, -1,
]);

function perm(seed: number) {
  const p = new Uint8Array(256);
  for (let i = 0; i < 256; i++) p[i] = i;
  let s = seed >>> 0 || 1;
  for (let i = 255; i > 0; i--) {
    s = (s * 1664525 + 1013904223) >>> 0;
    const j = s % (i + 1);
    [p[i], p[j]] = [p[j]!, p[i]!];
  }
  const out = new Uint8Array(512);
  for (let i = 0; i < 512; i++) out[i] = p[i & 255]!;
  return out;
}

const P = perm(1337);
const F3 = 1 / 3;
const G3 = 1 / 6;

/** 3D simplex noise in about [-1, 1]. */
export function noise3(x: number, y: number, z: number): number {
  const s = (x + y + z) * F3;
  const i = Math.floor(x + s);
  const j = Math.floor(y + s);
  const k = Math.floor(z + s);
  const t = (i + j + k) * G3;
  const x0 = x - (i - t);
  const y0 = y - (j - t);
  const z0 = z - (k - t);
  let i1, j1, k1, i2, j2, k2;
  if (x0 >= y0) {
    if (y0 >= z0) [i1, j1, k1, i2, j2, k2] = [1, 0, 0, 1, 1, 0];
    else if (x0 >= z0) [i1, j1, k1, i2, j2, k2] = [1, 0, 0, 1, 0, 1];
    else [i1, j1, k1, i2, j2, k2] = [0, 0, 1, 1, 0, 1];
  } else if (y0 < z0) [i1, j1, k1, i2, j2, k2] = [0, 0, 1, 0, 1, 1];
  else if (x0 < z0) [i1, j1, k1, i2, j2, k2] = [0, 1, 0, 0, 1, 1];
  else [i1, j1, k1, i2, j2, k2] = [0, 1, 0, 1, 1, 0];
  const c = [
    [x0, y0, z0, 0, 0, 0],
    [x0 - i1 + G3, y0 - j1 + G3, z0 - k1 + G3, i1, j1, k1],
    [x0 - i2 + 2 * G3, y0 - j2 + 2 * G3, z0 - k2 + 2 * G3, i2, j2, k2],
    [x0 - 1 + 3 * G3, y0 - 1 + 3 * G3, z0 - 1 + 3 * G3, 1, 1, 1],
  ] as const;
  const ii = i & 255;
  const jj = j & 255;
  const kk = k & 255;
  let n = 0;
  for (const [dx, dy, dz, a, b, d] of c) {
    let q = 0.6 - dx * dx - dy * dy - dz * dz;
    if (q < 0) continue;
    const g = (P[ii + a + P[jj + b + P[kk + d]!]!]! % 12) * 3;
    q *= q;
    n += q * q * (GRAD[g]! * dx + GRAD[g + 1]! * dy + GRAD[g + 2]! * dz);
  }
  return 32 * n;
}

const E = 1e-3;
const pot = (x: number, y: number, z: number, out: THREE.Vector3) =>
  out.set(
    noise3(x, y, z),
    noise3(x + 31.4, y - 12.9, z + 7.7),
    noise3(x - 19.1, y + 41.3, z - 3.3),
  );
const a = new THREE.Vector3();
const b = new THREE.Vector3();

/**
 * The curl of a 3D noise potential at (x, y, z), into `out` (length about 0–3). Scale the input by
 * the field's frequency and add time to one axis to make it evolve.
 */
export function curl(x: number, y: number, z: number, out: THREE.Vector3): THREE.Vector3 {
  pot(x, y + E, z, a);
  pot(x, y - E, z, b);
  const dPz_dy = (a.z - b.z) / (2 * E);
  const dPx_dy = (a.x - b.x) / (2 * E);
  pot(x, y, z + E, a);
  pot(x, y, z - E, b);
  const dPy_dz = (a.y - b.y) / (2 * E);
  const dPx_dz = (a.x - b.x) / (2 * E);
  pot(x + E, y, z, a);
  pot(x - E, y, z, b);
  const dPz_dx = (a.z - b.z) / (2 * E);
  const dPy_dx = (a.y - b.y) / (2 * E);
  return out.set(dPz_dy - dPy_dz, dPx_dz - dPz_dx, dPy_dx - dPx_dy);
}
