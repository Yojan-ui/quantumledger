/**
 * Camera language: a move between two framings is a spline, not a straight lerp. A dolly goes straight
 * in or out; a crane rises over the midpoint; an orbit swings around the subject. The camera position
 * travels the spline with smootherstep over 1.2–1.8 s (longer for longer moves), the look-at point
 * travels its own spline slightly ahead (so the subject leads), and the arrival settles with a small
 * damped overshoot. While a framing holds, a very slow drift keeps it alive.
 */
import * as THREE from "three";
import { clamp01, smootherstep, WINDUP, wobble } from "./timing";

export type MoveKind = "dolly" | "crane" | "orbit";

export interface Framing {
  pos: THREE.Vector3;
  look: THREE.Vector3;
}

export interface CameraMove {
  from: Framing;
  to: Framing;
  path: THREE.CatmullRomCurve3;
  lookPath: THREE.CatmullRomCurve3;
  duration: number;
}

/** Duration in seconds for a move of this length (world units), within the 1.2–1.8 s band. */
export const moveDuration = (distance: number, min = 1.2, max = 1.8) =>
  min + (max - min) * clamp01(distance / 12);

/** Picks the move that suits the two framings: mostly along the view → dolly, big angle → orbit. */
export function chooseMove(from: Framing, to: Framing): MoveKind {
  const a = from.pos.clone().sub(from.look).normalize();
  const b = to.pos.clone().sub(to.look).normalize();
  const angle = a.angleTo(b);
  if (angle > 0.6) return "orbit";
  if (from.look.distanceTo(to.look) < 0.3) return "dolly";
  return "crane";
}

export function planMove(from: Framing, to: Framing, kind = chooseMove(from, to)): CameraMove {
  const mid = from.pos.clone().lerp(to.pos, 0.5);
  const d = from.pos.distanceTo(to.pos);
  if (kind === "crane") mid.y += Math.max(0.6, d * 0.35);
  if (kind === "orbit") {
    // Swing out around the midpoint of the two subjects, keeping the average distance.
    const c = from.look.clone().lerp(to.look, 0.5);
    const r = (from.pos.distanceTo(from.look) + to.pos.distanceTo(to.look)) / 2;
    mid
      .sub(c)
      .setLength(r * 1.08)
      .add(c);
  }
  const path = new THREE.CatmullRomCurve3(
    [from.pos.clone(), mid, to.pos.clone()],
    false,
    "centripetal",
  );
  const lookPath = new THREE.CatmullRomCurve3(
    [from.look.clone(), from.look.clone().lerp(to.look, 0.6), to.look.clone()],
    false,
    "centripetal",
  );
  return { from, to, path, lookPath, duration: moveDuration(d) };
}

const tmp = new THREE.Vector3();

/**
 * Evaluates a move `t` seconds in, into `pos` / `look`. Returns true once arrived and settled. A big
 * move (over 3 units) first eases back for 120 ms (anticipation: up to 4% of the distance, at most
 * 0.25); the look leads the position by ~8% of the move; the arrival carries a small settle.
 * `travelled(m, t)` is the travel progress 0..1 (for focus pulls and fov).
 */
export const travelled = (m: CameraMove, t: number) =>
  smootherstep(clamp01((t - (m.from.pos.distanceTo(m.to.pos) > 3 ? WINDUP : 0)) / m.duration));

export function sampleMove(m: CameraMove, t: number, pos: THREE.Vector3, look: THREE.Vector3) {
  const d = m.from.pos.distanceTo(m.to.pos);
  const windup = d > 3 ? WINDUP : 0;
  if (t < windup) {
    const dip = Math.min(0.25, d * 0.04) * Math.sin(((t / windup) * Math.PI) / 2) ** 2;
    pos.copy(m.from.pos).add(tmp.copy(m.from.pos).sub(m.to.pos).normalize().multiplyScalar(dip));
    look.copy(m.from.look);
    return false;
  }
  t -= windup;
  const u = clamp01(t / m.duration);
  const e = smootherstep(u);
  m.path.getPoint(e, pos);
  m.lookPath.getPoint(Math.min(1, smootherstep(clamp01(u * 1.08))), look);
  if (windup && u < 1) {
    // Blend out of the wind-up over the first fifth of the travel.
    const dip = Math.min(0.25, d * 0.04) * (1 - smootherstep(u * 5));
    pos.add(tmp.copy(m.from.pos).sub(m.to.pos).normalize().multiplyScalar(dip));
  }
  if (u >= 1) {
    // The settle: a damped push along the travel direction, centimetres, gone in half a second.
    const s = wobble(t - m.duration, 1.6, 7) * 0.04 * m.from.pos.distanceTo(m.to.pos);
    tmp.copy(m.to.pos).sub(m.from.pos).normalize().multiplyScalar(s);
    pos.add(tmp);
  }
  return u >= 1 && t - m.duration > 0.6;
}

/**
 * Holding drift: a slow Lissajous wander of `amount` × the subject distance, so a held frame breathes.
 */
export function drift(t: number, framing: Framing, amount: number, out: THREE.Vector3) {
  const r = framing.pos.distanceTo(framing.look) * amount;
  return out
    .copy(framing.pos)
    .add(
      tmp.set(
        Math.sin(t * 0.13) * r,
        Math.sin(t * 0.09 + 1.3) * r * 0.5,
        Math.cos(t * 0.11) * r * 0.6,
      ),
    );
}

/**
 * Parallax: layers at different depths move by different fractions of a camera offset, so near, mid
 * and far read as separate planes during a move. Returns the offset for a layer at `depth` (0 near, 1
 * far) given the camera's lateral offset from its framing.
 */
export const parallax = (offset: THREE.Vector3, depth: number, out: THREE.Vector3) =>
  out.copy(offset).multiplyScalar(0.25 * (1 - depth));
