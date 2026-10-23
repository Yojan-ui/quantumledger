/**
 * Physical springs for 3D objects: mass, stiffness and damping, stepped with semi-implicit Euler in
 * fixed substeps (stable at any frame rate). They replace tweens for anything that moves as an object:
 * it accelerates, overshoots a little and settles, and a new target mid-flight keeps its momentum.
 *
 * Presets (damping ratio ζ = c / (2√(km))):
 *  - LAND:   ζ ≈ 0.55, a visible overshoot and one settle, for something landing or locking;
 *  - SETTLE: ζ ≈ 0.8, a hint of overshoot, for repositioning;
 *  - SNAP:   ζ ≈ 0.45, stiff and quick, for small mechanical parts (a click);
 *  - LAZY:   ζ ≈ 1, no overshoot, slow, for followers (labels, trails).
 */
import * as THREE from "three";

export interface SpringConfig {
  mass: number;
  stiffness: number;
  damping: number;
}

export const LAND: SpringConfig = { mass: 1, stiffness: 120, damping: 12 };
export const SETTLE: SpringConfig = { mass: 1, stiffness: 90, damping: 15 };
export const SNAP: SpringConfig = { mass: 1, stiffness: 420, damping: 18 };
export const LAZY: SpringConfig = { mass: 1, stiffness: 40, damping: 12.6 };

const STEP = 1 / 240;
const MAX_DT = 0.1;

/** One damped spring step for a scalar; returns [x, v]. */
export function stepSpring(
  x: number,
  v: number,
  target: number,
  dt: number,
  c: SpringConfig,
): [number, number] {
  let t = Math.min(dt, MAX_DT);
  while (t > 1e-6) {
    const h = Math.min(STEP, t);
    const a = (c.stiffness * (target - x) - c.damping * v) / c.mass;
    v += a * h;
    x += v * h;
    t -= h;
  }
  return [x, v];
}

/** A scalar spring. */
export class Spring {
  x: number;
  v = 0;
  target: number;
  constructor(
    x = 0,
    public config: SpringConfig = SETTLE,
  ) {
    this.x = x;
    this.target = x;
  }
  /** Jumps to `x` at rest (reduced motion, or a cut). */
  set(x: number) {
    this.x = this.target = x;
    this.v = 0;
    return this;
  }
  /** A kick: adds velocity (a jolt, a shock wave). */
  impulse(dv: number) {
    this.v += dv;
    return this;
  }
  step(dt: number) {
    [this.x, this.v] = stepSpring(this.x, this.v, this.target, dt, this.config);
    return this.x;
  }
  /** At rest within `eps` of its target. */
  settled(eps = 1e-3) {
    return Math.abs(this.x - this.target) < eps && Math.abs(this.v) < eps;
  }
}

/** A 3D spring: position, velocity and target as vectors. */
export class Spring3 {
  readonly x = new THREE.Vector3();
  readonly v = new THREE.Vector3();
  readonly target = new THREE.Vector3();
  constructor(
    at?: THREE.Vector3Like,
    public config: SpringConfig = SETTLE,
  ) {
    if (at) this.set(at);
  }
  set(at: THREE.Vector3Like) {
    this.x.copy(at);
    this.target.copy(at);
    this.v.set(0, 0, 0);
    return this;
  }
  impulse(dv: THREE.Vector3Like) {
    this.v.add(dv);
    return this;
  }
  step(dt: number) {
    const c = this.config;
    let t = Math.min(dt, MAX_DT);
    while (t > 1e-6) {
      const h = Math.min(STEP, t);
      for (const k of ["x", "y", "z"] as const) {
        const a = (c.stiffness * (this.target[k] - this.x[k]) - c.damping * this.v[k]) / c.mass;
        this.v[k] += a * h;
        this.x[k] += this.v[k] * h;
      }
      t -= h;
    }
    return this.x;
  }
  settled(eps = 1e-3) {
    return this.x.distanceTo(this.target) < eps && this.v.length() < eps;
  }
}

/**
 * A spring on an array of scalars (one per node of a lattice, a tree, a cascade): flat typed arrays,
 * so thousands of them cost nothing. `target` and `delay` are per element; an element starts moving
 * only once the clock passes its delay (a cascade).
 */
export class SpringField {
  readonly x: Float32Array;
  readonly v: Float32Array;
  readonly target: Float32Array;
  constructor(
    n: number,
    public config: SpringConfig = LAND,
  ) {
    this.x = new Float32Array(n);
    this.v = new Float32Array(n);
    this.target = new Float32Array(n);
  }
  step(dt: number, active?: (i: number) => boolean) {
    for (let i = 0; i < this.x.length; i++) {
      if (active && !active(i)) continue;
      [this.x[i], this.v[i]] = stepSpring(this.x[i]!, this.v[i]!, this.target[i]!, dt, this.config);
    }
  }
  /** Every element at rest at its target. */
  settled(eps = 1e-3) {
    for (let i = 0; i < this.x.length; i++)
      if (Math.abs(this.x[i]! - this.target[i]!) > eps || Math.abs(this.v[i]!) > eps) return false;
    return true;
  }
}
