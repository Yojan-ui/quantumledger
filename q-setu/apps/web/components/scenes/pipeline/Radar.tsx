"use client";

/**
 * RESCAN in 3D: a flat green radar disc under the scene sweeps 360° in 2.5 s. Everything the line
 * crosses is re-verified for real (the scene turns it green only once the sweep result is in). If
 * the result says a block was tampered with, the line stops short and the block turns red.
 */
import { useFrame } from "@react-three/fiber";
import { useMemo } from "react";
import * as THREE from "three";
import type { Look } from "./look";

const vertex = /* glsl */ `
  varying vec2 vP;
  void main() { vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;
const fragment = /* glsl */ `
  uniform float uAngle; uniform float uOn; uniform float uR; uniform vec3 uColor;
  varying vec2 vP;
  void main() {
    float r = length(vP) / uR;
    if (r > 1.0) discard;
    float a = atan(vP.y, vP.x); if (a < 0.0) a += 6.2831853;
    // The trailing wedge behind the sweep line, the line itself, and the rim.
    float behind = uAngle - a; if (behind < 0.0) behind += 6.2831853;
    float wedge = uAngle > 0.0 && behind < 1.2 ? (1.0 - behind / 1.2) * 0.35 : 0.0;
    float line = uAngle > 0.0 && behind < 0.025 ? 0.9 : 0.0;
    float edge = smoothstep(0.98, 1.0, r) * 0.6;
    gl_FragColor = vec4(uColor, (wedge + line + edge) * uOn * (1.0 - r * 0.3));
  }
`;

export function Radar({
  look,
  center = [0, -1.95, 0],
  radius = 6.5,
  angle,
  on,
}: {
  look: React.RefObject<Look>;
  center?: [number, number, number];
  radius?: number;
  /** The sweep line's angle in radians (default: the pipeline sweep's progress × 2π). */
  angle?: (L: Look) => number;
  /** Whether the disc shows (default: the RESCAN stage, or a sweep in progress). */
  on?: (L: Look) => boolean;
}) {
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
        },
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    [],
  );
  useFrame(() => {
    const L = look.current;
    if (!L?.active) return;
    const u = mat.uniforms;
    const visible = on ? on(L) : L.stage === 4 || L.sweep > 0;
    u.uOn!.value += ((visible ? 1 : 0) * L.dim("radar") - u.uOn!.value) * 0.1;
    u.uAngle!.value = angle ? angle(L) : L.sweep * Math.PI * 2;
    (u.uColor!.value as THREE.Color).copy(L.sweepOk === false ? L.c.danger : L.c.ok);
  });
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={center} material={mat}>
      <circleGeometry args={[radius, 96]} />
    </mesh>
  );
}
