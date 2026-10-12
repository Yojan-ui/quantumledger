"use client";

/**
 * "How it works", in one object: the client's lattice cube sends a KEM packet (ML-KEM ciphertext),
 * the server answers with a SIG ring (its ML-DSA signature), and when the shared key is derived the
 * two cubes interlock into one, with an OK pulse. `progress` (0–1) is scrubbed by scroll.
 */
import { PerspectiveCamera } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { easeToken } from "@/lib/ease";
import { palette } from "@/components/world/palette";
import { latticeCube, span } from "./geometry";

export default function HandshakeCubes({
  progress,
  replayAt,
  active,
}: {
  progress: number;
  /** performance.now() of a click-to-replay, or 0. */
  replayAt: number;
  active: boolean;
}) {
  const c = useMemo(palette, []);
  const geo = useMemo(() => latticeCube(0.9, 3), []);
  const client = useRef<THREE.Group>(null);
  const server = useRef<THREE.Group>(null);
  const packet = useRef<THREE.Mesh>(null);
  const ring = useRef<THREE.Mesh>(null);
  const pulse = useRef<THREE.Mesh>(null);
  const matA = useMemo(
    () => new THREE.LineBasicMaterial({ color: c.text3.clone(), transparent: true, opacity: 0.9 }),
    [c],
  );
  const matB = useMemo(
    () => new THREE.LineBasicMaterial({ color: c.text3.clone(), transparent: true, opacity: 0.9 }),
    [c],
  );
  const shown = useRef(progress);

  useFrame((_, dt) => {
    if (!active) return;
    // A replay runs 0 → 1 over 2.8 s; otherwise follow the scroll, eased (no jumps).
    const replay = replayAt ? (performance.now() - replayAt) / 2800 : 2;
    const target = replay < 1 ? replay : progress;
    shown.current += (target - shown.current) * Math.min(1, dt * 6);
    const p = replay < 1 ? replay : shown.current;

    const send = easeToken(span(p, 0.08, 0.34));
    const answer = easeToken(span(p, 0.36, 0.6));
    const lock = easeToken(span(p, 0.62, 0.84));
    const done = span(p, 0.84, 1);

    if (client.current && server.current) {
      client.current.position.x = -1.7 + 1.38 * lock;
      server.current.position.x = 1.7 - 1.38 * lock;
      client.current.rotation.set(0.5, 0.6 + (Math.PI / 2) * send + (Math.PI / 4) * lock, 0);
      server.current.rotation.set(0.5, -0.6 - (Math.PI / 4) * lock, 0);
    }
    const toOk = done > 0 ? 1 : 0;
    matA.color.lerp(toOk ? c.ok : c.text3, Math.min(1, dt * 4));
    matB.color.lerp(toOk ? c.ok : c.text3, Math.min(1, dt * 4));
    if (packet.current) {
      packet.current.visible = send > 0 && send < 1;
      packet.current.position.set(-1.2 + 2.4 * send, 0.15 * Math.sin(Math.PI * send), 0);
    }
    if (ring.current) {
      ring.current.visible = answer > 0 && answer < 1;
      ring.current.position.set(1.2 - 2.4 * answer, -0.15 * Math.sin(Math.PI * answer), 0);
      ring.current.rotation.y = Math.PI / 2;
    }
    if (pulse.current) {
      pulse.current.visible = done > 0 && done < 1;
      pulse.current.scale.setScalar(0.4 + 2.2 * easeToken(done));
      (pulse.current.material as THREE.MeshBasicMaterial).opacity = 0.8 * (1 - done);
    }
  });

  return (
    <>
      <PerspectiveCamera makeDefault position={[0, 0, 5.2]} fov={35} />
      <group ref={client}>
        <lineSegments geometry={geo} material={matA} />
      </group>
      <group ref={server}>
        <lineSegments geometry={geo} material={matB} />
      </group>
      <mesh ref={packet} visible={false}>
        <boxGeometry args={[0.16, 0.1, 0.1]} />
        <meshBasicMaterial color={c.kem} />
      </mesh>
      <mesh ref={ring} visible={false}>
        <torusGeometry args={[0.16, 0.012, 8, 48]} />
        <meshBasicMaterial color={c.sig} />
      </mesh>
      <mesh ref={pulse} visible={false}>
        <ringGeometry args={[0.48, 0.5, 64]} />
        <meshBasicMaterial color={c.ok} transparent side={THREE.DoubleSide} />
      </mesh>
    </>
  );
}
