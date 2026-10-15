"use client";

/**
 * The near layer of dots: a sparse, faint shell of points just above the globe (1.10–1.45 radii). The
 * globe turns in place, so a dot further out travels further on screen for the same turn: in every
 * chapter move and every drag the shell slides over the land and ocean dots, and the three layers read
 * as near, mid and far. The shell also trails the globe's turn on a soft spring (follow-through), so a
 * fling or a chapter swing ends with the near layer catching up a moment later. Static under reduced
 * motion; halved by the quality ladder.
 */
import { useFrame, useThree } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { gfx } from "@/lib/client/gfx";
import { Spring } from "@/lib/motion";
import { palette } from "./palette";
import { world } from "./store";

const N = 1400;

const vertex = /* glsl */ `
  attribute float aSeed;
  uniform float uPR; uniform float uIn;
  varying float vA;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    vA = (0.45 + 0.55 * aSeed) * uIn;
    gl_PointSize = (1.1 + aSeed * 0.9) * uPR;
  }
`;
const fragment = /* glsl */ `
  uniform vec3 uColor;
  varying float vA;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    if (d > 0.5) discard;
    gl_FragColor = vec4(uColor, (1.0 - smoothstep(0.2, 0.5, d)) * vA * 0.14);
  }
`;

export function Shell() {
  const pr = useThree((s) => s.viewport.dpr);
  const c = useMemo(palette, []);
  const { g, m } = useMemo(() => {
    let s = 9001;
    const r = () => (s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32;
    const pos = new Float32Array(N * 3);
    const seed = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      const u = r() * 2 - 1;
      const a = r() * Math.PI * 2;
      const rad = 1.1 + r() ** 1.6 * 0.35;
      const q = Math.sqrt(1 - u * u);
      pos.set([q * Math.cos(a) * rad, u * rad, q * Math.sin(a) * rad], i * 3);
      seed[i] = r();
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    geo.setAttribute("aSeed", new THREE.BufferAttribute(seed, 1));
    const mat = new THREE.ShaderMaterial({
      vertexShader: vertex,
      fragmentShader: fragment,
      uniforms: { uPR: { value: pr }, uColor: { value: c.text }, uIn: { value: 0 } },
      transparent: true,
      depthWrite: false,
    });
    return { g: geo, m: mat };
  }, [pr, c]);
  const ref = useRef<THREE.Points>(null);
  // The lag: a spring that follows the parent globe's yaw and pitch; the shell is turned back by the
  // difference, so it trails the turn and catches up.
  const follow = useRef({
    y: new Spring(0, { mass: 1, stiffness: 30, damping: 9 }),
    x: new Spring(0, { mass: 1, stiffness: 30, damping: 9 }),
    init: false,
  });
  useFrame((_, dt) => {
    const p = ref.current;
    if (!p?.parent) return;
    const u = m.uniforms;
    u.uIn!.value += ((world.focusRect ? 1 : 0) - u.uIn!.value) * Math.min(1, dt * 1.5);
    g.setDrawRange(0, gfx.quality >= 2 ? N >> 1 : N);
    const f = follow.current;
    const ry = p.parent.rotation.y;
    const rx = p.parent.rotation.x;
    if (!f.init || !world.breathe) {
      f.y.set(ry);
      f.x.set(rx);
      f.init = true;
    }
    // Unwrap the yaw so a full turn doesn't make the spring chase the long way round.
    f.y.target = ry;
    f.y.x += Math.round((ry - f.y.x) / (Math.PI * 2)) * Math.PI * 2;
    f.x.target = rx;
    f.y.step(dt);
    f.x.step(dt);
    const clampLag = (v: number) => Math.max(-0.18, Math.min(0.18, v));
    p.rotation.set(clampLag(f.x.x - rx), clampLag(f.y.x - ry), 0);
  });
  return <points ref={ref} geometry={g} material={m} renderOrder={5} frustumCulled={false} />;
}
