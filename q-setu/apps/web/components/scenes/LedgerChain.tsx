"use client";

/**
 * The Q-Ledger as 12 blocks linked by SIG lines (each link is a hash + ML-DSA signature). When an entry
 * is edited, its block turns DANGER and every link after it dims and drops 4px in a 60 ms cascade:
 * nothing after the edit can be trusted. Verifying a restored chain lifts them back.
 */
import { OrthographicCamera } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { easeToken } from "@/lib/ease";
import { palette } from "@/components/world/palette";

const N = 12;

export default function LedgerChain({
  brokenIndex,
  still,
  active,
}: {
  /** Index (0–11) of the edited block, or -1 when the chain verifies. */
  brokenIndex: number;
  still: boolean;
  active: boolean;
}) {
  const c = useMemo(palette, []);
  const size = useThree((s) => s.size);
  const blocks = useRef<THREE.InstancedMesh>(null);
  const links = useRef<THREE.LineSegments>(null);
  const o = useMemo(() => new THREE.Object3D(), []);
  const col = useMemo(() => new THREE.Color(), []);
  const changedAt = useRef(0);
  const last = useRef(-2);
  const drop = useRef(new Float32Array(N));
  const dim = useRef(new Float32Array(N));
  const linkGeo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array((N - 1) * 6), 3));
    g.setAttribute("color", new THREE.BufferAttribute(new Float32Array((N - 1) * 6), 3));
    return g;
  }, []);

  useFrame(({ clock }, dt) => {
    if (!active) return;
    if (brokenIndex !== last.current) {
      last.current = brokenIndex;
      changedAt.current = performance.now();
    }
    const W = size.width;
    const gap = W / (N + 1);
    // 4px in this orthographic view is exactly 4 units.
    const since = performance.now() - changedAt.current;
    const pos = linkGeo.attributes.position!.array as Float32Array;
    const lc = linkGeo.attributes.color!.array as Float32Array;
    const p = new THREE.Vector3();
    const prev = new THREE.Vector3();
    for (let i = 0; i < N; i++) {
      const after = brokenIndex >= 0 && i > brokenIndex;
      // Cascade: block i starts moving 60 ms after block i-1.
      const delay = brokenIndex >= 0 ? (i - brokenIndex) * 60 : (N - i) * 30;
      const k = still ? 1 : easeToken(Math.min(1, Math.max(0, (since - delay) / 300)));
      const targetDrop = after ? 4 : 0;
      const targetDim = after ? 1 : 0;
      drop.current[i] = still
        ? targetDrop
        : drop.current[i]! + (targetDrop - drop.current[i]!) * k * Math.min(1, dt * 12);
      dim.current[i] = still
        ? targetDim
        : dim.current[i]! + (targetDim - dim.current[i]!) * k * Math.min(1, dt * 12);
      // Slow drift: one cycle every 8 s, a few pixels.
      const drift = still ? 0 : Math.sin(clock.elapsedTime * ((2 * Math.PI) / 8) + i * 0.6) * 3;
      p.set(-W / 2 + gap * (i + 1), drift - drop.current[i]!, 0);
      o.position.copy(p);
      o.rotation.set(0.5, 0.6, 0);
      o.scale.setScalar(Math.min(22, gap * 0.42));
      o.updateMatrix();
      blocks.current?.setMatrixAt(i, o.matrix);
      if (i === brokenIndex) col.copy(c.danger);
      else col.copy(c.text3).lerp(c.bg, 0.6 * dim.current[i]!);
      blocks.current?.setColorAt(i, col);
      if (i > 0) {
        const j = (i - 1) * 6;
        pos.set([prev.x + gap * 0.25, prev.y, 0, p.x - gap * 0.25, p.y, 0], j);
        const d = Math.max(dim.current[i]!, i === brokenIndex ? 1 : 0);
        col.copy(c.sig).lerp(c.bg, 0.75 * d);
        lc.set([col.r, col.g, col.b, col.r, col.g, col.b], j);
      }
      prev.copy(p);
    }
    if (blocks.current) {
      blocks.current.instanceMatrix.needsUpdate = true;
      if (blocks.current.instanceColor) blocks.current.instanceColor.needsUpdate = true;
    }
    linkGeo.attributes.position!.needsUpdate = true;
    linkGeo.attributes.color!.needsUpdate = true;
  });

  return (
    <>
      <OrthographicCamera makeDefault position={[0, 0, 100]} zoom={1} />
      <instancedMesh ref={blocks} args={[undefined, undefined, N]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial wireframe toneMapped={false} />
      </instancedMesh>
      <lineSegments ref={links} geometry={linkGeo}>
        <lineBasicMaterial vertexColors toneMapped={false} />
      </lineSegments>
    </>
  );
}
