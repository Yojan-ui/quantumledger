"use client";

/**
 * A tube that follows moving points (a swinging rope, say) with no allocation per frame: a fixed
 * vertex buffer whose rings are recomputed in place along the points. uv.x runs along its length
 * (for the energy shader), normals point outward (for its rim), and each point can carry a colour.
 */
import * as THREE from "three";

export function makeDynamicTube(count: number, radial = 8) {
  const verts = count * radial;
  const g = new THREE.BufferGeometry();
  const pos = new Float32Array(verts * 3);
  const nor = new Float32Array(verts * 3);
  const col = new Float32Array(verts * 3).fill(1);
  const uv = new Float32Array(verts * 2);
  const idx: number[] = [];
  for (let i = 0; i < count; i++)
    for (let j = 0; j < radial; j++) {
      uv[(i * radial + j) * 2] = i / (count - 1);
      uv[(i * radial + j) * 2 + 1] = j / radial;
      if (i < count - 1) {
        const a = i * radial + j;
        const b = i * radial + ((j + 1) % radial);
        const c = (i + 1) * radial + j;
        const d = (i + 1) * radial + ((j + 1) % radial);
        idx.push(a, c, b, b, c, d);
      }
    }
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  g.setAttribute("normal", new THREE.BufferAttribute(nor, 3));
  g.setAttribute("color", new THREE.BufferAttribute(col, 3));
  g.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  g.setIndex(idx);
  const T = new THREE.Vector3();
  const N = new THREE.Vector3();
  const B = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);
  const d = new THREE.Vector3();
  /** Rebuild the rings along `points` (length `count`); `rgb` is one colour per point (optional). */
  function update(points: THREE.Vector3[], radius: number, rgb?: Float32Array) {
    for (let i = 0; i < count; i++) {
      const p = points[i]!;
      T.subVectors(points[Math.min(count - 1, i + 1)]!, points[Math.max(0, i - 1)]!).normalize();
      N.crossVectors(T, up);
      if (N.lengthSq() < 1e-6) N.set(0, 0, 1);
      N.normalize();
      B.crossVectors(T, N);
      for (let j = 0; j < radial; j++) {
        const a = (j / radial) * Math.PI * 2;
        d.copy(N).multiplyScalar(Math.cos(a)).addScaledVector(B, Math.sin(a));
        const k = (i * radial + j) * 3;
        pos[k] = p.x + d.x * radius;
        pos[k + 1] = p.y + d.y * radius;
        pos[k + 2] = p.z + d.z * radius;
        nor[k] = d.x;
        nor[k + 1] = d.y;
        nor[k + 2] = d.z;
        if (rgb) {
          col[k] = rgb[i * 3]!;
          col[k + 1] = rgb[i * 3 + 1]!;
          col[k + 2] = rgb[i * 3 + 2]!;
        }
      }
    }
    g.attributes.position!.needsUpdate = true;
    g.attributes.normal!.needsUpdate = true;
    if (rgb) g.attributes.color!.needsUpdate = true;
    g.computeBoundingSphere();
  }
  return { geometry: g, update };
}
