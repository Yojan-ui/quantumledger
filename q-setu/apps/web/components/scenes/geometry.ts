import * as THREE from "three";

/** A lattice cube: grid lines on three planes per axis (the "lattice" in lattice-based crypto). */
export function latticeCube(size = 1, n = 3): THREE.BufferGeometry {
  const pts: number[] = [];
  const h = size / 2;
  const at = (i: number) => -h + (i * size) / (n - 1);
  for (let a = 0; a < n; a++)
    for (let b = 0; b < n; b++) {
      pts.push(-h, at(a), at(b), h, at(a), at(b));
      pts.push(at(a), -h, at(b), at(a), h, at(b));
      pts.push(at(a), at(b), -h, at(a), at(b), h);
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
  return g;
}

export const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
/** Maps p from [a, b] to [0, 1]. */
export const span = (p: number, a: number, b: number) => clamp01((p - a) / (b - a));

/** Writes x, y, z into a flat array at vertex `i` (no temporary array: safe to call per frame). */
export function set3(a: Float32Array, i: number, x: number, y: number, z: number) {
  a[i * 3] = x;
  a[i * 3 + 1] = y;
  a[i * 3 + 2] = z;
}
