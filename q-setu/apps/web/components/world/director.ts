/**
 * The director turns (route mode, scroll chapter) into everything the scene shows. Rules from the
 * design system: one accent per chapter, at most 12 arcs, only the relevant arc fully bright,
 * auto-rotate ≈ 0.05 rad/s, camera moves eased with the motion token cubic-bezier(0.22, 1, 0.36, 1).
 *
 *  0 Hero      India's sector arcs carry live traffic (warn: harvestable today)
 *  1 Seal      the visitor's sealed message leaves on Mumbai → Hyderabad (accent)
 *  2 Harvest   pull back; the Mumbai → London arc carries copies abroad (warn)
 *  3 Q-Day     same arc; recordings open (warn)
 *  4 Sockets   five adapter sockets on the globe (accent)
 *  5 India     dolly in; nodes and India arcs switch to sealed, one by one (accent)
 *  6 Cost      one handshake pulse, then message sparks on Mumbai → London (accent)
 *  7 Close     every arc sealed (accent)
 */
import { arcIndex, ARCS, INDIA_ARCS, NODES } from "./geo";
import { easeToken } from "@/lib/ease";
import { world } from "./store";

export interface Params {
  dist: number;
  lat: number;
  lon: number;
  spin: number;
  /** Camera pitch over the globe's surface, degrees: 0 = head-on, ~65 = low angle over the land. */
  tilt: number;
  /** Camera heading around the surface point it looks at, degrees (side-on shots). */
  yaw: number;
  accent: "accent" | "warn";
  /** Per-arc brightness 0..1 (0.12 = quiet background arc, 1 = the arc this chapter is about). */
  arcLevel: Float32Array;
  /** Per-arc: 1 = drawn in the accent colour, 0 = neutral. */
  arcTint: Float32Array;
  nodes: number;
  nodeSafe: Float32Array;
  sockets: number;
  sparkArc: number;
}

export { easeToken } from "@/lib/ease";
const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x));

interface Pose {
  dist: number;
  lat: number;
  lon: number;
  spin: number;
  tilt?: number;
  yaw?: number;
}
const POSES: Pose[] = [
  { dist: 2.9, lat: 18, lon: 76, spin: 0.05 },
  { dist: 2.9, lat: 18, lon: 78, spin: 0.03 },
  { dist: 3.6, lat: 30, lon: 40, spin: 0.05 },
  { dist: 3.6, lat: 30, lon: 45, spin: 0.03 },
  { dist: 3.0, lat: 18, lon: 80, spin: 0.02 },
  { dist: 1.65, lat: 21, lon: 80, spin: 0 },
  { dist: 3.4, lat: 32, lon: 40, spin: 0.02 },
  { dist: 3.3, lat: 15, lon: 72, spin: 0.05 },
];

/**
 * The homepage flight, one shot per section (world.journey scrubs through it; each section owns a
 * range, so no two consecutive sections share a framing):
 *  0–1  Join live     from one node close up (where the hero's sphere sat) pulling back to the globe
 *  2–3  Index         a low angle over India from the south; the sector columns stand up from it
 *  4–5  Scan          close on one city (the scanned site's server, when a scan is on screen)
 *  6–7  How it works  side-on along the Mumbai → London arc, travelling with the packets
 *  8–9  Solutions     a wide pull-back while India turns sealed in a wave
 */
const KEYS: Required<Pose>[] = [
  { dist: 1.25, lat: 19.1, lon: 72.9, spin: 0, tilt: 0, yaw: 0 },
  { dist: 3.9, lat: 12, lon: 58, spin: 0.03, tilt: 0, yaw: 0 },
  { dist: 1.75, lat: 13, lon: 79, spin: 0, tilt: 64, yaw: 0 },
  { dist: 1.95, lat: 21, lon: 81, spin: 0, tilt: 56, yaw: -18 },
  { dist: 1.3, lat: 19, lon: 73.5, spin: 0, tilt: 36, yaw: 28 },
  { dist: 1.45, lat: 19, lon: 73, spin: 0, tilt: 42, yaw: 44 },
  { dist: 2.15, lat: 30, lon: 46, spin: 0, tilt: 78, yaw: 88 },
  { dist: 2.3, lat: 40, lon: 24, spin: 0, tilt: 76, yaw: 96 },
  { dist: 2.4, lat: 16, lon: 80, spin: 0, tilt: 38, yaw: -12 },
  { dist: 4.8, lat: 14, lon: 78, spin: 0.03, tilt: 0, yaw: 0 },
];
const FIELDS = ["dist", "lat", "lon", "spin", "tilt", "yaw"] as const;

/** Catmull-Rom through the shot list at position j (longitudes unwrapped first). */
function flight(j: number): Required<Pose> {
  const n = KEYS.length;
  const t = clamp(j, 0, n - 1);
  const i = Math.min(n - 2, Math.floor(t));
  const u = t - i;
  const k = (m: number) => KEYS[clamp(m, 0, n - 1)]!;
  const out = { ...k(i) };
  for (const f of FIELDS) {
    let p0 = k(i - 1)[f];
    const p1 = k(i)[f];
    let p2 = k(i + 1)[f];
    let p3 = k(i + 2)[f];
    if (f === "lon") {
      const un = (a: number, b: number) => b + Math.round((a - b) / 360) * 360;
      p0 = un(p0, p1);
      p2 = un(p2, p1);
      p3 = un(p3, p2);
    }
    const u2 = u * u;
    const u3 = u2 * u;
    out[f] =
      0.5 *
      (2 * p1 +
        (-p0 + p2) * u +
        (2 * p0 - 5 * p1 + 4 * p2 - p3) * u2 +
        (-p0 + 3 * p1 - 3 * p2 + p3) * u3);
  }
  out.dist = Math.max(1.1, out.dist);
  out.tilt = clamp(out.tilt, 0, 82);
  return out;
}

function blend(a: Pose, b: Pose, t: number): Pose {
  let dl = b.lon - a.lon;
  if (dl > 180) dl -= 360;
  if (dl < -180) dl += 360;
  return {
    dist: a.dist + (b.dist - a.dist) * t,
    lat: a.lat + (b.lat - a.lat) * t,
    lon: a.lon + dl * t,
    spin: a.spin + (b.spin - a.spin) * t,
    tilt: (a.tilt ?? 0) + ((b.tilt ?? 0) - (a.tilt ?? 0)) * t,
    yaw: (a.yaw ?? 0) + ((b.yaw ?? 0) - (a.yaw ?? 0)) * t,
  };
}

const NA = ARCS.length;
const UPI = Math.max(0, arcIndex("mumbai", "hyderabad"));
const ABROAD = Math.max(0, arcIndex("mumbai", "london"));

const p: Params = {
  ...POSES[0]!,
  tilt: 0,
  yaw: 0,
  accent: "warn",
  arcLevel: new Float32Array(NA),
  arcTint: new Float32Array(NA),
  nodes: 0,
  nodeSafe: new Float32Array(NODES.length),
  sockets: 0,
  sparkArc: -1,
};

export const params: Params = p;

export function direct(): Params {
  p.arcLevel.fill(0.12);
  p.arcTint.fill(0);
  p.nodeSafe.fill(0);
  p.nodes = p.sockets = 0;
  p.sparkArc = -1;
  p.accent = world.accent;
  p.tilt = p.yaw = 0;

  if (world.mode === "deploy") {
    Object.assign(p, world.shot?.pose ?? { dist: 1.6, lat: 21, lon: 80, spin: 0 }, {
      accent: "accent",
    });
    // A held shot drifts very slightly (±0.4° over 8 s), so the map never looks frozen.
    if (world.shot && world.breathe)
      p.lon += 0.4 * Math.sin((performance.now() / 8000) * 2 * Math.PI);
    const nodes = NODES.filter((n) => n.sector === world.sector);
    const done = nodes.filter((n) => world.nodeStates[n.id] === "protected").length / nodes.length;
    NODES.forEach((n, i) => (p.nodeSafe[i] = world.nodeStates[n.id] === "protected" ? 1 : 0));
    INDIA_ARCS.forEach((k) => {
      p.arcLevel[k] = 0.25 + 0.75 * done;
      p.arcTint[k] = done;
    });
    p.nodes = 1;
    return p;
  }
  if (world.mode === "story" && world.scanActive && world.scan) {
    // Turn to the scanned site's server region; ScanArc draws its link to India.
    // On the homepage flight: close and low over the server's city, not the whole globe.
    const fly = world.journey >= 0;
    Object.assign(p, {
      dist: fly ? 1.4 : 3.1,
      lat: Math.max(-40, Math.min(50, world.scan.lat)),
      lon: world.scan.lon,
      spin: 0,
      tilt: fly ? 40 : 0,
      yaw: fly ? 30 : 0,
      accent: world.scan.ok ? "accent" : "warn",
    });
    p.arcLevel.fill(0.06);
    return p;
  }
  if (world.index && (world.mode === "story" || world.mode === "page")) {
    // The Readiness Index: face India; the sector bars stand up out of it.
    Object.assign(
      p,
      world.journey >= 0
        ? { ...flight(world.journey), spin: 0, accent: "accent" }
        : { dist: 2.25, lat: 20, lon: 80, spin: 0, accent: "accent" },
    );
    p.arcLevel.fill(0.05);
    return p;
  }
  if (world.mode === "page" && world.pagePose) {
    Object.assign(p, world.pagePose, { accent: "accent" });
    INDIA_ARCS.forEach((k) => (p.arcLevel[k] = 0.3));
    // Hovering an adapter row (on /platform) lights its socket.
    p.sockets = world.socket >= 0 ? 1 : 0;
    return p;
  }
  if (world.mode === "backdrop") {
    Object.assign(p, POSES[0]);
    return p;
  }

  const c = clamp(world.chapter, 0, 7.999);
  const i = Math.floor(c);
  const f = c - i;
  // The homepage flight sets the camera; chapters still choose what the arcs and nodes do.
  // Elsewhere: hold each pose for most of the chapter, then move with the motion easing.
  Object.assign(
    p,
    world.mode === "story" && world.journey >= 0
      ? flight(world.journey)
      : blend(POSES[i]!, POSES[Math.min(7, i + 1)]!, easeToken(clamp((f - 0.55) / 0.45))),
  );

  const tint = p.accent === "accent" ? 1 : 0;
  if (i === 0) {
    INDIA_ARCS.forEach((k) => (p.arcLevel[k] = 0.35));
    p.arcLevel[UPI] = 1;
    p.arcTint[UPI] = 1;
  }
  if (i === 1) {
    p.arcLevel[UPI] = 1;
    p.arcTint[UPI] = tint;
  }
  if (i === 2 || i === 3) {
    p.arcLevel[ABROAD] = 1;
    p.arcTint[ABROAD] = 1;
  }
  if (i === 4) p.sockets = 1;
  if (i === 5) {
    const w = clamp(f * 1.3);
    NODES.forEach((_, k) => (p.nodeSafe[k] = clamp((w * (NODES.length + 2) - k) / 2)));
    INDIA_ARCS.forEach((k, n) => {
      const on = clamp((w * (INDIA_ARCS.length + 1) - n) / 1.5);
      p.arcLevel[k] = 0.2 + 0.5 * on;
      p.arcTint[k] = on;
    });
    p.nodes = 1;
  }
  if (i === 6) {
    p.arcLevel[ABROAD] = 1;
    p.arcTint[ABROAD] = 1;
    p.sparkArc = ABROAD;
  }
  if (i === 7) {
    p.arcLevel.fill(0.45);
    p.arcTint.fill(1);
  }
  return p;
}
