"use client";

/**
 * A faint second particle layer for depth: soft round sprites spread through a large volume around
 * the scene, drifting very slowly, fading with distance. The quality ladder drops it first after DPR
 * (lib/client/gfx step 2); phones get half. Static under reduced motion.
 */
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { gfx } from "@/lib/client/gfx";
import { rng } from "./pipeline/geometry";

const vertex = /* glsl */ `
  uniform float uTime; uniform float uPR; attribute float aSeed;
  varying float vA;
  void main() {
    vec3 p = position + vec3(sin(uTime * 0.05 + aSeed * 6.3), cos(uTime * 0.04 + aSeed * 4.1), 0.0) * 0.3;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    float d = -mv.z;
    vA = clamp(1.0 - (d - 4.0) / 18.0, 0.0, 1.0) * (0.35 + 0.65 * aSeed);
    gl_PointSize = uPR * 7.0 / d;
  }
`;
const fragment = /* glsl */ `
  uniform vec3 uColor; uniform float uOpacity;
  varying float vA;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    if (d > 0.5) discard;
    gl_FragColor = vec4(uColor, (1.0 - smoothstep(0.0, 0.5, d)) * vA * uOpacity);
  }
`;

export function Dust({
  color,
  count = 1200,
  spread = 14,
}: {
  color: THREE.Color;
  count?: number;
  spread?: number;
}) {
  const n = typeof window !== "undefined" && window.innerWidth < 768 ? count >> 1 : count;
  const geo = useMemo(() => {
    const r = rng(99);
    const p = new Float32Array(n * 3);
    const s = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      p[i * 3] = (r() - 0.5) * spread * 2;
      p[i * 3 + 1] = (r() - 0.5) * spread;
      p[i * 3 + 2] = (r() - 0.5) * spread * 2;
      s[i] = r();
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(p, 3));
    g.setAttribute("aSeed", new THREE.BufferAttribute(s, 1));
    return g;
  }, [n, spread]);
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: vertex,
        fragmentShader: fragment,
        uniforms: {
          uTime: { value: 0 },
          uPR: { value: 1 },
          uColor: { value: color },
          uOpacity: { value: 0.22 },
        },
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    [color],
  );
  const pts = useRef<THREE.Points>(null);
  const born = useRef(typeof performance !== "undefined" ? performance.now() : 0);
  const reduce = useMemo(
    () => typeof window !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches,
    [],
  );
  useFrame(({ gl }, dt) => {
    if (pts.current) pts.current.visible = gfx.quality < 2;
    // Drifts for a few seconds after it appears, then settles (nothing loops behind the reading).
    const age = (performance.now() - born.current) / 1000;
    const drift = age < 8 ? 1 : Math.max(0, 1 - (age - 8) / 4);
    if (!reduce && drift > 0) mat.uniforms.uTime!.value += dt * drift;
    mat.uniforms.uPR!.value = gl.getPixelRatio() * 10;
  });
  return <points ref={pts} geometry={geo} material={mat} frustumCulled={false} renderOrder={-3} />;
}
