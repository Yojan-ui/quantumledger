"use client";

/**
 * "How it works", in one object: the client's lattice cube sends a KEM packet (ML-KEM ciphertext),
 * the server answers with a SIG ring (its ML-DSA signature), and when the shared key is derived the
 * two key halves attract like magnets: a small wind-up apart, then they close on an accelerating
 * curve (faster the nearer they get), fuse with a squash-and-settle, and the OK pulse shoves the dust
 * around them outward before it drifts back. `progress` (0–1) is scrubbed by scroll, so every motion
 * here is a function of progress (a replay maps 2.8 s onto it).
 */
import { PerspectiveCamera } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { easeToken } from "@/lib/ease";
import { palette } from "@/components/world/palette";
import { latticeCube, span } from "./geometry";
import { Thicken } from "@/components/scenes/Thicken";
import { PushDust } from "@/components/scenes/PushDust";
import { wobble } from "@/lib/motion";
import { useReducedMotion } from "@/lib/client/motion";

/** Progress → seconds, for the springs (a replay runs the whole scene in 2.8 s). */
const SECONDS = 2.8;
const CONTACT = 0.84;

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
    () =>
      new THREE.LineBasicMaterial({
        color: c.text3.clone(),
        transparent: true,
        depthWrite: false,
        opacity: 0.9,
      }),
    [c],
  );
  const matB = useMemo(
    () =>
      new THREE.LineBasicMaterial({
        color: c.text3.clone(),
        transparent: true,
        depthWrite: false,
        opacity: 0.9,
      }),
    [c],
  );
  const shown = useRef(progress);
  const at = useRef(0);
  const reduce = useReducedMotion();

  useFrame((_, dt) => {
    if (!active) return;
    // A replay runs 0 → 1 over 2.8 s; otherwise follow the scroll, eased (no jumps).
    const replay = replayAt ? (performance.now() - replayAt) / 2800 : 2;
    const target = replay < 1 ? replay : progress;
    shown.current += (target - shown.current) * Math.min(1, dt * 6);
    const p = replay < 1 ? replay : shown.current;
    at.current = p;

    const send = easeToken(span(p, 0.08, 0.34));
    const answer = easeToken(span(p, 0.36, 0.6));
    // Magnetic: a wind-up apart (0.62–0.66), then an accelerating close (cubic) to contact.
    const windup = Math.sin(Math.PI * span(p, 0.62, 0.66)) * 0.08;
    const lock = span(p, 0.66, CONTACT) ** 3;
    const done = span(p, CONTACT, 1);
    // The fuse: a squash on contact that settles (a damped wobble in "seconds" of progress).
    const fuse = p > CONTACT ? wobble((p - CONTACT) * SECONDS, 3.2, 5) : 0;

    if (client.current && server.current) {
      client.current.position.x = -1.7 - windup + 1.38 * lock;
      server.current.position.x = 1.7 + windup - 1.38 * lock;
      client.current.scale.set(1 - 0.08 * fuse, 1 + 0.06 * fuse, 1 + 0.06 * fuse);
      server.current.scale.copy(client.current.scale);
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
    <Thicken>
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
      <PushDust
        color={c.ok}
        count={120}
        inner={0.7}
        outer={1.9}
        opacity={0.35}
        reduce={reduce}
        since={() => (at.current > CONTACT ? (at.current - CONTACT) * SECONDS : -1)}
      />
      <mesh ref={pulse} visible={false}>
        <ringGeometry args={[0.48, 0.5, 64]} />
        <meshBasicMaterial color={c.ok} transparent depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
    </Thicken>
  );
}
