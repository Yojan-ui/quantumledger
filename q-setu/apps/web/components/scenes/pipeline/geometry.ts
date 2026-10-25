/** Shared layout and point sets for the pipeline stage. */
import * as THREE from "three";

export const R = 1.5;
export const CLIENT = new THREE.Vector3(-3.6, 0, 0);
export const SERVER = new THREE.Vector3(3.6, 0, 0);
/** The handshake link arcs over the sphere. */
export const LINK = new THREE.QuadraticBezierCurve3(CLIENT, new THREE.Vector3(0, 3.6, 0.4), SERVER);
export const LINK_MID = LINK.getPoint(0.5);
export const VAULT = new THREE.Vector3(0, -2.3, 2.2);
export const MERKLE_Y = 3.1;
export const CHAIN_Y = 4.7;

/** Deterministic pseudo-random numbers. */
export function rng(seed: number) {
  let s = seed >>> 0;
  return () => (s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32;
}

/** `n` points on a regular cubic lattice inside a sphere of radius r (repeated if the grid is short). */
export function latticePoints(n: number, r = R * 0.92): Float32Array {
  const pts: number[][] = [];
  const step = Math.cbrt(((4 / 3) * Math.PI * r ** 3) / n) * 1.02;
  for (let x = -r; x <= r; x += step)
    for (let y = -r; y <= r; y += step)
      for (let z = -r; z <= r; z += step) if (x * x + y * y + z * z <= r * r) pts.push([x, y, z]);
  const out = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) out.set(pts[i % pts.length]!, i * 3);
  return out;
}

/**
 * `n` points sampled from `text` rasterised on a canvas (the system mono face, no font download),
 * centred, `height` scene units tall. Points repeat if the glyphs have fewer pixels than `n`.
 */
export function textPoints(text: string, n: number, height = 0.9): Float32Array {
  const W = 512;
  const H = 96;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const g = c.getContext("2d")!;
  g.fillStyle = "white"; // an offscreen alpha mask, never shown
  g.font = "600 72px ui-monospace, Menlo, monospace";
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText(text, W / 2, H / 2);
  const data = g.getImageData(0, 0, W, H).data;
  const hits: [number, number][] = [];
  for (let y = 0; y < H; y += 2)
    for (let x = 0; x < W; x += 2) if (data[(y * W + x) * 4 + 3]! > 128) hits.push([x, y]);
  const r = rng(text.length * 97);
  const out = new Float32Array(n * 3);
  const s = height / H;
  for (let i = 0; i < n; i++) {
    const [x, y] = hits.length ? hits[Math.floor(r() * hits.length)]! : [W / 2, H / 2];
    out.set([(x - W / 2) * s, (H / 2 - y) * s, (r() - 0.5) * 0.05], i * 3);
  }
  return out;
}

/**
 * `n` points on the QuantumLedger mark in 3D: a cube's 12 edges plus each face's two midlines (the
 * 2 × 2 lattice on every face, as in lib/brand/mark.ts), turned to the mark's isometric view.
 */
export function logoPoints(n: number, a = 1.15): Float32Array {
  const segs: [number[], number[]][] = [];
  const v = [-a, a];
  // 12 edges: vary one axis, fix the other two at ±a.
  for (let ax = 0; ax < 3; ax++)
    for (const p of v)
      for (const q of v) {
        const s = [0, 0, 0];
        const e = [0, 0, 0];
        const [i, j] = [(ax + 1) % 3, (ax + 2) % 3];
        s[ax] = -a;
        e[ax] = a;
        s[i] = e[i] = p;
        s[j] = e[j] = q;
        segs.push([s, e]);
      }
  // 12 face midlines: on each face (axis = ±a), the two lines through its centre.
  for (let ax = 0; ax < 3; ax++)
    for (const f of v)
      for (let k = 1; k <= 2; k++) {
        const vary = (ax + k) % 3;
        const s = [0, 0, 0];
        const e = [0, 0, 0];
        s[ax] = e[ax] = f;
        s[vary] = -a;
        e[vary] = a;
        segs.push([s, e]);
      }
  const r = rng(11);
  const rot = new THREE.Euler(Math.atan(1 / Math.SQRT2), Math.PI / 4, 0, "XYZ");
  const m = new THREE.Matrix4().makeRotationFromEuler(rot);
  const p = new THREE.Vector3();
  const out = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const [s, e] = segs[i % segs.length]!;
    const t = r();
    p.set(s[0]! + (e[0]! - s[0]!) * t, s[1]! + (e[1]! - s[1]!) * t, s[2]! + (e[2]! - s[2]!) * t);
    p.applyMatrix4(m);
    out[i * 3] = p.x + (r() - 0.5) * 0.02;
    out[i * 3 + 1] = p.y + (r() - 0.5) * 0.02;
    out[i * 3 + 2] = p.z + (r() - 0.5) * 0.02;
  }
  return out;
}
