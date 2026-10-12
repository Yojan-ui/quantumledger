"use client";

/**
 * Q-Day, as one shock wave: the classical packet (RSA key transport) breaks into 40 glass shards with
 * saffron edges and drifts apart; the QuantumLedger packet (ML-KEM) only refracts the wave, a ripple through
 * its glass, and stays whole. Plays once on Q-Day, in under 1.2 s; `still` shows the end state.
 */
import { MeshTransmissionMaterial, PerspectiveCamera } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { easeToken } from "@/lib/ease";
import { palette } from "@/components/world/palette";

const SHARDS = 40;
const DURATION = 1150;

export default function QDayShatter({
  qday,
  still,
  active,
}: {
  qday: boolean;
  still: boolean;
  active: boolean;
}) {
  const c = useMemo(palette, []);
  // Each packet sits over its label (the quarter points of the strip).
  // Visible width at z = 0 for this View's own aspect (camera at z 4.6, fov 35°).
  const size = useThree((s) => s.size);
  const visibleW =
    2 * 4.6 * Math.tan((35 / 2) * (Math.PI / 180)) * (size.width / Math.max(1, size.height));
  const X = Math.min(3.2, visibleW / 4);
  const at = useRef(0);
  const classical = useRef<THREE.Mesh>(null);
  const qsetu = useRef<THREE.Mesh>(null);
  const glass = useRef<THREE.InstancedMesh>(null);
  const edges = useRef<THREE.InstancedMesh>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mtm = useRef<any>(null);
  const o = useMemo(() => new THREE.Object3D(), []);
  const boxEdges = useMemo(() => new THREE.EdgesGeometry(new THREE.BoxGeometry(0.9, 0.9, 0.9)), []);
  const shardGeo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute(
      "position",
      new THREE.Float32BufferAttribute([0, 0.12, 0, -0.08, -0.06, 0, 0.09, -0.07, 0.02], 3),
    );
    g.computeVertexNormals();
    return g;
  }, []);
  // Each shard: a start point inside the packet, a drift direction and a spin.
  const shards = useMemo(
    () =>
      Array.from({ length: SHARDS }, (_, i) => {
        const r = (k: number) => Math.sin(i * 12.9898 + k * 78.233) * 0.5;
        const start = new THREE.Vector3(r(1) * 0.5, r(2) * 0.5, r(3) * 0.5);
        return {
          start,
          dir: start
            .clone()
            .normalize()
            .multiplyScalar(0.9 + Math.abs(r(4))),
          spin: new THREE.Euler(r(5) * 6, r(6) * 6, r(7) * 6),
        };
      }),
    [],
  );

  useEffect(() => {
    at.current = qday ? performance.now() : 0;
  }, [qday]);

  useFrame(({ clock }) => {
    if (!active) return;
    const t = qday ? (still ? 1 : Math.min(1, (performance.now() - at.current) / DURATION)) : 0;
    const e = easeToken(t);
    if (classical.current) {
      classical.current.visible = !qday;
      classical.current.rotation.y = 0.5 + clock.elapsedTime * 0.12;
    }
    if (qsetu.current) {
      qsetu.current.rotation.y = -0.5 - clock.elapsedTime * 0.12;
      // The shock wave passes through the glass: a brief ripple, then calm.
      const wave = qday && !still ? Math.sin(Math.PI * t) : 0;
      qsetu.current.scale.setScalar(1 + 0.04 * wave);
      if (mtm.current) mtm.current.distortion = 0.1 + 0.9 * wave;
    }
    const g = glass.current;
    const ed = edges.current;
    if (!g || !ed) return;
    g.visible = ed.visible = qday;
    shards.forEach((s, i) => {
      o.position
        .copy(s.start)
        .addScaledVector(s.dir, e)
        .add(new THREE.Vector3(-X, 0, 0));
      o.rotation.set(s.spin.x * e, s.spin.y * e, s.spin.z * e);
      o.scale.setScalar(1 - 0.35 * e);
      o.updateMatrix();
      g.setMatrixAt(i, o.matrix);
      ed.setMatrixAt(i, o.matrix);
    });
    g.instanceMatrix.needsUpdate = ed.instanceMatrix.needsUpdate = true;
    (ed.material as THREE.MeshBasicMaterial).opacity = 0.9 - 0.5 * e;
  });

  return (
    <>
      <PerspectiveCamera makeDefault position={[0, 0, 4.6]} fov={35} />
      <ambientLight intensity={0.8} />
      <directionalLight position={[2, 3, 4]} intensity={1.2} />
      <mesh ref={classical} position={[-X, 0, 0]}>
        <boxGeometry args={[0.9, 0.9, 0.9]} />
        <meshBasicMaterial color={c.warn} wireframe transparent opacity={0.7} />
      </mesh>
      <instancedMesh ref={glass} args={[shardGeo, undefined, SHARDS]} visible={false}>
        <meshPhysicalMaterial
          color={c.text}
          transparent
          opacity={0.12}
          roughness={0}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </instancedMesh>
      <instancedMesh ref={edges} args={[shardGeo, undefined, SHARDS]} visible={false}>
        <meshBasicMaterial color={c.warn} wireframe transparent opacity={0.9} />
      </instancedMesh>
      <mesh ref={qsetu} position={[X, 0, 0]}>
        <boxGeometry args={[0.9, 0.9, 0.9]} />
        <MeshTransmissionMaterial
          ref={mtm}
          color={c.kem}
          thickness={0.6}
          roughness={0.05}
          transmission={1}
          ior={1.25}
          chromaticAberration={0.04}
          distortion={0.1}
          distortionScale={0.4}
          temporalDistortion={0}
          samples={4}
          resolution={256}
          background={c.bg}
        />
        {/* KEM edges: the packet that stays whole reads as encrypted. */}
        <lineSegments geometry={boxEdges}>
          <lineBasicMaterial color={c.kem} transparent opacity={0.85} toneMapped={false} />
        </lineSegments>
      </mesh>
    </>
  );
}
