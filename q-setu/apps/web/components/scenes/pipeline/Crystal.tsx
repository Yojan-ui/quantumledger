"use client";

/**
 * The lattice as a crystal: when the patch engages (stage 3), solid nodes (small emissive
 * icospheres, instanced) on a coarse cubic grid inside the sphere, joined to their neighbours by
 * lines (thickened by <Thicken>). It fades in with the swarm's morph into the lattice and takes the
 * same colour journey (white, then --ok when verified).
 */
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { R } from "./geometry";
import type { Look } from "./look";

const STEP = 0.5;

export function Crystal({ look }: { look: React.RefObject<Look> }) {
  const { nodes, edges } = useMemo(() => {
    const r = R * 0.86;
    const pts: THREE.Vector3[] = [];
    const key = (x: number, y: number, z: number) => `${x},${y},${z}`;
    const index = new Map<string, number>();
    const k = Math.floor(r / STEP);
    for (let x = -k; x <= k; x++)
      for (let y = -k; y <= k; y++)
        for (let z = -k; z <= k; z++) {
          const v = new THREE.Vector3(x * STEP, y * STEP, z * STEP);
          if (v.length() <= r) {
            index.set(key(x, y, z), pts.length);
            pts.push(v);
          }
        }
    const seg: number[] = [];
    for (const [s, i] of index) {
      const [x, y, z] = s.split(",").map(Number) as [number, number, number];
      for (const [dx, dy, dz] of [
        [1, 0, 0],
        [0, 1, 0],
        [0, 0, 1],
      ] as const) {
        const j = index.get(key(x + dx, y + dy, z + dz));
        if (j === undefined) continue;
        const a = pts[i]!;
        const b = pts[j]!;
        seg.push(a.x, a.y, a.z, b.x, b.y, b.z);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(seg, 3));
    return { nodes: pts, edges: g };
  }, []);
  const lineMat = useMemo(
    () => new THREE.LineBasicMaterial({ transparent: true, depthWrite: false, toneMapped: false }),
    [],
  );
  const nodeMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        emissiveIntensity: 1.4,
        metalness: 0.2,
        roughness: 0.35,
        transparent: true,
        depthWrite: false,
        toneMapped: false,
      }),
    [],
  );
  const inst = useRef<THREE.InstancedMesh>(null);
  const group = useRef<THREE.Group>(null);
  const placed = useRef(false);
  useFrame(() => {
    const L = look.current;
    if (!L || !L.active) return;
    const m = inst.current;
    if (m && !placed.current) {
      const o = new THREE.Object3D();
      nodes.forEach((p, i) => {
        o.position.copy(p);
        o.updateMatrix();
        m.setMatrixAt(i, o.matrix);
      });
      m.instanceMatrix.needsUpdate = true;
      placed.current = true;
    }
    // In with the morph (stage 3), a touch after the particles start snapping in.
    const k = Math.max(0, Math.min(1, (L.morph - 0.35) / 0.65)) * L.dim("swarm");
    lineMat.color.copy(L.swarmB);
    lineMat.opacity = 0.55 * k;
    lineMat.visible = k > 0.01;
    nodeMat.color.copy(L.swarmB);
    nodeMat.emissive.copy(L.swarmB);
    nodeMat.opacity = k;
    if (m) m.visible = k > 0.01;
    if (group.current) group.current.position.y = L.lift;
  });
  return (
    <group ref={group}>
      <lineSegments geometry={edges} material={lineMat} />
      <instancedMesh ref={inst} args={[undefined, nodeMat, nodes.length]} frustumCulled={false}>
        <icosahedronGeometry args={[0.045, 1]} />
      </instancedMesh>
    </group>
  );
}
