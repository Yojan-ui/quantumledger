"use client";

/**
 * PROVE in 3D, after the real ML-DSA-signed anchor is appended. Four leaves (scan, CBOM hash,
 * policy, transcript hash) wind up, rise from the sphere and land in their slots with a settle; the
 * tree then builds bottom-up: each parent drops onto its two children and lands (they give a little
 * under it), then the root drops onto the pair. Each node flashes as it lands (its real hash is shown
 * by the labels). The root becomes Block #N, which springs in and locks onto the short chain of the
 * entries before it: a --sig ring closes and the lock's shackle snaps shut past closed and settles.
 * The lock turns green when the sweep verifies the block, red if the sweep stops at it.
 * Every time here is measured from the real anchor event (look.since.anchor).
 */
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { launch, springIn, wobble } from "@/lib/motion";
import { MERKLE_Y, R } from "./geometry";
import { set3 } from "@/components/scenes/geometry";
import type { Look } from "./look";
import { Body } from "@/components/scenes/Body";

export const NODES = [
  // leaves
  { at: [-1.5, MERKLE_Y, 0], t: 0, level: 0 },
  { at: [-0.5, MERKLE_Y, 0], t: 120, level: 0 },
  { at: [0.5, MERKLE_Y, 0], t: 240, level: 0 },
  { at: [1.5, MERKLE_Y, 0], t: 360, level: 0 },
  // pairs
  { at: [-1, MERKLE_Y + 0.7, 0], t: 750, level: 1 },
  { at: [1, MERKLE_Y + 0.7, 0], t: 850, level: 1 },
  // root
  { at: [0, MERKLE_Y + 1.4, 0], t: 1150, level: 2 },
] as const;
const EDGES: [number, number][] = [
  [0, 4],
  [1, 4],
  [2, 5],
  [3, 5],
  [4, 6],
  [5, 6],
];
export const ROOT = new THREE.Vector3(NODES[6].at[0], NODES[6].at[1], NODES[6].at[2]);
const BLOCK_AT = 1500;
const LOCK_AT = 1900;
/** How far a parent drops from onto its children. */
const DROP = 0.5;
/** The parent of each node (-1 for the root), for the give under a landing parent. */
const PARENT = [4, 4, 5, 5, 6, 6, -1];
const CHAIN = [-3.6, -2.4, -1.2];

export function Merkle({
  look,
  previous,
  failedAt,
}: {
  look: React.RefObject<Look>;
  previous: number;
  failedAt?: boolean;
}) {
  const node = useMemo(() => new THREE.EdgesGeometry(new THREE.BoxGeometry(0.26, 0.26, 0.26)), []);
  const blockSolid = useMemo(() => new THREE.BoxGeometry(0.6, 0.4, 0.4), []);
  const block = useMemo(() => new THREE.EdgesGeometry(new THREE.BoxGeometry(0.62, 0.42, 0.42)), []);
  const mats = useMemo(
    () =>
      NODES.map(
        () =>
          new THREE.LineBasicMaterial({ transparent: true, depthWrite: false, toneMapped: false }),
      ),
    [],
  );
  const chainMat = useMemo(
    () => new THREE.LineBasicMaterial({ transparent: true, depthWrite: false, toneMapped: false }),
    [],
  );
  const blockMat = useMemo(
    () => new THREE.LineBasicMaterial({ transparent: true, depthWrite: false, toneMapped: false }),
    [],
  );
  const edges = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(EDGES.length * 6), 3));
    return new THREE.LineSegments(
      g,
      new THREE.LineBasicMaterial({ transparent: true, depthWrite: false, toneMapped: false }),
    );
  }, []);
  const links = useMemo(() => {
    const pts = [...CHAIN.map((x) => new THREE.Vector3(x, ROOT.y, 0)), ROOT];
    const g = new THREE.BufferGeometry().setFromPoints(pts);
    return new THREE.Line(
      g,
      new THREE.LineBasicMaterial({ transparent: true, depthWrite: false, toneMapped: false }),
    );
  }, []);
  const ringMat = useMemo(
    () => new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, toneMapped: false }),
    [],
  );
  const lockMat = useMemo(
    () => new THREE.LineBasicMaterial({ transparent: true, depthWrite: false, toneMapped: false }),
    [],
  );
  const lockBody = useMemo(
    () => new THREE.EdgesGeometry(new THREE.BoxGeometry(0.26, 0.2, 0.08)),
    [],
  );
  const shackle = useMemo(() => {
    const curve = new THREE.EllipseCurve(0, 0, 0.09, 0.11, 0, Math.PI, false, 0);
    return new THREE.BufferGeometry().setFromPoints(
      curve.getPoints(16).map((p) => new THREE.Vector3(p.x, p.y, 0)),
    );
  }, []);
  const shackleLine = useMemo(() => new THREE.Line(shackle, lockMat), [shackle, lockMat]);
  const nodes = useRef<(THREE.Group | null)[]>([]);
  const blockRef = useRef<THREE.Group>(null);
  const ring = useRef<THREE.Mesh>(null);
  const lockRef = useRef<THREE.Group>(null);
  const from = useMemo(() => new THREE.Vector3(), []);
  const to = useMemo(() => new THREE.Vector3(), []);

  useFrame(({ clock }) => {
    const L = look.current;
    if (!L?.active) return;
    const t = L.since.anchor;
    const anchored = t < Infinity;
    const vis = L.dim("merkle");
    const ep = edges.geometry.attributes.position!.array as Float32Array;
    NODES.forEach((n, i) => {
      const g = nodes.current[i];
      if (!g) return;
      const s = (t - n.t) / 1000;
      const on = anchored && (L.reduce || s > 0);
      g.visible = on;
      to.set(n.at[0], n.at[1], n.at[2]);
      if (L.reduce || !anchored) g.position.copy(to);
      else if (n.level === 0) {
        // Leaves: a dip into the sphere, then up to the slot on a spring.
        from.set(n.at[0] * 0.3, R + L.lift, 0);
        g.position.copy(from).lerp(to, launch(s, { amount: 0.06 }));
      } else {
        // Parents and the root: dropped from above, landing with a settle.
        g.position.copy(to);
        g.position.y += DROP * (1 - springIn(s, 0.45, 1.8));
      }
      // Follow-through: a node gives a little under its parent as the parent lands.
      const p = PARENT[i]!;
      if (anchored && !L.reduce && p >= 0) {
        const land = (t - NODES[p]!.t) / 1000 - 0.18;
        g.position.y -= 0.035 * Math.max(0, wobble(land, 3.2, 5));
      }
      g.scale.setScalar(on ? 1 : 0.001);
      // Each node flashes white as its hash is "computed", then settles to --sig.
      const flash = anchored && !L.reduce ? Math.max(0, 1 - Math.abs(t - n.t - 300) / 250) : 0;
      mats[i]!.color.copy(L.c.sig).lerp(L.c.text, flash);
      // The root hands over to the block.
      const handover = i === 6 && t > BLOCK_AT ? Math.min(1, (t - BLOCK_AT) / 300) : 0;
      mats[i]!.opacity = (i === 6 ? 1 - handover : 1) * vis * (L.stage >= 3 ? 1 : 0.5);
    });
    EDGES.forEach(([a, b], j) => {
      const A = nodes.current[a]?.position;
      const B = nodes.current[b]?.position;
      if (A && B) {
        set3(ep, j * 2, A.x, A.y, A.z);
        set3(ep, j * 2 + 1, B.x, B.y, B.z);
      }
    });
    edges.geometry.attributes.position!.needsUpdate = true;
    const em = edges.material as THREE.LineBasicMaterial;
    em.color.copy(L.c.sig);
    em.opacity = anchored ? Math.min(1, Math.max(0, (t - 700) / 400)) * 0.6 * vis : 0;
    // The block, the chain it locks onto, the ring and the lock.
    const b = anchored ? (L.reduce ? 1 : springIn((t - BLOCK_AT) / 1000, 0.45, 1.7)) : 0;
    const green = L.green(Math.PI / 2);
    const bad = !!failedAt;
    if (blockRef.current) {
      blockRef.current.visible = b > 0;
      blockRef.current.scale.setScalar(Math.max(0.001, b));
      // The lock closing jolts the block down a hair.
      blockRef.current.position.y = L.reduce
        ? 0
        : -0.03 * Math.max(0, wobble((t - LOCK_AT) / 1000 - 0.08, 4, 7));
      blockRef.current.position.x = bad && !L.reduce ? Math.sin(clock.elapsedTime * 40) * 0.03 : 0;
    }
    blockMat.color.copy(bad ? L.c.danger : L.c.sig).lerp(L.c.ok, bad ? 0 : green);
    blockMat.opacity = vis;
    chainMat.color.copy(L.c.sig).lerp(L.c.ok, green);
    chainMat.opacity = b * 0.7 * vis;
    const lm = links.material as THREE.LineBasicMaterial;
    lm.color.copy(L.c.sig);
    lm.opacity = b * 0.5 * vis;
    if (ring.current) {
      ring.current.visible = b > 0;
      ring.current.rotation.z = L.reduce ? 0 : clock.elapsedTime * 1.2;
      ring.current.scale.setScalar(Math.max(0.001, 0.6 + 0.4 * b));
    }
    ringMat.color.copy(bad ? L.c.danger : L.c.sig).lerp(L.c.ok, bad ? 0 : green);
    ringMat.opacity = 0.7 * b * vis;
    // The shackle snaps shut: past closed (a clunk), then settles.
    const lock = anchored ? (L.reduce ? 1 : springIn((t - LOCK_AT) / 1000, 0.3, 2.4)) : 0;
    if (lockRef.current) lockRef.current.visible = b > 0;
    shackleLine.position.y = 0.1 + 0.12 * (1 - lock);
    lockMat.color.copy(bad ? L.c.danger : L.c.sig).lerp(L.c.ok, bad ? 0 : green);
    lockMat.opacity = vis;
  });

  return (
    <group>
      {NODES.map((n, i) => (
        <group key={i} ref={(g) => void (nodes.current[i] = g)} visible={false}>
          <lineSegments geometry={node} material={mats[i]} />
        </group>
      ))}
      <primitive object={edges} />
      <primitive object={links} />
      {/* Proof Chain blocks: glass bodies inside their signed wireframes. */}
      {CHAIN.slice(3 - Math.min(3, previous)).map((x) => (
        <group key={x} position={[x, ROOT.y, 0]}>
          <Body geometry={blockSolid} like={chainMat} kind="glass" />
          <lineSegments geometry={block} material={chainMat} />
        </group>
      ))}
      <group ref={blockRef} position={[0, 0, 0]} visible={false}>
        <Body geometry={blockSolid} like={blockMat} kind="glass" tint={0.5} position={ROOT} />
        <lineSegments geometry={block} material={blockMat} position={ROOT} />
      </group>
      <mesh ref={ring} position={ROOT} material={ringMat} visible={false}>
        <torusGeometry args={[0.48, 0.012, 6, 64]} />
      </mesh>
      <group ref={lockRef} position={[ROOT.x, ROOT.y + 0.55, 0]} visible={false}>
        <lineSegments geometry={lockBody} material={lockMat} />
        <primitive object={shackleLine} />
      </group>
    </group>
  );
}
