/**
 * India outline (Natural Earth 1:10m, India point of view, public domain) projected to scene
 * units: equirectangular with a cos(latitude) correction around the country's centre.
 */
import outline from "@/data/india-outline.json";

const LON0 = 82.7;
const LAT0 = 22;
const K = 0.165;
const COS = Math.cos((LAT0 * Math.PI) / 180);

export function project(lon: number, lat: number): [number, number] {
  return [(lon - LON0) * COS * K, (lat - LAT0) * K];
}

export const RINGS: [number, number][][] = (outline.rings as number[][][]).map((r) =>
  r.map(([lon, lat]) => project(lon!, lat!)),
);
export const MAINLAND = RINGS[0]!;

function inRing(x: number, y: number, ring: [number, number][]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]!;
    const [xj, yj] = ring[j]!;
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

export const insideIndia = (x: number, y: number) => RINGS.some((r) => inRing(x, y, r));

const xs = MAINLAND.map((p) => p[0]);
const ys = MAINLAND.map((p) => p[1]);
export const BOUNDS = {
  minX: Math.min(...xs),
  maxX: Math.max(...xs),
  minY: Math.min(...ys),
  maxY: Math.max(...ys),
};

/** Deterministic pseudo-random sequence, so SSR, reduced-motion frames and every reload match. */
export function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** `n` points spread inside India: 70% on a jittered grid inside the country, 30% along the coastline and borders. */
export function samplePoints(n: number, seed = 11): [number, number][] {
  const rand = mulberry32(seed);
  const out: [number, number][] = [];
  const edge = Math.floor(n * 0.3);
  const perim: { a: [number, number]; b: [number, number]; len: number }[] = [];
  let total = 0;
  for (const ring of RINGS) {
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i]!;
      const b = ring[(i + 1) % ring.length]!;
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      perim.push({ a, b, len });
      total += len;
    }
  }
  for (let i = 0; i < edge; i++) {
    let d = rand() * total;
    const seg = perim.find((s) => (d -= s.len) <= 0) ?? perim[0]!;
    const t = rand();
    out.push([seg.a[0] + (seg.b[0] - seg.a[0]) * t, seg.a[1] + (seg.b[1] - seg.a[1]) * t]);
  }
  while (out.length < n) {
    const x = BOUNDS.minX + rand() * (BOUNDS.maxX - BOUNDS.minX);
    const y = BOUNDS.minY + rand() * (BOUNDS.maxY - BOUNDS.minY);
    if (insideIndia(x, y)) out.push([x, y]);
  }
  return out;
}

export const MAP_CREDIT =
  "Map outline: Natural Earth (public domain), India point of view, simplified.";
