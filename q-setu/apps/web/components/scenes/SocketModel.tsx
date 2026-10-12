"use client";

/**
 * A small low-poly model per adapter, shown at the right of its row in the adapter list. It turns
 * slowly (one turn every ~10 s) only while its row is hovered, and lights in KEM: that adapter is
 * the socket encrypting traffic on the globe.
 */
import { PerspectiveCamera } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { palette } from "@/components/world/palette";

const SHAPES: Record<string, () => THREE.BufferGeometry> = {
  shield: () => new THREE.IcosahedronGeometry(0.7, 0), // a sidecar node in front of a server
  web: () => new THREE.TorusGeometry(0.55, 0.16, 6, 10), // a ring around the page
  sdk: () => new THREE.BoxGeometry(0.9, 0.9, 0.9, 1, 1, 1), // a package
  edge: () => new THREE.TetrahedronGeometry(0.75, 0), // a small device
  vault: () => new THREE.CylinderGeometry(0.55, 0.55, 0.9, 6, 2), // a database drum
};

export default function SocketModel({
  id,
  hot,
  active,
}: {
  id: string;
  hot: boolean;
  active: boolean;
}) {
  const c = useMemo(palette, []);
  const mesh = useRef<THREE.LineSegments>(null);
  const geo = useMemo(() => new THREE.EdgesGeometry((SHAPES[id] ?? SHAPES.sdk!)()), [id]);
  const mat = useMemo(
    () => new THREE.LineBasicMaterial({ color: c.text3.clone(), toneMapped: false }),
    [c],
  );
  useFrame((_, dt) => {
    if (!active || !mesh.current) return;
    if (hot) mesh.current.rotation.y += dt * 0.6;
    mat.color.lerp(hot ? c.kem : c.text3, Math.min(1, dt * 6));
  });
  return (
    <>
      <PerspectiveCamera makeDefault position={[0, 0, 3]} fov={40} />
      <lineSegments ref={mesh} geometry={geo} material={mat} rotation={[0.45, 0.6, 0]} />
    </>
  );
}
