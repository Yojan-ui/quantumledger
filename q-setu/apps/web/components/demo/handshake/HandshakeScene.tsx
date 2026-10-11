"use client";

/**
 * Demo 1 scene: Client and Server as glass nodes, curved tubes between them, and real handshake
 * packets travelling along them. A ring "seal" marks ML-DSA-signed packets; at step 3 a classical
 * half and a post-quantum half merge into one key; a tampered packet shatters on the seal.
 */
import { PerspectiveCamera } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { palette } from "@/components/world/palette";

/** Token colours, resolved once in the browser. */
let C: ReturnType<typeof palette> | undefined;
const col = () => (C ??= palette());

export type PacketKind = "hello" | "signed" | "finish" | "msg" | "attack";

export interface ScenePacket {
  id: string;
  dir: "c2s" | "s2c";
  kind: PacketKind;
  label: string;
  bytes: number;
  hex: string;
  alg: string;
  startedAt: number;
  durationMs: number;
}

const CLIENT = new THREE.Vector3(-3.1, 0, 0);
const SERVER = new THREE.Vector3(3.1, 0, 0);
const C2S = new THREE.CubicBezierCurve3(
  new THREE.Vector3(-2.3, 0.35, 0),
  new THREE.Vector3(-1, 1.9, 0.4),
  new THREE.Vector3(1, 1.9, 0.4),
  new THREE.Vector3(2.3, 0.35, 0),
);
const S2C = new THREE.CubicBezierCurve3(
  new THREE.Vector3(2.3, -0.35, 0),
  new THREE.Vector3(1, -1.9, 0.4),
  new THREE.Vector3(-1, -1.9, 0.4),
  new THREE.Vector3(-2.3, -0.35, 0),
);
const colorFor = (k: PacketKind) =>
  k === "signed" ? col().accent : k === "attack" ? col().warn : col().text;

function GlassNode({ position, keyed }: { position: THREE.Vector3; keyed: boolean }) {
  const inner = useRef<THREE.Mesh>(null);
  const edges = useMemo(() => new THREE.EdgesGeometry(new THREE.IcosahedronGeometry(0.85, 1)), []);
  useFrame((s, dt) => {
    if (!inner.current) return;
    inner.current.rotation.y += dt * 0.4;
    inner.current.rotation.x = Math.sin(s.clock.elapsedTime * 0.5) * 0.2;
    const m = inner.current.material as THREE.MeshBasicMaterial;
    m.color.lerp(keyed ? col().accent : col().text3, Math.min(1, dt * 3));
  });
  return (
    <group position={position}>
      {/* Glass shell: a faint body plus glowing facet edges (no environment map needed). */}
      <mesh>
        <icosahedronGeometry args={[0.85, 1]} />
        <meshPhysicalMaterial
          color={col().text}
          transparent
          opacity={0.08}
          roughness={0}
          clearcoat={1}
          depthWrite={false}
        />
      </mesh>
      <lineSegments geometry={edges}>
        <lineBasicMaterial color={col().text3} transparent opacity={0.6} toneMapped={false} />
      </lineSegments>
      <mesh ref={inner}>
        <octahedronGeometry args={[0.32, 0]} />
        <meshBasicMaterial color={col().text3} toneMapped={false} wireframe />
      </mesh>
    </group>
  );
}

function Tube({ curve, color }: { curve: THREE.Curve<THREE.Vector3>; color: THREE.Color }) {
  const geo = useMemo(() => new THREE.TubeGeometry(curve, 80, 0.008, 6, false), [curve]);
  return (
    <mesh geometry={geo}>
      <meshBasicMaterial color={color} transparent opacity={0.5} toneMapped={false} />
    </mesh>
  );
}

function Packet({ p, onHover }: { p: ScenePacket; onHover: (p?: ScenePacket) => void }) {
  const g = useRef<THREE.Group>(null);
  const seal = useRef<THREE.Mesh>(null);
  const shards = useRef<THREE.InstancedMesh>(null);
  const curve = p.dir === "c2s" ? C2S : S2C;
  const dirs = useMemo(
    () =>
      Array.from({ length: 14 }, () =>
        new THREE.Vector3(
          Math.random() - 0.5,
          Math.random() - 0.5,
          Math.random() - 0.5,
        ).normalize(),
      ),
    [],
  );
  const o = useMemo(() => new THREE.Object3D(), []);
  const size = p.kind === "msg" ? 0.07 : 0.11 + Math.min(0.14, p.bytes / 30000);

  useFrame(() => {
    const raw = (performance.now() - p.startedAt) / p.durationMs;
    // Attack packets stop at the client's seal (t = 0.9) and shatter.
    const stopAt = p.kind === "attack" ? 0.9 : 1;
    const t = Math.min(stopAt, Math.max(0, raw));
    const pos = curve.getPoint(t);
    if (g.current) {
      g.current.position.copy(pos);
      g.current.visible = raw >= 0 && !(p.kind === "attack" && raw > stopAt);
      if (p.kind === "msg" && raw > 1) g.current.visible = false;
    }
    if (seal.current) seal.current.scale.setScalar(raw < 0.12 ? 1 + (0.12 - raw) * 20 : 1); // snaps on
    if (shards.current) {
      const k = Math.max(0, raw - stopAt) * 6;
      shards.current.visible = p.kind === "attack" && raw > stopAt && k < 3;
      dirs.forEach((d, i) => {
        o.position.copy(curve.getPoint(stopAt)).addScaledVector(d, k * 0.6);
        o.rotation.set(k * 3 + i, k * 2, i);
        o.scale.setScalar(Math.max(0.0001, 0.06 * (1 - k / 3)));
        o.updateMatrix();
        shards.current!.setMatrixAt(i, o.matrix);
      });
      shards.current.instanceMatrix.needsUpdate = true;
    }
  });

  return (
    <>
      <group ref={g}>
        <mesh onPointerOver={() => onHover(p)} onPointerOut={() => onHover(undefined)}>
          <boxGeometry args={[size * 1.6, size, size]} />
          <meshBasicMaterial color={colorFor(p.kind)} toneMapped={false} />
        </mesh>
        {(p.kind === "signed" || p.kind === "attack") && (
          <mesh ref={seal}>
            <torusGeometry args={[size * 1.7, 0.012, 8, 48]} />
            <meshBasicMaterial
              color={p.kind === "attack" ? col().warn : col().accent}
              toneMapped={false}
            />
          </mesh>
        )}
      </group>
      {p.kind === "attack" && (
        <instancedMesh ref={shards} args={[undefined, undefined, 14]} visible={false}>
          <tetrahedronGeometry args={[1, 0]} />
          <meshBasicMaterial color={col().warn} toneMapped={false} />
        </instancedMesh>
      )}
    </>
  );
}

/** Two halves (classical + post-quantum) fly into each node and merge into one session key. */
function KeyMerge({ startedAt }: { startedAt: number }) {
  const parts = useRef<THREE.Group>(null);
  useFrame(() => {
    const t = Math.min(1, (performance.now() - startedAt) / 1400);
    const e = 1 - Math.pow(1 - t, 3);
    parts.current?.children.forEach((c, i) => {
      const node = i < 2 ? CLIENT : SERVER;
      const side = i % 2 === 0 ? -1 : 1;
      c.position.set(node.x + side * (1 - e) * 0.9, node.y + 1.2 - e * 1.2, 0.4);
      c.scale.setScalar(i % 2 === 0 ? 0.16 : 0.16);
      (c as THREE.Mesh).visible = t < 1;
    });
  });
  return (
    <group ref={parts}>
      {[0, 1, 2, 3].map((i) => (
        <mesh key={i}>
          <sphereGeometry args={[1, 16, 16, 0, Math.PI]} />
          <meshBasicMaterial
            color={i % 2 === 0 ? col().text : col().accent}
            toneMapped={false}
            side={THREE.DoubleSide}
          />
        </mesh>
      ))}
    </group>
  );
}

export default function HandshakeScene({
  packets,
  keyAt,
  keyed,
  onHover,
}: {
  packets: ScenePacket[];
  keyAt?: number;
  keyed: boolean;
  onHover: (p?: ScenePacket) => void;
}) {
  return (
    <>
      <PerspectiveCamera makeDefault position={[0, 0, 7.6]} fov={45} />
      <color attach="background" args={[col().bg]} />
      <ambientLight intensity={0.6} />
      <GlassNode position={CLIENT} keyed={keyed} />
      <GlassNode position={SERVER} keyed={keyed} />
      <Tube curve={C2S} color={col().text3} />
      <Tube curve={S2C} color={col().text3} />
      {packets.map((p) => (
        <Packet key={p.id} p={p} onHover={onHover} />
      ))}
      {keyAt && <KeyMerge startedAt={keyAt} />}
    </>
  );
}
