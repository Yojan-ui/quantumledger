"use client";

/**
 * Demo 2's hero moment: an adapter seating into a node's socket (world.seat).
 *
 * A solid socket ring sits on the node's building. The adapter (its own shape: a ring for Web, a
 * package for the SDK, a drum for Vault…) appears above it and lowers slowly while the real deploy
 * runs; when the deploy finishes it clicks home (a short spring with a visible overshoot and
 * settle), turns from --kem to --ok, and a pulse ring spreads from the socket. Nothing here starts
 * on a timer alone: `done` is the moment the real adapter run returned. Static under reduced motion.
 */
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { springIn } from "@/lib/motion";
import { NODES } from "./geo";
import { palette } from "./palette";
import { world } from "./store";

/** The adapter's shape, as in the adapter list's small models, but solid. */
const SHAPES: Record<string, () => THREE.BufferGeometry> = {
  shield: () => new THREE.IcosahedronGeometry(0.7, 0),
  web: () => new THREE.TorusGeometry(0.55, 0.2, 12, 32).rotateX(Math.PI / 2),
  sdk: () => new THREE.BoxGeometry(0.9, 0.9, 0.9),
  edge: () => new THREE.TetrahedronGeometry(0.8, 0),
  vault: () => new THREE.CylinderGeometry(0.55, 0.55, 0.9, 24),
};
/** Model scale on the globe (radius 1): the node's building is ~0.05 across. */
const S = 0.016;
const HOVER = 0.075;
const BASE = 1.022;

export function Seat() {
  const c = useMemo(palette, []);
  const geos = useMemo(
    () => Object.fromEntries(Object.entries(SHAPES).map(([k, f]) => [k, f()])),
    [],
  );
  const mat = useMemo(
    () => ({
      adapter: new THREE.MeshStandardMaterial({
        color: c.kem.clone(),
        emissive: c.kem.clone(),
        emissiveIntensity: 0.6,
        roughness: 0.3,
        metalness: 0.2,
      }),
      socket: new THREE.MeshStandardMaterial({
        color: c.text3.clone(),
        emissive: c.kem.clone(),
        emissiveIntensity: 0.15,
        roughness: 0.35,
        metalness: 0.6,
      }),
      pulse: new THREE.MeshBasicMaterial({
        color: c.ok.clone(),
        transparent: true,
        depthWrite: false,
        toneMapped: false,
      }),
    }),
    [c],
  );
  const group = useRef<THREE.Group>(null);
  const adapter = useRef<THREE.Mesh>(null);
  const pulse = useRef<THREE.Mesh>(null);
  const up = useMemo(() => new THREE.Vector3(0, 1, 0), []);
  const n = useMemo(() => new THREE.Vector3(), []);

  useFrame(({ clock }) => {
    const g = group.current;
    const a = adapter.current;
    const p = pulse.current;
    if (!g || !a || !p) return;
    const s = world.seat;
    const node = s && world.mode === "deploy" ? NODES.find((x) => x.id === s.site) : undefined;
    g.visible = !!node;
    if (!s || !node) return;
    const still = !world.breathe;
    const now = performance.now();
    n.copy(node.pos).normalize();
    g.position.copy(node.pos).multiplyScalar(BASE);
    g.quaternion.setFromUnitVectors(up, n);
    const geo = geos[s.adapter] ?? geos.sdk!;
    if (a.geometry !== geo) a.geometry = geo;
    // Appear (spring in), lower slowly while the deploy runs, then click home.
    const appear = still ? 1 : springIn((now - s.at) / 1000, 0.6, 1.8);
    const lowered = still ? 1 : Math.min(1, (now - s.at) / 2600);
    const waitH = HOVER * (1 - 0.45 * lowered);
    let h = waitH;
    if (s.done) {
      const k = still ? 1 : springIn((now - s.done) / 1000, 0.32, 3.2);
      h = waitH * (1 - k);
    }
    a.position.set(0, S * 0.9 + Math.max(-0.004, h), 0);
    a.scale.setScalar(Math.max(0.0001, S * appear));
    a.rotation.y = still || s.done ? 0 : clock.elapsedTime * 0.8;
    const ok = s.done ? Math.min(1, (now - s.done) / 300) : 0;
    mat.adapter.color.copy(c.kem).lerp(c.ok, ok);
    mat.adapter.emissive.copy(mat.adapter.color);
    mat.socket.emissive.copy(c.kem).lerp(c.ok, ok);
    mat.socket.emissiveIntensity = 0.15 + 0.5 * ok;
    const pk = s.done && !still ? Math.min(1, (now - s.done) / 800) : 1;
    p.visible = pk < 1;
    p.scale.setScalar(S * (1.4 + 3.5 * pk));
    mat.pulse.opacity = 0.8 * (1 - pk);
  });

  return (
    <group ref={group} visible={false}>
      {/* The world has no lights of its own: a short-range one, only while a seat is on. */}
      <pointLight position={[0.06, 0.14, 0.08]} intensity={1.2} distance={0.5} decay={1} />
      {/* The socket: a solid ring on a base plate. */}
      <mesh material={mat.socket} position={[0, S * 0.15, 0]} scale={S}>
        <cylinderGeometry args={[1.1, 1.2, 0.3, 32]} />
      </mesh>
      <mesh
        material={mat.socket}
        position={[0, S * 0.35, 0]}
        rotation={[Math.PI / 2, 0, 0]}
        scale={S}
      >
        <torusGeometry args={[0.85, 0.14, 12, 40]} />
      </mesh>
      <mesh ref={adapter} material={mat.adapter} />
      <mesh
        ref={pulse}
        material={mat.pulse}
        rotation={[Math.PI / 2, 0, 0]}
        position={[0, S * 0.4, 0]}
      >
        <ringGeometry args={[0.9, 1, 48]} />
      </mesh>
    </group>
  );
}
