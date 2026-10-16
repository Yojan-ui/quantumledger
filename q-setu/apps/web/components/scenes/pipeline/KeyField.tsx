"use client";

/**
 * Behind the hero: the visitor's own ML-KEM-768 public key, generated in this browser a moment ago
 * (components/world/keys.worker), as a field of dots. Each of its 1,184 bytes is one dot on an
 * offset lattice: the byte sets the dot's size and brightness, and high bytes take the --kem tint,
 * so no two visitors see the same field. One draw call (a single Points, the Dust layer's sprite
 * style); it drifts slowly, and is static under reduced motion.
 *
 * Hover picking runs on the CPU, in screen space: while the pointer is over the hero, the 1,184
 * positions are projected once a frame and the nearest dot within 12 px is reported to the DOM
 * tooltip (keyHover). The secret key never leaves the worker; only the public key reaches here.
 */
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { world } from "@/components/world/store";
import type { Look } from "./look";

export const KEY_BYTES = 1184;
const COLS = 48;
const ROWS = Math.ceil(KEY_BYTES / COLS);
const GAP = 0.56;
const Z = -9;
const Y0 = 1.4;
const PICK_PX = 12;

/** The dot under the pointer, for the hero's tooltip (components/trust/HeroTrust). */
type Hover = { i: number; byte: number; x: number; y: number } | null;
let hovered: Hover = null;
const hoverListeners = new Set<() => void>();
export const keyHover = {
  get: () => hovered,
  subscribe(fn: () => void) {
    hoverListeners.add(fn);
    return () => void hoverListeners.delete(fn);
  },
};
function setHovered(h: Hover) {
  if (h?.i === hovered?.i && h?.x === hovered?.x && h?.y === hovered?.y) return;
  hovered = h;
  hoverListeners.forEach((fn) => fn());
}

// The drift, written once for the shader and once for the CPU picker (they must agree).
const DRIFT = /* glsl */ `
  vec3 drift(vec3 p, float i, float t) {
    return p + vec3(0.0, cos(t * 0.11 + i * 0.21) * 0.05, sin(t * 0.15 + i * 0.37) * 0.14);
  }
`;
const driftCpu = (v: THREE.Vector3, i: number, t: number) =>
  v.set(
    v.x,
    v.y + Math.cos(t * 0.11 + i * 0.21) * 0.05,
    v.z + Math.sin(t * 0.15 + i * 0.37) * 0.14,
  );

const vertex = /* glsl */ `
  uniform float uTime; uniform float uPR; uniform float uHover;
  uniform vec3 uBase; uniform vec3 uKem;
  attribute float aByte; attribute float aIndex;
  varying vec3 vColor; varying float vA;
  ${DRIFT}
  void main() {
    vec3 p = drift(position, aIndex, uTime);
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    float hot = 1.0 - step(0.5, abs(aIndex - uHover));
    vColor = mix(mix(uBase, uKem, smoothstep(0.62, 1.0, aByte)), uKem, hot);
    vA = mix(0.24 + 0.5 * aByte * aByte, 1.0, hot);
    gl_PointSize = uPR * (4.2 + 7.5 * aByte) * (1.0 + 1.4 * hot) / -mv.z;
  }
`;
const fragment = /* glsl */ `
  uniform float uOpacity;
  varying vec3 vColor; varying float vA;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    if (d > 0.5) discard;
    gl_FragColor = vec4(vColor, (1.0 - smoothstep(0.15, 0.5, d)) * vA * uOpacity);
  }
`;

export function KeyField({ look }: { look: React.RefObject<Look> }) {
  const { geo, base } = useMemo(() => {
    const base = new Float32Array(KEY_BYTES * 3);
    const index = new Float32Array(KEY_BYTES);
    for (let i = 0; i < KEY_BYTES; i++) {
      const col = i % COLS;
      const row = Math.floor(i / COLS);
      // An offset (triangular) lattice: odd rows shift half a step.
      base[i * 3] = (col - (COLS - 1) / 2 + (row % 2) * 0.5) * GAP;
      base[i * 3 + 1] = Y0 + ((ROWS - 1) / 2 - row) * GAP * 0.866;
      base[i * 3 + 2] = Z;
      index[i] = i;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(base, 3));
    g.setAttribute("aByte", new THREE.BufferAttribute(new Float32Array(KEY_BYTES), 1));
    g.setAttribute("aIndex", new THREE.BufferAttribute(index, 1));
    return { geo: g, base };
  }, []);
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: vertex,
        fragmentShader: fragment,
        uniforms: {
          uTime: { value: 0 },
          uPR: { value: 10 },
          uHover: { value: -1 },
          uOpacity: { value: 0 },
          uBase: { value: new THREE.Color() },
          uKem: { value: new THREE.Color() },
        },
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    [],
  );
  const key = useRef<Uint8Array | null>(null);
  const pointer = useRef<{ x: number; y: number; rect: DOMRect } | null>(null);
  const v = useMemo(() => new THREE.Vector3(), []);
  const pts = useRef<THREE.Points>(null);

  // The pointer, while it is over the hero's stage (not over its text or controls).
  useEffect(() => {
    const move = (e: PointerEvent) => {
      const stage = (e.target as Element | null)?.closest?.("#top [data-hud-stage]");
      pointer.current = stage
        ? { x: e.clientX, y: e.clientY, rect: stage.getBoundingClientRect() }
        : null;
    };
    const leave = () => (pointer.current = null);
    window.addEventListener("pointermove", move, { passive: true });
    document.addEventListener("pointerleave", leave);
    window.addEventListener("scroll", leave, { passive: true });
    return () => {
      window.removeEventListener("pointermove", move);
      document.removeEventListener("pointerleave", leave);
      window.removeEventListener("scroll", leave);
      setHovered(null);
    };
  }, []);

  useFrame(({ gl, camera }, dt) => {
    const L = look.current;
    if (!L?.active) return;
    const u = mat.uniforms;
    // The key arrives once, from the worker: write its bytes into the dots.
    if (!key.current && world.key?.length === KEY_BYTES) {
      key.current = world.key;
      const a = geo.attributes.aByte!.array as Float32Array;
      for (let i = 0; i < KEY_BYTES; i++) a[i] = key.current[i]! / 255;
      geo.attributes.aByte!.needsUpdate = true;
    }
    if (!key.current) return;
    (u.uBase!.value as THREE.Color).copy(L.c.text3);
    (u.uKem!.value as THREE.Color).copy(L.c.kem);
    u.uPR!.value = gl.getPixelRatio() * 10;
    u.uOpacity!.value = L.reduce ? 1 : Math.min(1, u.uOpacity!.value + dt / 1.6);
    if (!L.reduce) u.uTime!.value += dt;

    const p = pointer.current;
    if (!p) {
      u.uHover!.value = -1;
      setHovered(null);
      return;
    }
    let best = -1;
    let bestD = PICK_PX * PICK_PX;
    let bx = 0;
    let by = 0;
    const t = u.uTime!.value as number;
    const mw = pts.current!.matrixWorld;
    for (let i = 0; i < KEY_BYTES; i++) {
      driftCpu(v.set(base[i * 3]!, base[i * 3 + 1]!, base[i * 3 + 2]!), i, t)
        .applyMatrix4(mw)
        .project(camera);
      const x = p.rect.left + ((v.x + 1) / 2) * p.rect.width;
      const y = p.rect.top + ((1 - v.y) / 2) * p.rect.height;
      const d = (x - p.x) ** 2 + (y - p.y) ** 2;
      if (d < bestD) {
        bestD = d;
        best = i;
        bx = x;
        by = y;
      }
    }
    u.uHover!.value = best;
    setHovered(best < 0 ? null : { i: best, byte: key.current[best]!, x: bx, y: by });
  });

  return <points ref={pts} geometry={geo} material={mat} frustumCulled={false} renderOrder={-4} />;
}
