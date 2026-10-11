"use client";

/** The dotted Earth: uniform land dots (--text at 25–35%), a 6% graticule and a subtle rim (≤20%) that breathes. */
import { useFrame, useThree } from "@react-three/fiber";
import { useMemo } from "react";
import * as THREE from "three";
import { palette } from "./palette";
import type { Dots } from "./shapes";
import { world } from "./store";

const dotVertex = /* glsl */ `
  attribute float aSeed;
  uniform float uPR;
  varying float vAlpha;
  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    float facing = dot(normalize(world.xyz), normalize(cameraPosition - world.xyz));
    vAlpha = smoothstep(0.0, 0.35, facing) * (0.25 + 0.1 * aSeed);
    vec4 mv = viewMatrix * world;
    gl_Position = projectionMatrix * mv;
    gl_PointSize = 6.0 * uPR / -mv.z;
  }
`;
const dotFragment = /* glsl */ `
  uniform vec3 uColor; varying float vAlpha;
  void main() {
    if (length(gl_PointCoord - 0.5) > 0.5) discard;
    gl_FragColor = vec4(uColor, vAlpha);
  }
`;
const rimVertex = /* glsl */ `
  varying vec3 vNormal; varying vec3 vView;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vNormal = normalize(normalMatrix * normal);
    vView = normalize(-mv.xyz);
    gl_Position = projectionMatrix * mv;
  }
`;
const rimFragment = /* glsl */ `
  uniform vec3 uColor; uniform float uRim; varying vec3 vNormal; varying vec3 vView;
  void main() { gl_FragColor = vec4(uColor, pow(1.0 - abs(dot(vNormal, vView)), 4.0) * uRim); }
`;

export function Globe({ dots }: { dots: Dots }) {
  const pr = useThree((s) => s.viewport.dpr);
  const c = useMemo(palette, []);
  const points = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(dots.positions, 3));
    g.setAttribute("aSeed", new THREE.BufferAttribute(dots.seed, 1));
    const m = new THREE.ShaderMaterial({
      vertexShader: dotVertex,
      fragmentShader: dotFragment,
      uniforms: { uPR: { value: pr }, uColor: { value: c.text } },
      transparent: true,
      depthWrite: false,
    });
    return { g, m };
  }, [dots, pr, c]);
  const rim = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: rimVertex,
        fragmentShader: rimFragment,
        uniforms: { uColor: { value: c.text }, uRim: { value: 0.18 } },
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    [c],
  );
  // Idle breathing: the atmosphere rim moves by 2.5% opacity over a 6 s cycle (static when reduced motion).
  useFrame(({ clock }) => {
    rim.uniforms.uRim!.value = world.breathe
      ? 0.18 + 0.0125 * Math.sin((clock.elapsedTime * 2 * Math.PI) / 6)
      : 0.18;
  });
  const graticule = useMemo(() => {
    const pts: number[] = [];
    const r = 1.0015;
    const push = (lat: number, lon: number) => {
      const la = (lat * Math.PI) / 180;
      const lo = (lon * Math.PI) / 180;
      pts.push(r * Math.cos(la) * Math.cos(lo), r * Math.sin(la), -r * Math.cos(la) * Math.sin(lo));
    };
    for (let lat = -60; lat <= 60; lat += 30) {
      for (let lon = 0; lon < 360; lon += 3) {
        push(lat, lon);
        push(lat, lon + 3);
      }
    }
    for (let lon = 0; lon < 360; lon += 30) {
      for (let lat = -84; lat < 84; lat += 3) {
        push(lat, lon);
        push(lat + 3, lon);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
    return g;
  }, []);

  return (
    <group>
      {/* Occluder: hides arcs and dots on the far side. */}
      <mesh renderOrder={-1}>
        <sphereGeometry args={[0.995, 64, 64]} />
        <meshBasicMaterial color={c.bg} />
      </mesh>
      <lineSegments geometry={graticule}>
        <lineBasicMaterial color={c.text} transparent opacity={0.06} depthWrite={false} />
      </lineSegments>
      <points geometry={points.g} material={points.m} />
      <mesh scale={1.06} material={rim}>
        <sphereGeometry args={[1, 64, 64]} />
      </mesh>
    </group>
  );
}
