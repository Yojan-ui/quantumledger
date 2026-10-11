/**
 * Globe land dots, sampled from the land-mask texture (Natural Earth, India point of view).
 */

export interface Dots {
  positions: Float32Array;
  india: Float32Array;
  seed: Float32Array;
}

/** Fibonacci-sphere points kept where the mask says land. R = land, G = India. */
export function sampleLand(
  mask: Uint8ClampedArray,
  w: number,
  h: number,
  candidates: number,
): Dots {
  const pos: number[] = [];
  const ind: number[] = [];
  const seed: number[] = [];
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < candidates; i++) {
    const y = 1 - (i / (candidates - 1)) * 2;
    const r = Math.sqrt(1 - y * y);
    const th = golden * i;
    const x = Math.cos(th) * r;
    const z = Math.sin(th) * r;
    const lat = Math.asin(y);
    const lon = Math.atan2(-z, x);
    const u = Math.floor(((lon / Math.PI + 1) / 2) * w) % w;
    const v = Math.min(h - 1, Math.floor((0.5 - lat / Math.PI) * h));
    const k = (v * w + u) * 4;
    if (mask[k]! > 127) {
      pos.push(x, y, z);
      ind.push(mask[k + 1]! > 127 ? 1 : 0);
      seed.push((Math.sin(i * 12.9898) * 43758.5453) % 1);
    }
  }
  return {
    positions: new Float32Array(pos),
    india: new Float32Array(ind),
    seed: new Float32Array(seed.map((s) => Math.abs(s))),
  };
}
