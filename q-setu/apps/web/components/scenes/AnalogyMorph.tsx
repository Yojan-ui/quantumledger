"use client";

/**
 * The analogy as one object that changes as you scroll: a padlock of dots (today's locks) → a
 * glowing master key (a future quantum computer) → boxes being copied (harvest now) → the same
 * padlock snapped onto a lattice (the new lock). One point set; the GPU blends between the four
 * shapes by `progress.v` (0..3, written by the section's ScrollTrigger). Reduced motion: it cuts
 * between the shapes instead of morphing.
 */
import { PerspectiveCamera } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { palette } from "@/components/world/palette";
import { keyShape, latticeLock, padlock } from "./AnalogyModel";
import { rng } from "./pipeline/geometry";

const N = 1400;

/** Resample a shape to exactly N points (repeating with a little jitter where it has fewer). */
function resample(src: Float32Array, seed: number): Float32Array {
  const m = src.length / 3;
  const r = rng(seed);
  const out = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    const j = i % m;
    const k = i >= m ? 0.012 : 0;
    out[i * 3] = src[j * 3]! + (r() - 0.5) * k;
    out[i * 3 + 1] = src[j * 3 + 1]! + (r() - 0.5) * k;
    out[i * 3 + 2] = src[j * 3 + 2]! + (r() - 0.5) * k;
  }
  return out;
}

/** Three boxes travelling, each with a copy peeling off below it (harvest now, decrypt later). */
function copiedBoxes(): Float32Array {
  const r = rng(5);
  const pts: number[] = [];
  const box = (cx: number, cy: number, s: number) => {
    for (let k = 0; k < 120; k++) {
      // Points on the 12 edges of a cube.
      const e = Math.floor(r() * 12);
      const t = r() * 2 - 1;
      const a = e % 4;
      const sx = a & 1 ? 1 : -1;
      const sy = a & 2 ? 1 : -1;
      const p = e < 4 ? [t, sx, sy] : e < 8 ? [sx, t, sy] : [sx, sy, t];
      pts.push(cx + p[0]! * s, cy + p[1]! * s, p[2]! * s);
    }
  };
  [-0.7, 0, 0.7].forEach((x, i) => {
    box(x, 0.35, 0.18);
    box(x + 0.08, -0.35 - i * 0.05, 0.15);
  });
  return new Float32Array(pts);
}

const vertex = /* glsl */ `
  attribute vec3 aB; attribute vec3 aC; attribute vec3 aD; attribute float aSeed;
  uniform float uT; uniform float uPR; uniform float uTime;
  varying float vA;
  vec3 pick(float t) {
    vec3 p = position;
    float k1 = smoothstep(0.0, 1.0, clamp(t, 0.0, 1.0));
    float k2 = smoothstep(0.0, 1.0, clamp(t - 1.0, 0.0, 1.0));
    float k3 = smoothstep(0.0, 1.0, clamp(t - 2.0, 0.0, 1.0));
    p = mix(p, aB, k1);
    p = mix(p, aC, k2);
    p = mix(p, aD, k3);
    return p;
  }
  void main() {
    // Each particle runs a little ahead or behind the others, so the morph ripples.
    float t = uT + (aSeed - 0.5) * 0.25;
    vec3 p = pick(t);
    // Mid-morph the points lift into a loose cloud, then settle into the next shape.
    float mid = abs(fract(clamp(t, 0.0, 2.999)) - 0.5);
    p += normalize(p + vec3(0.001)) * (0.5 - mid) * 0.12 * step(0.02, fract(t));
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = uPR * (1.6 + aSeed) / -mv.z;
    vA = 0.55 + 0.45 * aSeed;
  }
`;
const fragment = /* glsl */ `
  uniform vec3 uColor; varying float vA;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    if (d > 0.5) discard;
    gl_FragColor = vec4(uColor, (1.0 - smoothstep(0.1, 0.5, d)) * vA);
  }
`;

export default function AnalogyMorph({
  progress,
  active,
  reduce,
}: {
  progress: { v: number };
  active: boolean;
  reduce: boolean;
}) {
  const c = useMemo(palette, []);
  const geo = useMemo(() => {
    const lock = padlock();
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(resample(lock, 1), 3));
    g.setAttribute("aB", new THREE.BufferAttribute(resample(keyShape(), 2), 3));
    g.setAttribute("aC", new THREE.BufferAttribute(resample(copiedBoxes(), 3), 3));
    g.setAttribute("aD", new THREE.BufferAttribute(resample(latticeLock(lock), 4), 3));
    const r = rng(9);
    g.setAttribute(
      "aSeed",
      new THREE.BufferAttribute(
        new Float32Array(N).map(() => r()),
        1,
      ),
    );
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 2);
    return g;
  }, []);
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: vertex,
        fragmentShader: fragment,
        uniforms: {
          uT: { value: 0 },
          uPR: { value: 1 },
          uTime: { value: 0 },
          uColor: { value: c.text.clone() },
        },
        transparent: true,
        depthWrite: false,
      }),
    [c],
  );
  // The role colour journey: text (today) → warn (the master key, the copies) → kem (the new lock).
  const stops = useMemo(() => [c.text, c.warn, c.warn, c.kem], [c]);
  const group = useRef<THREE.Group>(null);
  useFrame(({ gl }, dt) => {
    if (!active) return;
    const t = reduce ? Math.round(progress.v) : progress.v;
    const u = mat.uniforms;
    u.uT!.value += (t - u.uT!.value) * (reduce ? 1 : Math.min(1, dt * 6));
    u.uPR!.value = gl.getPixelRatio() * 12;
    const i = Math.min(2, Math.floor(u.uT!.value));
    (u.uColor!.value as THREE.Color).copy(stops[i]!).lerp(stops[i + 1]!, u.uT!.value - i);
    if (group.current && !reduce) group.current.rotation.y += dt * 0.15;
  });
  return (
    <>
      <PerspectiveCamera makeDefault position={[0, 0.1, 3.4]} fov={34} />
      <group ref={group}>
        <points geometry={geo} material={mat} frustumCulled={false} />
      </group>
    </>
  );
}
