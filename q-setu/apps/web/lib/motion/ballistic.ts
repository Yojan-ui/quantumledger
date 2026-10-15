/**
 * Shards and debris without a physics library: each piece has a start, a velocity and a spin, and
 * moves under light drag and gravity in closed form, so a scene can jump to any moment (a still frame,
 * a scrubbed replay) and get the same answer. Paired with slow motion: `sceneTime` is the exact
 * integral of the time-scale ramp (timing.ts timeScale: 1 → low → 1 around the moment of impact).
 */
import * as THREE from "three";

/** ∫₀ˣ smoothstep(u) du. */
const I = (x: number) => x * x * x - (x * x * x * x) / 2;

/**
 * Scene seconds elapsed after `t` real seconds, when time slows to `low` around `at`: it eases from 1
 * to `low` over `ramp` s before `at`, holds `low` for `hold` s, and eases back over `ramp` s.
 */
export function sceneTime(t: number, at: number, low = 0.2, ramp = 0.18, hold = 0.35): number {
  if (t <= 0) return 0;
  const a = Math.max(0, at - ramp);
  const rampIn = at - a;
  const b = at + hold;
  if (t <= a) return t;
  let s = a;
  if (t <= at) {
    const u = (t - a) / rampIn;
    return s + rampIn * (u - (1 - low) * I(u));
  }
  s += rampIn * (1 - (1 - low) * 0.5);
  if (t <= b) return s + low * (t - at);
  s += low * hold;
  if (t <= b + ramp) {
    const u = (t - b) / ramp;
    return s + ramp * (low * u + (1 - low) * I(u));
  }
  s += ramp * (low + (1 - low) * 0.5);
  return s + (t - b - ramp);
}

export interface Piece {
  start: THREE.Vector3;
  velocity: THREE.Vector3;
  spin: THREE.Vector3;
}

const GRAVITY = -1.1;

/**
 * Where a piece is `tau` scene seconds after it was set loose: velocity decays with drag `k`
 * (∫ e^(−kτ) = (1 − e^(−kτ))/k) and light gravity pulls it down. Rotation = spin × τ.
 */
export function piece(
  p: Piece,
  tau: number,
  pos: THREE.Vector3,
  rot: THREE.Euler,
  { drag = 1.4, gravity = GRAVITY }: { drag?: number; gravity?: number } = {},
) {
  const s = tau <= 0 ? 0 : (1 - Math.exp(-drag * tau)) / drag;
  const t = Math.max(0, tau);
  pos.copy(p.start).addScaledVector(p.velocity, s);
  pos.y += 0.5 * gravity * t * t;
  rot.set(p.spin.x * t, p.spin.y * t, p.spin.z * t);
  return pos;
}

/** Deterministic pieces bursting out of a box of half-size `r`: faster from the impact side. */
export function burst(n: number, r: number, seed = 1, speed = 1.6): Piece[] {
  let s = seed >>> 0 || 1;
  const rnd = () => (s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32 - 0.5;
  return Array.from({ length: n }, () => {
    const start = new THREE.Vector3(rnd() * r * 2, rnd() * r * 2, rnd() * r * 2);
    const dir = start.clone().normalize();
    const velocity = dir
      .multiplyScalar(speed * (0.6 + Math.abs(rnd()) * 1.2))
      .add(new THREE.Vector3(0, 0.35 + Math.abs(rnd()) * 0.5, 0));
    const spin = new THREE.Vector3(rnd() * 14, rnd() * 14, rnd() * 14);
    return { start, velocity, spin };
  });
}
