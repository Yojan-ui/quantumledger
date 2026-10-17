"use client";

/**
 * Demo 2's hero moment: an adapter seating into a node (world.seat), on the globe.
 *
 * As the camera dives in, a glass server (fresnel rim) dissolves into being on the node and a cloud
 * of particles flies in and assembles the adapter's shape above it while the real deploy runs. When
 * the deploy returns (`done`), the solid adapter clicks home (a spring with a visible overshoot and
 * settle), flashes (bloom), the globe's post-processing takes the impact, and an --ok ring ripples out
 * across the globe from the node. Nothing here starts on a timer alone. Static under reduced motion.
 */
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useBudget } from "@/components/fx/budget";
import { glass, solid } from "@/components/fx/materials";
import { makeParticles } from "@/components/fx/Particles";
import { springIn } from "@/lib/motion";
import { NODES } from "./geo";
import { palette } from "./palette";
import { world } from "./store";

/** The adapter's shape (the adapter list's small models, but solid). */
const SHAPES: Record<string, () => THREE.BufferGeometry> = {
  shield: () => new THREE.BoxGeometry(1, 1, 1),
  web: () => new THREE.TorusGeometry(0.55, 0.2, 12, 32).rotateX(Math.PI / 2),
  sdk: () => new THREE.BoxGeometry(0.9, 0.9, 0.9),
  edge: () => new THREE.TetrahedronGeometry(0.8, 0),
  vault: () => new THREE.CylinderGeometry(0.55, 0.55, 0.9, 24),
};
/** Model scale on the globe (radius 1): the node's building is ~0.05 across. */
const S = 0.016;
const HOVER = 0.07;
const BASE = 1.02;

export function Seat() {
  const c = useMemo(palette, []);
  const budget = useBudget();
  const geos = useMemo(
    () => Object.fromEntries(Object.entries(SHAPES).map(([k, f]) => [k, f()])),
    [],
  );
  const mat = useMemo(
    () => ({
      adapter: solid(c.kem, { glow: 0.9 }),
      server: glass(c.text3, { rim: 2.2, body: 0.08 }),
      socket: solid(c.text3, { glow: 0.2 }),
      ripple: new THREE.MeshBasicMaterial({
        color: c.ok.clone().multiplyScalar(2.5),
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        toneMapped: false,
      }),
    }),
    [c],
  );
  // The particles that assemble the adapter (a few thousand: it's small on screen).
  const cloud = useMemo(() => {
    const p = makeParticles(Math.round(Math.min(6000, budget.particles * 0.15)), {
      colorA: c.kem,
      colorB: c.text,
      radius: 0.06,
      size: 0.0016,
      seed: 31,
    });
    p.u.uAmp.value = 0.8;
    p.u.uBright.value = 1.3;
    return p;
  }, [budget.particles, c]);
  useEffect(() => () => cloud.dispose(), [cloud]);

  const group = useRef<THREE.Group>(null);
  const adapter = useRef<THREE.Mesh>(null);
  const server = useRef<THREE.Mesh>(null);
  const ripple = useRef<THREE.Mesh>(null);
  const up = useMemo(() => new THREE.Vector3(0, 1, 0), []);
  const n = useMemo(() => new THREE.Vector3(), []);
  const local = useMemo(() => new THREE.Vector3(), []);
  const hit = useRef(0);
  const ringGeo = useMemo(() => new THREE.TorusGeometry(1, 0.006, 8, 160).rotateX(Math.PI / 2), []);

  useFrame(({ clock, gl }) => {
    const g = group.current;
    const a = adapter.current;
    const sv = server.current;
    const rp = ripple.current;
    if (!g || !a || !sv || !rp) return;
    const s = world.seat;
    const node = s && world.mode === "deploy" ? NODES.find((x) => x.id === s.site) : undefined;
    // The ripple outlives the seat by a moment (it crosses the globe after the click).
    const rippleAge = hit.current ? performance.now() - hit.current : Infinity;
    rp.visible = rippleAge < 3200 && world.mode === "deploy";
    if (rp.visible) {
      const k = rippleAge / 3200;
      // A circle on the sphere round the node's axis, opening from the node to a great circle.
      const th = (Math.PI / 2) * (1 - Math.pow(1 - k, 2));
      rp.scale.setScalar(Math.max(0.0001, Math.sin(th)) * 1.006);
      rp.position.copy(n).multiplyScalar(Math.cos(th) * 1.006);
      rp.quaternion.setFromUnitVectors(up, n);
      mat.ripple.opacity = 0.9 * (1 - k);
    }
    g.visible = !!node;
    cloud.points.visible = !!node && !!s && !s.done;
    if (!s || !node) return;
    const still = !world.breathe;
    const now = performance.now();
    n.copy(node.pos).normalize();
    g.position.copy(node.pos).multiplyScalar(BASE);
    g.quaternion.setFromUnitVectors(up, n);
    const geo = geos[s.adapter] ?? geos.sdk!;
    if (a.geometry !== geo) a.geometry = geo;

    // The glass server dissolves into being as the camera arrives.
    const form = still ? 1 : Math.min(1, (now - s.at) / 900);
    sv.scale.set(S * 1.6, S * 2.4 * Math.max(0.0001, springIn(form, 0.55, 1.6)), S * 1.6);
    sv.position.y = S * 1.2;
    mat.server.uniforms.uOpacity!.value = form;
    (mat.server.uniforms.uColor!.value as THREE.Color).copy(c.text3).lerp(c.ok, s.done ? 1 : 0);

    // The particles fly in and assemble the adapter's shape above the server.
    // In the globe group's own space (the cloud lives in the same group as the seat).
    const shapeAt = local
      .set(0, S * 2.6 + HOVER * 0.6, 0)
      .applyQuaternion(g.quaternion)
      .add(g.position);
    cloud.u.uTime.value = clock.elapsedTime;
    cloud.u.uPR.value = gl.getPixelRatio();
    cloud.u.uCenter.value.copy(shapeAt);
    cloud.u.uShapeAt.value.copy(shapeAt);
    cloud.u.uShapeSize.value.setScalar(S * 1.15);
    cloud.u.uGather.value = still ? 1 : Math.min(1, (now - s.at) / 2000);

    // The solid adapter: appears as the cloud lands, waits, then clicks home on the real `done`.
    const appear = still ? 1 : Math.max(0, Math.min(1, (now - s.at - 1400) / 500));
    let h = S * 2.6 + HOVER * 0.6;
    if (s.done) {
      const k = still ? 1 : springIn((now - s.done) / 1000, 0.32, 3.2);
      h = h + (S * 2.4 - h) * k;
      if (hit.current < s.done) {
        hit.current = s.done;
        world.fxHit = { at: now, s: 0.8 };
        world.waveAt = now;
      }
    }
    a.position.set(0, h, 0);
    a.scale.setScalar(Math.max(0.0001, S * appear));
    a.rotation.y = still || s.done ? 0 : clock.elapsedTime * 0.8;
    mat.adapter.uniforms.uDissolve!.value = 1 - appear;
    const ok = s.done ? Math.min(1, (now - s.done) / 300) : 0;
    (mat.adapter.uniforms.uColor!.value as THREE.Color).copy(c.kem).lerp(c.ok, ok);
    // The click's flash: a bloom spike that settles.
    mat.adapter.uniforms.uGlow!.value =
      0.9 + (s.done && !still ? 4 * Math.exp(-(now - s.done) / 280) : 0);
  });

  return (
    <>
      <group ref={group} visible={false}>
        <pointLight position={[0.06, 0.14, 0.08]} intensity={1.2} distance={0.5} decay={1} />
        <mesh ref={server} material={mat.server}>
          <boxGeometry args={[1, 1, 1]} />
        </mesh>
        <mesh ref={adapter} material={mat.adapter} />
      </group>
      <primitive object={cloud.points} />
      {/* The --ok ripple across the globe (a ring on the sphere, round the node's axis). */}
      <mesh ref={ripple} geometry={ringGeo} material={mat.ripple} visible={false} />
    </>
  );
}
