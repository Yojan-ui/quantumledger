"use client";

/**
 * The material the Shield scene is made of: dots, like the globe and the diagnostics swarm. A
 * DotCloud is a set of points with home positions that can assemble from a scatter (the globe's dots
 * re-forming into the scene after the dive) and scatter again (flying back out). Assembly runs as a
 * wave from a centre: each dot's spring is released when the front reaches it (60 ms beats), and it
 * overshoots its home a little and settles. `form` and `leave` are seconds since each began (form
 * < 0: still scattered; leave < 0: not leaving). Under reduced motion it is simply there.
 *
 * Also the point sets the scene is built from: a box's surface, a plane sampled from an image (the
 * bundled bank's real homepage), and a device's outline.
 */
import { useFrame } from "@react-three/fiber";
import { useMemo } from "react";
import * as THREE from "three";
import { SPRING } from "@/components/scenes/glsl";

const vertex = /* glsl */ `
  attribute vec3 aScatter; attribute float aDelay; attribute float aBright;
  uniform float uForm; uniform float uLeave; uniform float uSize; uniform float uPR;
  uniform vec3 uOffset;
  varying float vA;
  ${SPRING}
  void main() {
    float k = uForm < 0.0 ? 0.0 : springIn(uForm - aDelay);
    float out_ = uLeave < 0.0 ? 0.0 : clamp((uLeave - aDelay * 0.5) / 0.55, 0.0, 1.0);
    out_ = out_ * out_ * (3.0 - 2.0 * out_);
    vec3 p = mix(position + aScatter, position, k) + aScatter * out_ * 1.4 + uOffset;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    vA = aBright * clamp(k * 1.3, 0.0, 1.0) * (1.0 - out_);
    gl_PointSize = clamp(uSize / -mv.z, 1.0, 5.0) * uPR;
  }
`;
const fragment = /* glsl */ `
  uniform vec3 uColor; uniform float uOpacity;
  varying float vA;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    if (d > 0.5 || vA < 0.01) discard;
    gl_FragColor = vec4(uColor, (1.0 - smoothstep(0.2, 0.5, d)) * vA * uOpacity);
  }
`;

/** A deterministic random source. */
export function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => (s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32;
}

export interface Cloud {
  positions: Float32Array;
  bright?: Float32Array;
}

/** Dots over the six faces of a box (w × h × d), `per` dots per unit². */
export function boxDots(w: number, h: number, d: number, per = 60, seed = 3): Cloud {
  const r = rng(seed);
  const faces: [number, number, (u: number, v: number) => number[]][] = [
    [w * h, 1, (u, v) => [(u - 0.5) * w, (v - 0.5) * h, d / 2]],
    [w * h, 0.55, (u, v) => [(u - 0.5) * w, (v - 0.5) * h, -d / 2]],
    [d * h, 0.75, (u, v) => [w / 2, (v - 0.5) * h, (u - 0.5) * d]],
    [d * h, 0.75, (u, v) => [-w / 2, (v - 0.5) * h, (u - 0.5) * d]],
    [w * d, 0.9, (u, v) => [(u - 0.5) * w, h / 2, (v - 0.5) * d]],
    [w * d, 0.4, (u, v) => [(u - 0.5) * w, -h / 2, (v - 0.5) * d]],
  ];
  const pos: number[] = [];
  const bright: number[] = [];
  for (const [area, b, at] of faces) {
    const n = Math.round(area * per);
    for (let i = 0; i < n; i++) {
      pos.push(...at(r(), r()));
      bright.push(b * (0.6 + 0.4 * r()));
    }
  }
  return { positions: new Float32Array(pos), bright: new Float32Array(bright) };
}

/**
 * A plane of dots sampled from an image (w × h scene units, `cols` × `rows` samples): darker pixels
 * (text, buttons) give brighter dots, so the page reads on a dark stage.
 */
export function imageDots(
  img: HTMLImageElement,
  w: number,
  h: number,
  cols = 112,
  rows = 66,
): Cloud {
  const c = document.createElement("canvas");
  c.width = cols;
  c.height = rows;
  const g = c.getContext("2d", { willReadFrequently: true })!;
  g.drawImage(img, 0, 0, cols, rows);
  const data = g.getImageData(0, 0, cols, rows).data;
  const pos: number[] = [];
  const bright: number[] = [];
  for (let y = 0; y < rows; y++)
    for (let x = 0; x < cols; x++) {
      const k = (y * cols + x) * 4;
      const lum = (0.299 * data[k]! + 0.587 * data[k + 1]! + 0.114 * data[k + 2]!) / 255;
      const ink = 1 - lum;
      if (ink < 0.04 && (x + y) % 3) continue; // the page's white: a sparse field, not a slab
      pos.push((x / (cols - 1) - 0.5) * w, (0.5 - y / (rows - 1)) * h, 0);
      bright.push(0.18 + 0.82 * Math.min(1, ink * 1.6));
    }
  return { positions: new Float32Array(pos), bright: new Float32Array(bright) };
}

/** The outline of a rounded rectangle (a device's body or screen), as dots. */
export function outlineDots(w: number, h: number, n: number, z = 0): Cloud {
  const pos: number[] = [];
  const per = (2 * (w + h)) / n;
  for (let s = 0; s < 2 * (w + h); s += per) {
    let x: number, y: number;
    if (s < w) [x, y] = [s - w / 2, h / 2];
    else if (s < w + h) [x, y] = [w / 2, h / 2 - (s - w)];
    else if (s < 2 * w + h) [x, y] = [w / 2 - (s - w - h), -h / 2];
    else [x, y] = [-w / 2, -h / 2 + (s - 2 * w - h)];
    pos.push(x, y, z);
  }
  return { positions: new Float32Array(pos) };
}

/** Merges clouds, each moved by an offset. */
export function merge(parts: [Cloud, [number, number, number]][]): Cloud {
  const pos: number[] = [];
  const bright: number[] = [];
  for (const [c, [ox, oy, oz]] of parts) {
    for (let i = 0; i < c.positions.length; i += 3)
      pos.push(c.positions[i]! + ox, c.positions[i + 1]! + oy, c.positions[i + 2]! + oz);
    for (let i = 0; i < c.positions.length / 3; i++) bright.push(c.bright?.[i] ?? 1);
  }
  return { positions: new Float32Array(pos), bright: new Float32Array(bright) };
}

/**
 * A cloud of dots that assembles from a scatter as a wave from `origin` and can scatter again.
 * `clock()` returns { form, leave } in seconds (see the file comment).
 */
export function DotCloud({
  cloud,
  color,
  opacity = 1,
  size = 26,
  origin = [0, 0, 0],
  spread = 3,
  clock,
  position,
  offset,
}: {
  cloud: Cloud;
  color: THREE.Color;
  opacity?: number;
  size?: number;
  origin?: [number, number, number];
  spread?: number;
  clock: () => { form: number; leave: number };
  position?: [number, number, number];
  /** Per-frame offset (a jolt, a slide), in the cloud's frame. */
  offset?: () => THREE.Vector3 | null;
}) {
  const { g, m } = useMemo(() => {
    const n = cloud.positions.length / 3;
    const r = rng(n * 7 + 11);
    const scatter = new Float32Array(n * 3);
    const delay = new Float32Array(n);
    const [ox, oy, oz] = origin;
    for (let i = 0; i < n; i++) {
      const u = r() * 2 - 1;
      const a = r() * Math.PI * 2;
      const q = Math.sqrt(1 - u * u);
      const s = spread * (0.4 + r());
      scatter.set([q * Math.cos(a) * s, u * s, q * Math.sin(a) * s], i * 3);
      const x = cloud.positions[i * 3]! - ox;
      const y = cloud.positions[i * 3 + 1]! - oy;
      const z = cloud.positions[i * 3 + 2]! - oz;
      // The wave front at 5 units/s, in 60 ms beats.
      delay[i] = Math.round(Math.sqrt(x * x + y * y + z * z) / 5 / 0.06) * 0.06;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(cloud.positions, 3));
    geo.setAttribute("aScatter", new THREE.BufferAttribute(scatter, 3));
    geo.setAttribute("aDelay", new THREE.BufferAttribute(delay, 1));
    geo.setAttribute(
      "aBright",
      new THREE.BufferAttribute(cloud.bright ?? new Float32Array(n).fill(1), 1),
    );
    const mat = new THREE.ShaderMaterial({
      vertexShader: vertex,
      fragmentShader: fragment,
      uniforms: {
        uForm: { value: -1 },
        uLeave: { value: -1 },
        uSize: { value: size },
        uPR: { value: 1 },
        uColor: { value: new THREE.Color() },
        uOpacity: { value: opacity },
        uOffset: { value: new THREE.Vector3() },
      },
      transparent: true,
      depthWrite: false,
    });
    return { g: geo, m: mat };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cloud]);
  useFrame(({ gl }) => {
    const u = m.uniforms;
    const k = clock();
    u.uForm!.value = k.form;
    u.uLeave!.value = k.leave;
    u.uPR!.value = gl.getPixelRatio();
    u.uOpacity!.value = opacity;
    (u.uColor!.value as THREE.Color).copy(color);
    const o = offset?.();
    (u.uOffset!.value as THREE.Vector3).set(o?.x ?? 0, o?.y ?? 0, o?.z ?? 0);
  });
  return <points geometry={g} material={m} position={position} frustumCulled={false} />;
}
