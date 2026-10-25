"use client";

/**
 * Q-Day, as one shock wave: the classical packet (RSA key transport) trembles and squeezes for a
 * beat (the wind-up), then breaks into 40 glass shards with saffron edges. Each shard has its own
 * velocity and spin and falls under light gravity with drag (lib/motion ballistics, closed form), and
 * time slows around the impact (1 → 0.2 → 1). The QuantumLedger packet (ML-KEM) takes the shock wave
 * as a wobble (it lurches and rings down) and stays whole. Plays once on Q-Day in 2 s; `still` shows
 * the end state.
 */
import { MeshTransmissionMaterial, PerspectiveCamera } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { burst, piece, sceneTime, wobble } from "@/lib/motion";
import { palette } from "@/components/world/palette";
import { Thicken } from "@/components/scenes/Thicken";

const SHARDS = 40;
const DURATION = 2000;
/** The wind-up before the break, and the impact (s). */
const IMPACT = 0.18;
/** The shock reaches the QuantumLedger packet after crossing the gap (s). */
const SHOCK_DELAY = 0.12;

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
  // Each shard: a start point inside the packet, a velocity and a spin (deterministic).
  const shards = useMemo(() => burst(SHARDS, 0.25, 11, 1.5), []);
  const rot = useMemo(() => new THREE.Euler(), []);

  useEffect(() => {
    at.current = qday ? performance.now() : 0;
  }, [qday]);

  useFrame(({ clock }) => {
    if (!active) return;
    // Real seconds since Q-Day, and scene seconds since the impact (slowed around it).
    const t = qday ? (still ? DURATION / 1000 : (performance.now() - at.current) / 1000) : 0;
    const tau = qday ? sceneTime(t, IMPACT) - sceneTime(IMPACT, IMPACT) : 0;
    const e = Math.min(1, Math.max(0, tau / 0.9));
    const broken = qday && t >= IMPACT;
    if (classical.current) {
      classical.current.visible = !broken;
      classical.current.rotation.y = 0.5 + clock.elapsedTime * 0.12;
      // The wind-up: it trembles and squeezes as the wave arrives.
      const w = qday && !still ? Math.min(1, t / IMPACT) : 0;
      classical.current.scale.set(1 + 0.06 * w, 1 - 0.1 * w, 1 + 0.06 * w);
      classical.current.position.x = -X + (w > 0 ? Math.sin(t * 90) * 0.02 * w : 0);
    }
    if (qsetu.current) {
      qsetu.current.rotation.y = -0.5 - clock.elapsedTime * 0.12;
      // The shock wave: a lurch away from the break, then a damped ring-down to calm.
      const k = qday && !still ? wobble(t - IMPACT - SHOCK_DELAY, 2.4, 3.5) : 0;
      qsetu.current.scale.setScalar(1 + 0.06 * k);
      qsetu.current.position.x = X + 0.08 * Math.max(0, k);
      qsetu.current.rotation.z = 0.06 * k;
      if (mtm.current) mtm.current.distortion = 0.1 + 0.9 * Math.abs(k);
    }
    const g = glass.current;
    const ed = edges.current;
    if (!g || !ed) return;
    g.visible = ed.visible = broken;
    shards.forEach((s, i) => {
      piece(s, tau, o.position, rot);
      o.position.x -= X;
      o.rotation.copy(rot);
      o.scale.setScalar(1 - 0.35 * e);
      o.updateMatrix();
      g.setMatrixAt(i, o.matrix);
      ed.setMatrixAt(i, o.matrix);
    });
    g.instanceMatrix.needsUpdate = ed.instanceMatrix.needsUpdate = true;
    (ed.material as THREE.MeshBasicMaterial).opacity = 0.9 - 0.5 * e;
  });

  return (
    <Thicken>
      <PerspectiveCamera makeDefault position={[0, 0, 4.6]} fov={35} />
      <ambientLight intensity={0.8} />
      <directionalLight position={[2, 3, 4]} intensity={1.2} />
      <mesh ref={classical} position={[-X, 0, 0]}>
        <boxGeometry args={[0.9, 0.9, 0.9]} />
        <meshBasicMaterial color={c.warn} wireframe transparent depthWrite={false} opacity={0.7} />
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
        <meshBasicMaterial color={c.warn} wireframe transparent depthWrite={false} opacity={0.9} />
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
          <lineBasicMaterial
            color={c.kem}
            transparent
            depthWrite={false}
            opacity={0.85}
            toneMapped={false}
          />
        </lineSegments>
      </mesh>
    </Thicken>
  );
}
