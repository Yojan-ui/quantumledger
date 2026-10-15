"use client";

/**
 * RESCAN in 3D: a flat green radar disc under the scene sweeps 360° in 2.5 s. Everything the line
 * crosses is re-verified for real (the scene turns it green only once the sweep result is in). If
 * the result says a block was tampered with, the line stops short and the block turns red.
 * As the line passes each object on the disc (`marks`), a ripple spreads out under it and fades:
 * two rings, the second trailing, over 0.9 s. The time each mark was passed is tracked here from the
 * real sweep angle, so a sweep that stops short never ripples what it didn't reach.
 */
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import type { Look } from "./look";
import { CLIENT, SERVER, VAULT } from "./geometry";

const MAX_MARKS = 12;
/** Disc-local (x, y) of the pipeline's objects: world (x, -z) relative to the disc's centre. */
const PIPELINE_MARKS: [number, number][] = [
  [CLIENT.x, -CLIENT.z],
  [0, 0],
  [SERVER.x, -SERVER.z],
  [VAULT.x, -VAULT.z],
];

const vertex = /* glsl */ `
  varying vec2 vP;
  void main() { vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;
const fragment = /* glsl */ `
  uniform float uAngle; uniform float uOn; uniform float uR; uniform vec3 uColor;
  uniform vec2 uMarks[${MAX_MARKS}]; uniform float uPassed[${MAX_MARKS}];
  varying vec2 vP;
  float ripple(vec2 at, float s) {
    if (s < 0.0 || s > 1.1) return 0.0;
    float d = distance(vP, at);
    float ring = exp(-pow((d - s * 1.15) / 0.045, 2.0)) * (1.0 - s / 0.9);
    float s2 = s - 0.16;
    float ring2 = s2 > 0.0 ? exp(-pow((d - s2 * 1.15) / 0.035, 2.0)) * (1.0 - s2 / 0.9) * 0.5 : 0.0;
    return max(0.0, ring) + max(0.0, ring2);
  }
  void main() {
    float r = length(vP) / uR;
    if (r > 1.0) discard;
    float a = atan(vP.y, vP.x); if (a < 0.0) a += 6.2831853;
    // The trailing wedge behind the sweep line, the line itself, and the rim.
    float behind = uAngle - a; if (behind < 0.0) behind += 6.2831853;
    float wedge = uAngle > 0.0 && behind < 1.2 ? (1.0 - behind / 1.2) * 0.35 : 0.0;
    float line = uAngle > 0.0 && behind < 0.025 ? 0.9 : 0.0;
    float edge = smoothstep(0.98, 1.0, r) * 0.6;
    float rip = 0.0;
    for (int i = 0; i < ${MAX_MARKS}; i++) rip += ripple(uMarks[i], uPassed[i]);
    gl_FragColor = vec4(uColor, (wedge + line + edge + rip * 0.8) * uOn * (1.0 - r * 0.3));
  }
`;

export function Radar({
  look,
  center = [0, -1.95, 0],
  radius = 6.5,
  angle,
  on,
  marks,
}: {
  look: React.RefObject<Look>;
  center?: [number, number, number];
  radius?: number;
  /** The sweep line's angle in radians (default: the pipeline sweep's progress × 2π). */
  angle?: (L: Look) => number;
  /** Whether the disc shows (default: the RESCAN stage, or a sweep in progress). */
  on?: (L: Look) => boolean;
  /** Objects on the disc that ripple as the line passes them: disc-local (x, y). */
  marks?: [number, number][];
}) {
  const pts = (marks ?? (angle ? [] : PIPELINE_MARKS)).slice(0, MAX_MARKS);
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: vertex,
        fragmentShader: fragment,
        uniforms: {
          uAngle: { value: 0 },
          uOn: { value: 0 },
          uR: { value: radius },
          uColor: { value: new THREE.Color() },
          uMarks: { value: Array.from({ length: MAX_MARKS }, () => new THREE.Vector2(1e4, 1e4)) },
          uPassed: { value: new Array(MAX_MARKS).fill(-1) },
        },
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    [radius],
  );
  // When the line passed each mark (performance.now() ms), 0 = not yet in this sweep.
  const passedAt = useRef(new Array(MAX_MARKS).fill(0));
  const prev = useRef(0);
  useFrame(() => {
    const L = look.current;
    if (!L?.active) return;
    const u = mat.uniforms;
    const visible = on ? on(L) : L.stage === 4 || L.sweep > 0;
    u.uOn!.value += ((visible ? 1 : 0) * L.dim("radar") - u.uOn!.value) * 0.1;
    const a = angle ? angle(L) : L.sweep * Math.PI * 2;
    u.uAngle!.value = a;
    // A new sweep (the angle went back) clears the marks; a mark ripples once the line crosses it.
    if (a < prev.current - 1e-3 || a <= 0) passedAt.current.fill(0);
    const marksU = u.uMarks!.value as THREE.Vector2[];
    const passedU = u.uPassed!.value as number[];
    pts.forEach(([x, y], i) => {
      marksU[i]!.set(x, y);
      let az = Math.atan2(y, x);
      if (az < 0) az += Math.PI * 2;
      if (!passedAt.current[i] && a > 0 && a >= az && (prev.current < az || prev.current === 0))
        passedAt.current[i] = L.now;
      passedU[i] = passedAt.current[i] && !L.reduce ? (L.now - passedAt.current[i]) / 1000 : -1;
    });
    prev.current = a;
    (u.uColor!.value as THREE.Color).copy(L.sweepOk === false ? L.c.danger : L.c.ok);
  });
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={center} material={mat}>
      <circleGeometry args={[radius, 96]} />
    </mesh>
  );
}
