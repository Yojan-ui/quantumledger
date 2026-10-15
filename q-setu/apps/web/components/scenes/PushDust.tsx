"use client";

/**
 * A cloud of dots around a centre that a pulse pushes outward: the shock of two things fusing. The
 * dots drift slowly on a curl-noise field around their homes; `since()` (seconds since the pulse, or
 * < 0 for none) drives the push: out fast to a peak at 0.18 s, then back over about a second. Nearer
 * dots are pushed further (1/r falloff), so it reads as a wave from the point of contact. A pure
 * function of `since`, so a scroll-scrubbed scene can drive it too. Still under reduced motion.
 */
import { useFrame } from "@react-three/fiber";
import { useMemo } from "react";
import * as THREE from "three";
import { curl } from "@/lib/motion";

/** Out to a peak at τ, then back: t·e^(1 − t/τ)/τ (peak 1 at t = τ). */
export const shove = (t: number, tau = 0.18) => (t <= 0 ? 0 : (t / tau) * Math.exp(1 - t / tau));

export function PushDust({
  center = [0, 0, 0],
  count = 140,
  inner = 0.55,
  outer = 1.6,
  color,
  since,
  reduce = false,
  strength = 0.9,
  opacity = 0.5,
}: {
  center?: [number, number, number];
  count?: number;
  inner?: number;
  outer?: number;
  color: THREE.Color;
  /** Seconds since the pulse, < 0 for none. */
  since: () => number;
  reduce?: boolean;
  strength?: number;
  opacity?: number;
}) {
  const { g, m, home } = useMemo(() => {
    let s = 4242;
    const r = () => (s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32;
    const h = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const u = r() * 2 - 1;
      const a = r() * Math.PI * 2;
      const q = Math.sqrt(1 - u * u);
      const rad = inner + (outer - inner) * Math.sqrt(r());
      h.set([q * Math.cos(a) * rad, u * rad * 0.7, q * Math.sin(a) * rad], i * 3);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(h.slice(), 3));
    // Round dots, ~2–3 px, like the site's other particles (capped so a close camera never blows
    // them up into squares).
    const mat = new THREE.ShaderMaterial({
      vertexShader: /* glsl */ `
        uniform float uPR;
        void main() {
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * mv;
          gl_PointSize = clamp(10.0 / -mv.z, 1.5, 4.0) * uPR;
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uColor; uniform float uOpacity;
        void main() {
          float d = length(gl_PointCoord - 0.5);
          if (d > 0.5) discard;
          gl_FragColor = vec4(uColor, (1.0 - smoothstep(0.25, 0.5, d)) * uOpacity);
        }`,
      uniforms: {
        uPR: { value: 1 },
        uColor: { value: new THREE.Color() },
        uOpacity: { value: opacity },
      },
      transparent: true,
      depthWrite: false,
    });
    return { g: geo, m: mat, home: h };
  }, [count, inner, outer, opacity]);
  const v = useMemo(() => new THREE.Vector3(), []);

  useFrame(({ clock, gl }) => {
    m.uniforms.uColor!.value.copy(color);
    m.uniforms.uPR!.value = gl.getPixelRatio();
    const pos = g.attributes.position!.array as Float32Array;
    const t = since();
    const k = reduce ? 0 : shove(t) * strength;
    const time = reduce ? 0 : clock.elapsedTime * 0.15;
    for (let i = 0; i < count; i++) {
      const x = home[i * 3]!;
      const y = home[i * 3 + 1]!;
      const z = home[i * 3 + 2]!;
      const r = Math.sqrt(x * x + y * y + z * z) || 1;
      const push = 1 + (k * inner) / r;
      if (!reduce) curl(x * 0.8, y * 0.8, z * 0.8 + time, v).multiplyScalar(0.05);
      else v.set(0, 0, 0);
      pos[i * 3] = x * push + v.x;
      pos[i * 3 + 1] = y * push + v.y;
      pos[i * 3 + 2] = z * push + v.z;
    }
    g.attributes.position!.needsUpdate = true;
  });

  return <points geometry={g} material={m} position={center} frustumCulled={false} />;
}
