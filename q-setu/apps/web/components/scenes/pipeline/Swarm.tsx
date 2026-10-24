"use client";

/**
 * The target system: a wireframe icosahedron with ~3,000 particles flocking inside it (half on
 * phones), and a ring of particles in orbit. The particles stream on a curl-noise flow field (each
 * one's slow orbit advected through it, so neighbours move together like a flock, never jitter).
 * Stage 1 streams them red and faster; stage 2 lifts the sphere; stage 3 assembles them into a
 * regular white lattice as a wave spreading from where the patch lands on the sphere (in 60 ms
 * beats by distance), each node springing into place with a small overshoot; stage 5 turns
 * everything --ok as the radar passes. Reduced motion: no flow, the lattice is simply there.
 */
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { easeToken } from "@/lib/ease";
import { latticePoints, logoPoints, R, rng } from "./geometry";
import { hero, heroIntro } from "@/lib/client/hero";
import { set3 } from "@/components/scenes/geometry";
import type { Look } from "./look";
import { CURL3, SPRING } from "@/components/scenes/glsl";
import { gfx } from "@/lib/client/gfx";

/** Where the patch lands: the top of the sphere, under the handshake link's arc. */
const CONTACT = new THREE.Vector3(0, R * 0.95, 0.2);

const vertex = /* glsl */ `
  attribute vec4 aSeed; attribute vec3 aLattice; attribute vec3 aLogo;
  uniform float uTime; uniform float uMorphT; uniform float uLift; uniform float uSize; uniform float uPR;
  uniform float uAssemble; uniform float uIntro; uniform float uFlow; uniform vec3 uContact;
  varying float vK; varying float vA; varying float vI; varying float vFade;
  ${CURL3}
  ${SPRING}
  void main() {
    float lim = ${R.toFixed(2)} * 0.93;
    float r = lim * pow(aSeed.x, 0.33);
    float th = aSeed.y * 6.2831 + uTime * (0.18 + aSeed.z * 0.3);
    float ph = acos(2.0 * aSeed.w - 1.0);
    vec3 p = vec3(r * sin(ph) * cos(th), r * cos(ph), r * sin(ph) * sin(th));
    // Flock: advect the slow orbit through the evolving curl field, then keep it inside the cage.
    for (int i = 0; i < 2; i++) p += curlNoise(p * 0.55 + vec3(0.0, 0.0, uTime * 0.12)) * 0.2 * uFlow;
    float lp = length(p);
    vec3 swirl = lp > lim ? p * (lim / lp) : p;
    // The lattice wave: a node's spring is released when the front, spreading from the contact
    // point at 4 units/s, reaches it, in beats of 60 ms.
    float delay = floor(distance(aLattice, uContact) / 4.0 / 0.06 + 0.5) * 0.06;
    float k = uMorphT < 0.0 ? 0.0 : springIn(uMorphT - delay);
    vK = clamp(k, 0.0, 1.0);
    vA = 0.55 + 0.45 * aSeed.w;
    vec3 body = mix(swirl, aLattice, k) + vec3(0.0, uLift, 0.0);
    // The homepage opening (lib/client/hero): scattered dust assembles into the lattice-cube mark,
    // then the mark bursts outward and every particle falls into its place in the swarm.
    float ka = clamp(uAssemble * 1.6 - aSeed.y * 0.6, 0.0, 1.0);
    ka = ka * ka * (3.0 - 2.0 * ka);
    vec3 dust = swirl * 3.2 + vec3(0.0, 0.0, -2.0);
    vec3 mark = mix(dust, aLogo, ka);
    float ki = clamp(uIntro * 1.4 - aSeed.z * 0.4, 0.0, 1.0);
    ki = ki * ki * (3.0 - 2.0 * ki);
    float burst = 4.0 * ki * (1.0 - ki) * (1.6 + aSeed.w * 2.2) * step(uIntro, 0.999);
    vec3 pos = mix(body, mark, ki) + normalize(aLogo + vec3(1e-4)) * burst;
    vI = ki;
    vec4 mv = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mv;
    // Depth: particles further from the camera fade, so the swarm reads as a volume.
    vFade = clamp(1.25 - (-mv.z - 4.0) / 10.0, 0.35, 1.0);
    gl_PointSize = uSize * uPR / -mv.z * (1.0 + 0.3 * k + 0.5 * ki);
  }
`;
const fragment = /* glsl */ `
  uniform vec3 uA; uniform vec3 uB; uniform vec3 uMark; uniform float uOpacity;
  varying float vK; varying float vA; varying float vI; varying float vFade;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    if (d > 0.5) discard;
    vec3 c = mix(mix(uA, uB, vK), uMark, vI);
    gl_FragColor = vec4(c, (1.0 - smoothstep(0.15, 0.5, d)) * vA * vFade * uOpacity * 0.8);
  }
`;

export function Swarm({
  look,
  count,
  intro = false,
}: {
  look: React.RefObject<Look>;
  count: number;
  /** The homepage opening drives the particles (mark → burst → swarm). */
  intro?: boolean;
}) {
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const r = rng(42);
    const seed = new Float32Array(count * 4).map(() => r());
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(count * 3), 3));
    g.setAttribute("aSeed", new THREE.BufferAttribute(seed, 4));
    g.setAttribute("aLattice", new THREE.BufferAttribute(latticePoints(count), 3));
    g.setAttribute("aLogo", new THREE.BufferAttribute(logoPoints(count), 3));
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 4);
    return g;
  }, [count]);
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: vertex,
        fragmentShader: fragment,
        uniforms: {
          uTime: { value: 0 },
          uMorphT: { value: -1 },
          uFlow: { value: 1 },
          uContact: { value: CONTACT },
          uLift: { value: 0 },
          uSize: { value: 2.6 },
          uPR: { value: 1 },
          uA: { value: new THREE.Color() },
          uB: { value: new THREE.Color() },
          uOpacity: { value: 1 },
          uAssemble: { value: 1 },
          uIntro: { value: 0 },
          uMark: { value: new THREE.Color() },
        },
        transparent: true,
        depthWrite: false,
      }),
    [],
  );
  const ico = useMemo(() => new THREE.EdgesGeometry(new THREE.IcosahedronGeometry(R, 2)), []);
  const icoMat = useMemo(
    () =>
      new THREE.LineBasicMaterial({
        transparent: true,
        opacity: 0.18,
        depthWrite: false,
        toneMapped: false,
      }),
    [],
  );
  const ring = useMemo(() => {
    const n = Math.round(count / 10);
    const r = rng(7);
    const p = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const rr = R * 1.45 + (r() - 0.5) * 0.12;
      set3(p, i, Math.cos(a) * rr, (r() - 0.5) * 0.06, Math.sin(a) * rr);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(p, 3));
    return g;
  }, [count]);
  const ringMat = useMemo(
    () =>
      new THREE.PointsMaterial({
        size: 0.035,
        transparent: true,
        opacity: 0.6,
        depthWrite: false,
        toneMapped: false,
      }),
    [],
  );
  const group = useRef<THREE.Group>(null);
  const ringRef = useRef<THREE.Points>(null);
  const t = useRef(0);
  /** 1 while the opening plays; eases to 0 once the hero has settled, so the flock comes to rest. */
  const settle = useRef(1);

  useFrame(({ gl }, dt) => {
    const L = look.current;
    if (!L || !L.active) return;
    const u = mat.uniforms;
    // Calm by default, faster only while the risk is on screen; frozen under reduced motion. On the
    // hero, the flock eases to a stop once the opening has played (one motion, then still).
    const resting = intro && hero.phase === "idle";
    settle.current += ((resting ? 0 : 1) - settle.current) * (1 - Math.exp(-dt * 0.8));
    const speed = (L.reduce ? 0 : L.stage === 1 ? 1.4 : L.morph > 0.5 ? 0.2 : 0.6) * settle.current;
    t.current += Math.min(dt, 0.1) * speed;
    u.uTime!.value = t.current;
    u.uMorphT!.value = L.morphT;
    u.uFlow!.value = L.reduce ? 0 : 1;
    // Point size in pixels at distance 1: ~3 CSS px at the stage camera's distance.
    u.uPR!.value = gl.getPixelRatio() * 11;
    (u.uA!.value as THREE.Color).copy(L.swarmA);
    (u.uB!.value as THREE.Color).copy(L.swarmB);
    u.uOpacity!.value = L.dim("swarm");
    const h = intro ? heroIntro(performance.now()) : { assemble: 1, intro: 0 };
    u.uAssemble!.value = h.assemble;
    u.uIntro!.value = h.intro;
    (u.uMark!.value as THREE.Color).copy(L.c.text);
    // Quality ladder step 2: half the particles.
    geo.setDrawRange(0, gfx.quality >= 2 ? geo.attributes.position!.count >> 1 : Infinity);
    if (group.current) group.current.position.y = L.lift;
    icoMat.color.copy(L.sphere);
    // The cage and the orbit ring come in only once the mark has burst into the swarm.
    const cage = 1 - h.intro;
    icoMat.opacity = (0.18 * L.dim("swarm") + 0.12 * L.morph) * cage;
    ringMat.color.copy(L.swarmA).lerp(L.swarmB, L.morph);
    ringMat.opacity = 0.55 * L.dim("swarm") * cage;
    if (ringRef.current && !L.reduce)
      ringRef.current.rotation.y += dt * (L.stage === 1 ? 0.4 : 0.12) * settle.current;
    void easeToken;
  });

  return (
    <group ref={group}>
      <points geometry={geo} material={mat} frustumCulled={false} />
      <lineSegments geometry={ico} material={icoMat} />
      <points ref={ringRef} geometry={ring} material={ringMat} rotation={[0.35, 0, 0.1]} />
    </group>
  );
}
