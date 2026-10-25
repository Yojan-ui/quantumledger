/**
 * Timing curves for the 3D: anticipation, the "throw" of an arc, cascades that spread from a point of
 * contact, and the hold rule. Pure functions of time, so a scene stays a function of its state.
 */
import * as THREE from "three";

export const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
export const smoothstep = (x: number) => {
  const t = clamp01(x);
  return t * t * (3 - 2 * t);
};
/** Ken Perlin's smootherstep: zero velocity and acceleration at both ends. */
export const smootherstep = (x: number) => {
  const t = clamp01(x);
  return t * t * t * (t * (t * 6 - 15) + 10);
};

/** Seconds every important beat holds before the next main action may start. */
export const HOLD = 1.2;
/** The wind-up before a big move. */
export const WINDUP = 0.12;

/**
 * Progress of a move with anticipation: for the first `windup` seconds it backs off (to −`amount`),
 * then travels to 1 with smootherstep. `t` is seconds since the move began, `duration` the travel
 * time after the wind-up. Multiply a displacement by it; the dip is the move in the opposite direction.
 */
export function anticipate(t: number, duration: number, windup = WINDUP, amount = 0.06): number {
  if (t <= 0) return 0;
  if (t < windup) {
    const u = t / windup;
    return -amount * Math.sin((u * Math.PI) / 2) ** 2;
  }
  const u = clamp01((t - windup) / duration);
  return -amount + (1 + amount) * smootherstep(u);
}

/**
 * A thrown object's progress along its arc: fast out, slowest at the apex, fast in. The speed is
 * 1 − k·sin(πt) (normalised), so the time spent near the apex is what makes it read as a throw.
 * k in [0, 0.95): 0 is linear.
 */
export function throwArc(t: number, k = 0.7): number {
  const u = clamp01(t);
  return (u - (k * (1 - Math.cos(Math.PI * u))) / Math.PI) / (1 - (2 * k) / Math.PI);
}

/** Speed of `throwArc` at t (relative): for trails that stretch with speed. */
export const throwSpeed = (t: number, k = 0.7) =>
  (1 - k * Math.sin(Math.PI * clamp01(t))) / (1 - (2 * k) / Math.PI);

/** Ease in and out for travel along a curve (a packet on a line): slow start, cruise, slow arrival. */
export const travel = (t: number) => smootherstep(t);

/**
 * Delays for a cascade spreading from a point of contact: each element waits in proportion to its
 * distance, quantised into beats of `beat` seconds (40–80 ms), so it reads as a wave with a rhythm,
 * never as index order. `speed` is world units per second of the wave front.
 */
export function cascadeDelays(
  points: ArrayLike<number>, // xyz triples
  origin: THREE.Vector3Like,
  { speed = 6, beat = 0.06, max = 1.2 }: { speed?: number; beat?: number; max?: number } = {},
): Float32Array {
  const n = Math.floor(points.length / 3);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const dx = points[i * 3]! - origin.x;
    const dy = points[i * 3 + 1]! - origin.y;
    const dz = points[i * 3 + 2]! - origin.z;
    const d = Math.sqrt(dx * dx + dy * dy + dz * dz) / speed;
    out[i] = Math.min(max, Math.round(d / beat) * beat);
  }
  return out;
}

/** Same, for a list of items with an index-free "distance" already known (tree depth, chain hops). */
export const ripple = (distance: number, beat = 0.06) => distance * beat;

/**
 * A time scale for slow motion around a moment of impact: 1 → `low` over `ramp` s before `at`, held
 * for `hold` s, then back to 1 over `ramp` s. Integrate scene time with it (`dt * timeScale(...)`).
 */
export function timeScale(t: number, at: number, low = 0.2, ramp = 0.18, hold = 0.35): number {
  const a = at - ramp;
  const b = at + hold;
  if (t < a || t > b + ramp) return 1;
  if (t < at) return 1 - (1 - low) * smoothstep((t - a) / ramp);
  if (t <= b) return low;
  return low + (1 - low) * smoothstep((t - b) / ramp);
}

/** Damped oscillation after a kick (a wobble from a shock wave, a click-settle): 0 at rest. */
export const wobble = (t: number, freq = 9, decay = 6) =>
  t <= 0 ? 0 : Math.exp(-decay * t) * Math.sin(2 * Math.PI * freq * t);

/**
 * The response of a damped spring released at t = 0 from 0 towards 1 (analytic, so a scene can stay
 * a pure function of time since its real event): 0 before, overshoot ≈ e^(−πζ/√(1−ζ²)), then settle.
 * ζ 0.5 at 1.6 Hz: ~16% overshoot, settled in ~0.7 s. ζ 0.3: a bouncier clunk.
 */
export function springIn(t: number, zeta = 0.5, hz = 1.6): number {
  if (t <= 0) return 0;
  const w = 2 * Math.PI * hz;
  const z = Math.min(zeta, 0.999);
  const wd = w * Math.sqrt(1 - z * z);
  return 1 - Math.exp(-z * w * t) * (Math.cos(wd * t) + ((z * w) / wd) * Math.sin(wd * t));
}

/**
 * A launch: a wind-up in the opposite direction for `windup` s (to −`amount`), then the spring
 * response from there to 1. Multiply a displacement by it.
 */
export function launch(
  t: number,
  { windup = WINDUP, amount = 0.08, zeta = 0.5, hz = 1.6 } = {},
): number {
  if (t <= 0) return 0;
  if (t < windup) return -amount * Math.sin(((t / windup) * Math.PI) / 2) ** 2;
  return -amount + (1 + amount) * springIn(t - windup, zeta, hz);
}
