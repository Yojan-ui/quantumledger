"use client";

/**
 * The Lab's attack map. The protected site is a glowing --kem core; Shield is the --ok ring around
 * it. Every recorded incident is a stream of particles flying in from the edge, one burst per step
 * Shield saw, coloured by its pattern. Steps Shield refused hit the ring and break apart; steps it
 * let through pass inside, dimmer. All of it from the real incident data, replayed from the start
 * whenever a new incident arrives.
 *
 * One point cloud, animated on the GPU (no per-frame allocation). The quality ladder
 * (lib/client/gfx) sheds particles per step as fps falls. Reduced motion: one still frame.
 */
import { PerspectiveCamera } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { palette } from "@/components/world/palette";
import { useGfx } from "@/lib/client/gfx";

import { toneOf, type MapIncident, type Tone } from "./map-data";

const EDGE = 3.6;
const RING = 1.35;
const CORE = 0.42;
const TRAVEL = 2.4;
const BREAK = 1.3;
/** Particles per step at each quality step (the ladder sheds these first). */
const PER_STEP = [7, 5, 3, 2];
const MAX_POINTS = 2600;

const hash = (s: string) => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return (h >>> 0) / 4294967296;
};

const vertex = /* glsl */ `
  attribute vec3 aEnd; attribute vec3 aScatter; attribute vec3 aColor;
  attribute float aDelay; attribute float aThrough; attribute float aSeed;
  uniform float uTime; uniform float uPeriod; uniform float uPR;
  varying vec3 vColor; varying float vA;
  void main() {
    float t = mod(uTime - aDelay, uPeriod);
    float p = clamp(t / ${TRAVEL.toFixed(2)}, 0.0, 1.0);
    float e = p * p * (3.0 - 2.0 * p);
    vec3 pos = mix(position, aEnd, e);
    float a = smoothstep(0.0, 0.15, p);
    float after = t - ${TRAVEL.toFixed(2)};
    if (after > 0.0) {
      float q = clamp(after / ${BREAK.toFixed(2)}, 0.0, 1.0);
      // Refused: bursts off the ring and fades. Let through: settles into the core and fades.
      pos = aEnd + aScatter * q * (1.0 - aThrough);
      a = 1.0 - q;
    }
    a *= mix(1.0, 0.45, aThrough);
    vec4 mv = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = uPR * (1.4 + aSeed * 1.2) / -mv.z;
    vColor = aColor;
    vA = a;
  }
`;
const fragment = /* glsl */ `
  varying vec3 vColor; varying float vA;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    if (d > 0.5 || vA <= 0.01) discard;
    gl_FragColor = vec4(vColor, (1.0 - smoothstep(0.08, 0.5, d)) * vA);
  }
`;
const staticVertex = /* glsl */ `
  attribute float aSeed;
  uniform float uPR; uniform float uTime; uniform float uPulse;
  varying float vA;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = uPR * (1.2 + aSeed) / -mv.z;
    vA = (0.35 + 0.35 * aSeed) * (1.0 + uPulse * 0.6 * sin(uTime * 0.8 + aSeed * 6.283));
  }
`;
const staticFragment = /* glsl */ `
  uniform vec3 uColor; varying float vA;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    if (d > 0.5) discard;
    gl_FragColor = vec4(uColor, (1.0 - smoothstep(0.1, 0.5, d)) * vA);
  }
`;

function ringAndCore(seedBase: number) {
  const ring = new Float32Array(260 * 3);
  const ringSeed = new Float32Array(260);
  for (let i = 0; i < 260; i++) {
    const a = (i / 260) * Math.PI * 2;
    const r = RING + (hash(`r${i}${seedBase}`) - 0.5) * 0.04;
    ring.set([Math.cos(a) * r, Math.sin(a) * r, (hash(`z${i}`) - 0.5) * 0.05], i * 3);
    ringSeed[i] = hash(`s${i}`);
  }
  const core = new Float32Array(320 * 3);
  const coreSeed = new Float32Array(320);
  for (let i = 0; i < 320; i++) {
    // Even points on a sphere (golden spiral), slightly filled in.
    const y = 1 - (i / 319) * 2;
    const rr = Math.sqrt(1 - y * y);
    const th = i * 2.399963;
    const k = CORE * (0.75 + 0.25 * hash(`c${i}`));
    core.set([Math.cos(th) * rr * k, y * k, Math.sin(th) * rr * k], i * 3);
    coreSeed[i] = hash(`d${i}`);
  }
  return { ring, ringSeed, core, coreSeed };
}

export default function AttackMap({
  incidents,
  version,
  active,
  reduce,
}: {
  incidents: MapIncident[];
  /** Changes when a new incident arrives: the streams replay from the start. */
  version: string;
  active: boolean;
  reduce: boolean;
}) {
  const c = useMemo(palette, []);
  const quality = useGfx((s) => s.quality);
  const per = PER_STEP[quality] ?? 2;

  const { geo, period } = useMemo(() => {
    const colour: Record<Tone, THREE.Color> = {
      danger: c.danger,
      warn: c.warn,
      sig: c.sig,
      text3: c.text3,
    };
    const totalSteps = incidents.reduce((n, i) => n + i.allowed + i.refused, 0);
    const scale = Math.min(1, MAX_POINTS / Math.max(1, totalSteps * per));
    const pos: number[] = [];
    const end: number[] = [];
    const scatter: number[] = [];
    const col: number[] = [];
    const delay: number[] = [];
    const through: number[] = [];
    const seed: number[] = [];
    const stagger = Math.min(0.55, 6 / Math.max(1, incidents.length));
    incidents.forEach((inc, k) => {
      const angle = hash(inc.id) * Math.PI * 2;
      const dx = Math.cos(angle);
      const dy = Math.sin(angle);
      const tone = colour[toneOf(inc.pattern)];
      const steps = inc.allowed + inc.refused;
      const span = Math.min(2.6, 0.25 + steps * 0.06);
      for (let s = 0; s < steps; s++) {
        const refused = s >= inc.allowed;
        const n = Math.max(1, Math.round(per * scale));
        for (let j = 0; j < n; j++) {
          const r = hash(`${inc.id}:${s}:${j}`);
          const r2 = hash(`${inc.id}:${j}:${s}`);
          const side = (r - 0.5) * 0.5;
          // Start on the edge, spread a little sideways so a stream reads as a band.
          pos.push(dx * EDGE - dy * side, dy * EDGE + dx * side, (r2 - 0.5) * 0.6);
          if (refused) {
            const a = angle + (r - 0.5) * 0.18;
            end.push(Math.cos(a) * RING, Math.sin(a) * RING, (r2 - 0.5) * 0.1);
            const out = 0.5 + r2 * 0.9;
            const sa = angle + (r2 - 0.5) * 2.4;
            scatter.push(Math.cos(sa) * out, Math.sin(sa) * out, (r - 0.5) * 0.8);
          } else {
            end.push(dx * CORE * 0.9 + side * 0.2, dy * CORE * 0.9, (r2 - 0.5) * 0.2);
            scatter.push(0, 0, 0);
          }
          col.push(tone.r, tone.g, tone.b);
          delay.push(k * stagger + (s / Math.max(1, steps)) * span + r * 0.12);
          through.push(refused ? 0 : 1);
          seed.push(r2);
        }
      }
    });
    const g = new THREE.BufferGeometry();
    const f = (a: number[], n: number) => new THREE.BufferAttribute(new Float32Array(a), n);
    g.setAttribute("position", f(pos, 3));
    g.setAttribute("aEnd", f(end, 3));
    g.setAttribute("aScatter", f(scatter, 3));
    g.setAttribute("aColor", f(col, 3));
    g.setAttribute("aDelay", f(delay, 1));
    g.setAttribute("aThrough", f(through, 1));
    g.setAttribute("aSeed", f(seed, 1));
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), EDGE * 1.5);
    const last = delay.length ? Math.max(...delay) : 0;
    return { geo: g, period: last + TRAVEL + BREAK + 1.6 };
  }, [incidents, per, c]);
  useEffect(() => () => geo.dispose(), [geo]);

  const stat = useMemo(() => {
    const { ring, ringSeed, core, coreSeed } = ringAndCore(1);
    const mk = (p: Float32Array, s: Float32Array) => {
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.BufferAttribute(p, 3));
      g.setAttribute("aSeed", new THREE.BufferAttribute(s, 1));
      g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 2);
      return g;
    };
    return { ring: mk(ring, ringSeed), core: mk(core, coreSeed) };
  }, []);

  const mats = useMemo(() => {
    const stream = new THREE.ShaderMaterial({
      vertexShader: vertex,
      fragmentShader: fragment,
      uniforms: { uTime: { value: 0 }, uPeriod: { value: 10 }, uPR: { value: 1 } },
      transparent: true,
      depthWrite: false,
    });
    const glow = (color: THREE.Color, pulse: number) =>
      new THREE.ShaderMaterial({
        vertexShader: staticVertex,
        fragmentShader: staticFragment,
        uniforms: {
          uPR: { value: 1 },
          uTime: { value: 0 },
          uPulse: { value: pulse },
          uColor: { value: color.clone() },
        },
        transparent: true,
        depthWrite: false,
      });
    return { stream, ring: glow(c.ok, 0.25), core: glow(c.kem, 0.35) };
  }, [c]);

  // A new incident (or new data): replay every stream from the edge.
  const time = useRef(0);
  useEffect(() => {
    time.current = reduce ? TRAVEL * 0.8 + 0.6 : 0;
  }, [version, reduce]);
  useEffect(() => {
    mats.stream.uniforms.uPeriod!.value = period;
  }, [mats, period]);

  const group = useRef<THREE.Group>(null);
  useFrame(({ gl }, dt) => {
    if (!active) return;
    const pr = gl.getPixelRatio() * 14;
    if (!reduce) time.current += Math.min(dt, 0.1);
    for (const m of [mats.stream, mats.ring, mats.core]) {
      m.uniforms.uPR!.value = pr;
      m.uniforms.uTime!.value = time.current;
    }
    if (group.current && !reduce) group.current.rotation.z += dt * 0.012;
  });

  return (
    <>
      <PerspectiveCamera
        makeDefault
        position={[0, -1.4, 6.2]}
        fov={40}
        onUpdate={(cam) => cam.lookAt(0, 0, 0)}
      />
      <group ref={group} rotation={[-0.25, 0, 0]}>
        <points geometry={stat.core} material={mats.core} frustumCulled={false} />
        <points geometry={stat.ring} material={mats.ring} frustumCulled={false} />
        <points geometry={geo} material={mats.stream} frustumCulled={false} />
      </group>
    </>
  );
}
