/** Geography for the globe: lat/lon → sphere, great-circle arcs, cities, and the routes packets take. */
import * as THREE from "three";
import { CITIES, CITY_LABEL, ROUTES, routeIndex, type City } from "@/data/routes";
import { SITES } from "@/data/sites";

export const GLOBE_RADIUS = 1;

export function toVec3(lat: number, lon: number, r = GLOBE_RADIUS): THREE.Vector3 {
  const la = (lat * Math.PI) / 180;
  const lo = (lon * Math.PI) / 180;
  return new THREE.Vector3(
    r * Math.cos(la) * Math.cos(lo),
    r * Math.sin(la),
    -r * Math.cos(la) * Math.sin(lo),
  );
}

/** Globe rotation (x, y) that brings (lat, lon) to face the camera on +Z. */
export const facing = (lat: number, lon: number) => ({
  x: (lat * Math.PI) / 180,
  y: -Math.PI / 2 - (lon * Math.PI) / 180,
});

/** Points along the great circle from a to b, lifted into an arc whose height grows with distance. */
export function arcPoints(a: THREE.Vector3, b: THREE.Vector3, segments = 64): THREE.Vector3[] {
  const angle = a.angleTo(b);
  // Long-haul arcs stay low, so they read as routes rather than rings around the globe.
  const lift = Math.min(0.2, 0.05 + angle * 0.14);
  const out: THREE.Vector3[] = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const s = Math.sin(angle);
    const p =
      s < 1e-6
        ? a.clone()
        : a
            .clone()
            .multiplyScalar(Math.sin((1 - t) * angle) / s)
            .add(b.clone().multiplyScalar(Math.sin(t * angle) / s));
    out.push(p.normalize().multiplyScalar(GLOBE_RADIUS * (1.002 + lift * Math.sin(Math.PI * t))));
  }
  return out;
}

export { CITIES, CITY_LABEL, SECTOR_PATHS, type City } from "@/data/routes";

export interface ArcDef {
  from: [number, number];
  to: [number, number];
  /** "india" arcs carry sector traffic; "world" arcs carry it abroad. */
  kind: "india" | "world";
  key: string;
  a: City;
  b: City;
}

/** Exactly 12 arcs, one per live-mesh route (same order, so a route index is an arc index). */
export const ARCS: ArcDef[] = ROUTES.map((r) => ({
  from: [...CITIES[r.from]] as [number, number],
  to: [...CITIES[r.to]] as [number, number],
  kind: r.kind,
  key: r.key,
  a: r.from,
  b: r.to,
}));
export const INDIA_ARCS = ARCS.map((a, i) => (a.kind === "india" ? i : -1)).filter((i) => i >= 0);
export const WORLD_ARCS = ARCS.map((a, i) => (a.kind === "world" ? i : -1)).filter((i) => i >= 0);

export const arcIndex = (a: City, b: City): number => routeIndex(a, b);

/** Every city a route touches, with its position: the hoverable markers on the globe. */
export const ROUTE_CITIES = [...new Set(ROUTES.flatMap((r) => [r.from, r.to]))].map((c) => ({
  id: c,
  label: CITY_LABEL[c],
  pos: toVec3(CITIES[c][0], CITIES[c][1], GLOBE_RADIUS * 1.004),
}));

export const NODES = SITES.map((s) => ({ ...s, pos: toVec3(s.lat, s.lon, GLOBE_RADIUS * 1.004) }));

/** The five adapter "sockets", pinned to cities on the globe (Shield, Web, SDK, Edge, Vault). */
export const SOCKETS = (["mumbai", "delhi", "bengaluru", "kolkata", "chennai"] as City[]).map((c) =>
  toVec3(CITIES[c][0], CITIES[c][1], GLOBE_RADIUS * 1.004),
);
export const INDIA_CENTER = { lat: 22, lon: 80 };
