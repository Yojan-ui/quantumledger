/**
 * A light rope: Verlet integration with distance constraints (Jakobsen). Points can be pinned; a pinned
 * point is moved by the scene (it follows a block). Gravity and damping are gentle: the chain sags
 * and swings like a cord, never like a heavy cable.
 */
import * as THREE from "three";

export class Rope {
  readonly p: THREE.Vector3[];
  readonly prev: THREE.Vector3[];
  readonly pinned: boolean[];
  /** Rest length between neighbours; Infinity breaks the link (a tampered entry). */
  readonly rest: number[];
  gravity = new THREE.Vector3(0, -2.4, 0);
  damping = 0.985;
  iterations = 8;

  constructor(points: THREE.Vector3[]) {
    this.p = points.map((q) => q.clone());
    this.prev = points.map((q) => q.clone());
    this.pinned = points.map(() => false);
    this.rest = points.slice(1).map((q, i) => q.distanceTo(points[i]!));
  }

  /** Moves a pinned point (and its history, so it doesn't fling). */
  pin(i: number, at: THREE.Vector3Like, carry = false) {
    this.pinned[i] = true;
    if (!carry) this.prev[i]!.copy(at);
    this.p[i]!.copy(at);
  }
  release(i: number) {
    this.pinned[i] = false;
  }
  /** A kick to one point (a jolt). */
  kick(i: number, dv: THREE.Vector3Like, dt = 1 / 60) {
    const q = this.p[i]!;
    this.prev[i]!.set(q.x - dv.x * dt, q.y - dv.y * dt, q.z - dv.z * dt);
  }
  /** Tightens (k < 1) or slackens the rest lengths: restoring pulls the chain taut. */
  scale(k: number, lengths: number[]) {
    for (let i = 0; i < this.rest.length; i++)
      if (Number.isFinite(this.rest[i]!)) this.rest[i] = lengths[i]! * k;
  }

  step(dt: number) {
    const h = Math.min(dt, 1 / 30);
    const g = this.gravity;
    for (let i = 0; i < this.p.length; i++) {
      if (this.pinned[i]) continue;
      const q = this.p[i]!;
      const o = this.prev[i]!;
      const vx = (q.x - o.x) * this.damping;
      const vy = (q.y - o.y) * this.damping;
      const vz = (q.z - o.z) * this.damping;
      o.copy(q);
      q.set(q.x + vx + g.x * h * h, q.y + vy + g.y * h * h, q.z + vz + g.z * h * h);
    }
    for (let k = 0; k < this.iterations; k++) {
      for (let i = 0; i < this.rest.length; i++) {
        const r = this.rest[i]!;
        if (!Number.isFinite(r)) continue;
        const a = this.p[i]!;
        const b = this.p[i + 1]!;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dz = b.z - a.z;
        const d = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1e-6;
        const diff = (d - r) / d;
        const wa = this.pinned[i] ? 0 : this.pinned[i + 1] ? 1 : 0.5;
        const wb = this.pinned[i + 1] ? 0 : this.pinned[i] ? 1 : 0.5;
        a.x += dx * diff * wa;
        a.y += dy * diff * wa;
        a.z += dz * diff * wa;
        b.x -= dx * diff * wb;
        b.y -= dy * diff * wb;
        b.z -= dz * diff * wb;
      }
    }
  }
}
