/**
 * The pipeline stage's per-frame "look", computed once a frame from the pipeline state and the real
 * events' timestamps, then read by every part of the scene. Nothing here is on a timer of its own:
 * each value starts when the event that causes it has happened (scan result, key generated,
 * signature verified, ledger appended, sweep result).
 */
import * as THREE from "three";
import type { PipelineState } from "@/lib/client/pipeline";
import { easeToken } from "@/lib/ease";
import type { palette } from "@/components/world/palette";
import { gfx } from "@/lib/client/gfx";

export type Palette = ReturnType<typeof palette>;
export type Part = "swarm" | "link" | "vault" | "mosca" | "merkle" | "radar";

/** Which parts each shot is about (the others soften: a stand-in for depth of field). */
const FOCUS: Part[][] = [
  ["swarm", "link"],
  ["swarm", "link", "vault"],
  ["swarm", "mosca"],
  ["swarm", "link", "vault"],
  ["merkle", "swarm"],
  ["radar", "swarm", "link", "merkle"],
];

export const SWEEP_MS = 2500;
export const MORPH_MS = 1200;

export interface Look {
  active: boolean;
  reduce: boolean;
  mobile: boolean;
  stage: number;
  now: number;
  /** Time since each real event, in ms (Infinity = hasn't happened). */
  since: {
    scan: number;
    score: number;
    patch: number;
    anchor: number;
    sweep: number;
    result: number;
  };
  morph: number;
  lift: number;
  /** Radar progress 0..1 (where the sweep line is), and the angle it stopped at if tampered. */
  sweep: number;
  sweepOk?: boolean;
  /** 0..1: how "verified green" a point at this azimuth (radians, 0 = +x, counter-clockwise) is. */
  green: (azimuth: number) => number;
  swarmA: THREE.Color;
  swarmB: THREE.Color;
  sphere: THREE.Color;
  dim: (p: Part) => number;
  c: Palette;
}

const since = (t: number, now: number) => (t > 0 ? now - t : Infinity);
const mix = (out: THREE.Color, a: THREE.Color, b: THREE.Color, k: number) =>
  out.copy(a).lerp(b, Math.max(0, Math.min(1, k)));

export function makeLook(c: Palette): Look {
  return {
    active: false,
    reduce: false,
    mobile: false,
    stage: -1,
    now: 0,
    since: {
      scan: Infinity,
      score: Infinity,
      patch: Infinity,
      anchor: Infinity,
      sweep: Infinity,
      result: Infinity,
    },
    morph: 0,
    lift: 0,
    sweep: 0,
    green: () => 0,
    swarmA: c.danger.clone(),
    swarmB: c.text.clone(),
    sphere: c.danger.clone(),
    dim: () => 1,
    c,
  };
}

/** Updates `L` in place for this frame. `sweepStart` = when the RESCAN stage began. */
/** The camera's longest move: a stage's effect waits for it so it's seen from its own shot. */
export const CAMERA_MS = 1600;

export function updateLook(
  L: Look,
  s: PipelineState,
  now: number,
  sweepStart: number,
  sweepResultAt: number,
  /** When the camera started towards each stage's shot (performance.now()), 0 = not yet. */
  entered: number[],
) {
  const { c } = L;
  L.now = now;
  L.stage = s.stage;
  // Each effect starts at its real event, or when the camera has arrived, whichever is later.
  const d = s.doneAt.map((t, i) =>
    t > 0 ? Math.max(t, (entered[i] ?? 0) + (L.reduce ? 0 : CAMERA_MS)) : 0,
  );
  L.since = {
    scan: since(d[0]!, now),
    score: since(d[1]!, now),
    patch: since(d[2]!, now),
    anchor: since(d[3]!, now),
    sweep: since(sweepStart, now),
    result: since(sweepResultAt, now),
  };
  const r = L.reduce;
  // DEFEND: the swarm assembles into a lattice over 1.2 s after the real handshake.
  L.morph = s.status[2] === "done" ? (r ? 1 : easeToken(Math.min(1, L.since.patch / MORPH_MS))) : 0;
  // SCORE: the sphere lifts while the risk is on screen.
  const liftTo = s.stage === 1 ? 0.55 : 0;
  L.lift += (liftTo - L.lift) * (r ? 1 : 0.06);
  // RESCAN: the radar sweeps once in 2.5 s; it stops at the tampered block if the result says so.
  const failed = s.status[4] === "failed" || (s.sweep && !s.sweep.ok);
  const raw =
    s.status[4] === "idle" ? 0 : r ? 1 : Math.max(0, Math.min(1, L.since.sweep / SWEEP_MS));
  L.sweepOk = s.sweep ? s.sweep.ok : undefined;
  L.sweep = failed ? Math.min(raw, 0.25) : raw;
  const verified = s.status[4] === "done" && !!s.sweep?.ok;
  const swept = L.sweep;
  L.green = (az) => {
    if (!verified) return 0;
    // The sweep runs counter-clockwise from +x; a point turns green once the line has passed it
    // and the real verification result is in.
    const a = (((az % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)) / (Math.PI * 2);
    return swept >= a ? Math.min(1, (swept - a) * 12 + (L.since.result < Infinity ? 0.2 : 0)) : 0;
  };
  // Colours: threat red → (score) orange → (fix) white lattice in KEM → (verified) green.
  const harvest = s.status[0] === "done" ? c.danger : c.text3;
  mix(L.swarmA, harvest, c.warn, s.stage === 1 ? 1 : 0);
  mix(L.swarmB, c.text, c.ok, L.green(0));
  mix(L.sphere, L.swarmA, c.kem, L.morph);
  L.sphere.lerp(c.ok, L.green(Math.PI / 2));
  const focus = FOCUS[s.stage + 1] ?? FOCUS[0]!;
  // The last step of the quality ladder (lib/client/gfx) drops focus dimming.
  L.dim = (p) => (L.mobile || L.reduce || gfx.quality >= 3 || focus.includes(p) ? 1 : 0.4);
}
