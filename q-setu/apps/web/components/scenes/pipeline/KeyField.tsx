"use client";

/**
 * Behind the hero: the visitor's own ML-KEM-768 public key, generated in this browser a moment ago
 * (components/world/keys.worker). Each of its 1,184 bytes is one dot: the byte sets the dot's size
 * and brightness, and high bytes take the --kem tint, so no two visitors see the same key.
 *
 * Trust gives mass. Until the server's signed handshake reply verifies (the zero-trust headline
 * bundle's ML-DSA-65 check, lib/client/trust), the key is a ghost: a loose cloud of jittering,
 * translucent points spread across the background, weightless. When that real check passes, every
 * byte flies (staggered) to its place in a dense lattice brick in front of the stage, a glass --kem
 * shell forms round it, and it takes its weight: a thunk, a fall to the floor, a small bounce, and
 * it settles. If the check fails it never gains mass: it stays a ghost and flickers --danger.
 *
 * Positions are written on the CPU each frame (1,184 points, no allocation), which also drives the
 * hover picking: the dot nearest the pointer (within 12 px) is reported to the DOM tooltip
 * (keyHover). One draw call for the dots. Static under reduced motion. The secret key never leaves
 * the worker; only the public key reaches here.
 */
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { glass } from "@/components/fx/materials";
import { world } from "@/components/world/store";
import { getTrust } from "@/lib/client/trust";
import { keyHover, setKeyHover } from "./keyHover";
import type { Look } from "./look";

export const KEY_BYTES = 1184;
const COLS = 48;
const ROWS = Math.ceil(KEY_BYTES / COLS);
const GAP = 0.56;
const Z = -9;
const Y0 = 1.4;
const PICK_PX = 12;
/** The brick: 14 × 10 × 9 lattice slots (1,260 ≥ 1,184), on the floor in front of the stage. */
const BX = 14;
const BY = 10;
const STEP = 0.085;
const FLOOR = -2.2;
const BRICK = new THREE.Vector3(-3.6, 0, 2.2);
const HALF = new THREE.Vector3((BX * STEP) / 2, (BY * STEP) / 2, (9 * STEP) / 2);
/** Where the brick forms in the air before it takes its weight. */
const AIR = 0.9;
const FLY_MS = 1100;
const STAGGER_MS = 700;
const CONDENSED_MS = FLY_MS + STAGGER_MS;

/** The dot under the pointer, for the hero's tooltip (components/trust/HeroTrust): see ./keyHover. */
export { keyHover };
const setHovered = setKeyHover;

const vertex = /* glsl */ `
  uniform float uPR; uniform float uHover; uniform float uMass;
  uniform vec3 uBase; uniform vec3 uKem; uniform vec3 uDanger; uniform float uFail;
  attribute float aByte; attribute float aIndex;
  varying vec3 vColor; varying float vA;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    float hot = 1.0 - step(0.5, abs(aIndex - uHover));
    vec3 col = mix(uBase, uKem, smoothstep(0.62, 1.0, aByte));
    col = mix(col, uKem, uMass * 0.7);
    col = mix(col, uDanger, uFail);
    vColor = mix(col, uKem, hot);
    // A ghost is translucent; with mass the dots are bright and tight.
    float ghostA = 0.2 + 0.4 * aByte * aByte;
    float massA = 0.55 + 0.45 * aByte;
    vA = mix(mix(ghostA, massA, uMass), 1.0, hot);
    float size = mix(4.2 + 7.5 * aByte, 1.6 + 2.0 * aByte, uMass);
    gl_PointSize = uPR * size * (1.0 + 1.4 * hot) / -mv.z;
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
  const { geo, field, brick, pos } = useMemo(() => {
    const field = new Float32Array(KEY_BYTES * 3);
    const brick = new Float32Array(KEY_BYTES * 3);
    const index = new Float32Array(KEY_BYTES);
    for (let i = 0; i < KEY_BYTES; i++) {
      const col = i % COLS;
      const row = Math.floor(i / COLS);
      // The ghost: an offset (triangular) lattice spread across the background.
      field[i * 3] = (col - (COLS - 1) / 2 + (row % 2) * 0.5) * GAP;
      field[i * 3 + 1] = Y0 + ((ROWS - 1) / 2 - row) * GAP * 0.866;
      field[i * 3 + 2] = Z;
      // Its slot in the brick (relative to the brick's centre).
      const bx = i % BX;
      const by = Math.floor(i / BX) % BY;
      const bz = Math.floor(i / (BX * BY));
      brick[i * 3] = (bx - (BX - 1) / 2) * STEP;
      brick[i * 3 + 1] = (by - (BY - 1) / 2) * STEP;
      brick[i * 3 + 2] = (bz - 4) * STEP;
      index[i] = i;
    }
    const pos = field.slice();
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setAttribute("aByte", new THREE.BufferAttribute(new Float32Array(KEY_BYTES), 1));
    g.setAttribute("aIndex", new THREE.BufferAttribute(index, 1));
    return { geo: g, field, brick, pos };
  }, []);
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: vertex,
        fragmentShader: fragment,
        uniforms: {
          uPR: { value: 10 },
          uHover: { value: -1 },
          uOpacity: { value: 0 },
          uMass: { value: 0 },
          uFail: { value: 0 },
          uBase: { value: new THREE.Color() },
          uKem: { value: new THREE.Color() },
          uDanger: { value: new THREE.Color() },
        },
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    [],
  );
  const shellMat = useMemo(() => glass(new THREE.Color(), { rim: 2.2, body: 0.08 }), []);
  const key = useRef<Uint8Array | null>(null);
  const pointer = useRef<{ x: number; y: number; rect: DOMRect } | null>(null);
  const v = useMemo(() => new THREE.Vector3(), []);
  const pts = useRef<THREE.Points>(null);
  const shell = useRef<THREE.Mesh>(null);
  const clock = useRef(0);
  // The brick's fall: height above the floor, velocity, when it landed.
  const fall = useRef({ y: AIR, v: 0, landed: 0, massAt: 0 });

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
    const reduce = L.reduce;
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
    (u.uDanger!.value as THREE.Color).copy(L.c.danger);
    (shellMat.uniforms.uColor!.value as THREE.Color).copy(L.c.kem);
    u.uPR!.value = gl.getPixelRatio() * 10;
    u.uOpacity!.value = reduce ? 1 : Math.min(1, u.uOpacity!.value + dt / 1.6);
    if (!reduce) clock.current += dt;
    const t = clock.current;
    const now = performance.now();

    // The real check (the signed headline bundle): passed, failed, or not yet.
    const verdict = getTrust().verified;
    const F = fall.current;
    if (verdict?.ok && !F.massAt) F.massAt = now;
    const failed = verdict && !verdict.ok;
    u.uFail!.value = failed ? (reduce || Math.sin(now / 38) > -0.2 ? 0.85 : 0.3) : 0;
    const since = F.massAt ? (reduce ? 1e9 : now - F.massAt) : -1;
    const condensed = since >= CONDENSED_MS;
    u.uMass!.value = since < 0 ? 0 : Math.min(1, since / CONDENSED_MS);

    // The brick, once condensed, takes its weight: it falls to the floor, bounces and settles.
    if (since < 0) {
      F.y = AIR;
      F.v = 0;
      F.landed = 0;
    } else if (reduce) F.y = 0;
    else if (condensed) {
      const h = Math.min(dt, 1 / 30);
      F.v += -9.8 * 0.6 * h;
      F.y += F.v * h;
      if (F.y < 0) {
        F.y = 0;
        if (F.v < -0.4) {
          if (!F.landed) F.landed = now;
          F.v = -F.v * 0.3;
        } else F.v = 0;
      }
    }
    const thunk = condensed && !reduce ? Math.exp(-(since - CONDENSED_MS) / 120) : 0;
    const land = F.landed && !reduce ? Math.exp(-(now - F.landed) / 110) : 0;
    const sq = 0.16 * thunk + 0.14 * land;
    const by = FLOOR + HALF.y + F.y;
    if (shell.current) {
      shell.current.visible = since >= CONDENSED_MS * 0.8;
      shell.current.position.set(BRICK.x, by, BRICK.z);
      shell.current.scale.set(1 + sq * 0.5, 1 - sq, 1 + sq * 0.5);
      shellMat.uniforms.uRim!.value = 2.2 + 3 * thunk;
    }

    // Every dot: a jittering ghost in the background, or flying (staggered) to its brick slot.
    for (let i = 0; i < KEY_BYTES; i++) {
      const k = i * 3;
      const jit = reduce ? 0 : 1;
      const gx = field[k]! + Math.sin(t * 1.7 + i * 1.31) * 0.07 * jit;
      const gy =
        field[k + 1]! +
        Math.cos(t * 0.11 + i * 0.21) * 0.05 +
        Math.sin(t * 2.3 + i * 0.7) * 0.05 * jit;
      const gz = field[k + 2]! + Math.sin(t * 0.15 + i * 0.37) * 0.14;
      if (since < 0) {
        pos[k] = gx;
        pos[k + 1] = gy;
        pos[k + 2] = gz;
        continue;
      }
      const delay = (((i * 7919) % 997) / 997) * STAGGER_MS;
      const f = Math.min(1, Math.max(0, (since - delay) / FLY_MS));
      const e = f * f * (3 - 2 * f);
      const tx = BRICK.x + brick[k]! * (1 + sq * 0.5);
      const ty = by + brick[k + 1]! * (1 - sq);
      const tz = BRICK.z + brick[k + 2]! * (1 + sq * 0.5);
      // An arc on the way (up and over), so the flight reads as each byte travelling.
      const arc = Math.sin(Math.PI * e) * 0.9;
      pos[k] = gx + (tx - gx) * e;
      pos[k + 1] = gy + (ty - gy) * e + arc;
      pos[k + 2] = gz + (tz - gz) * e;
    }
    geo.attributes.position!.needsUpdate = true;

    const p = pointer.current;
    if (!p) {
      u.uHover!.value = -1;
      setHovered(null);
      return;
    }
    let best = -1;
    let bestD = PICK_PX * PICK_PX;
    let bx = 0;
    let byPx = 0;
    const mw = pts.current!.matrixWorld;
    for (let i = 0; i < KEY_BYTES; i++) {
      v.set(pos[i * 3]!, pos[i * 3 + 1]!, pos[i * 3 + 2]!)
        .applyMatrix4(mw)
        .project(camera);
      const x = p.rect.left + ((v.x + 1) / 2) * p.rect.width;
      const y = p.rect.top + ((1 - v.y) / 2) * p.rect.height;
      const d = (x - p.x) ** 2 + (y - p.y) ** 2;
      if (d < bestD) {
        bestD = d;
        best = i;
        bx = x;
        byPx = y;
      }
    }
    u.uHover!.value = best;
    setHovered(best < 0 ? null : { i: best, byte: key.current[best]!, x: bx, y: byPx });
  });

  return (
    <>
      <points ref={pts} geometry={geo} material={mat} frustumCulled={false} renderOrder={-4} />
      <mesh ref={shell} material={shellMat} visible={false}>
        <boxGeometry args={[HALF.x * 2 + 0.06, HALF.y * 2 + 0.06, HALF.z * 2 + 0.06]} />
      </mesh>
    </>
  );
}
