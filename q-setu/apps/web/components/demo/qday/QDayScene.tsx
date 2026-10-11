"use client";

/**
 * Demo 3 scene (rendered through a <View> into the site's single canvas): the adversary as a quiet
 * wireframe at the centre, recorded packets drifting in from both sides, a thin timeline ring, and
 * at Q-Day a faint lattice shield that the Q-Setu packets turn back from.
 */
import { PerspectiveCamera } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { palette } from "@/components/world/palette";

const MAX = 24;

interface Flight {
  side: -1 | 1;
  t: number;
  y: number;
  bounce: boolean;
}

function Ring({
  progress,
  color,
  track,
}: {
  progress: number;
  color: THREE.Color;
  track: THREE.Color;
}) {
  const arc = useMemo(() => new THREE.TorusGeometry(1.6, 0.006, 6, 160), []);
  const fill = useMemo(
    () => new THREE.TorusGeometry(1.6, 0.012, 6, 160, Math.max(0.001, progress) * Math.PI * 2),
    [progress],
  );
  return (
    <group rotation={[0, 0, Math.PI / 2]}>
      <mesh geometry={arc}>
        <meshBasicMaterial color={track} transparent opacity={0.3} />
      </mesh>
      <mesh geometry={fill} scale={[-1, 1, 1]}>
        <meshBasicMaterial color={color} />
      </mesh>
    </group>
  );
}

export default function QDayScene({
  progress,
  qday,
  harvest,
}: {
  progress: number;
  qday: boolean;
  harvest: { classical: number; qsetu: number };
}) {
  const c = useMemo(palette, []);
  const flights = useRef<Flight[]>([]);
  const last = useRef(harvest);
  const mesh = useRef<THREE.InstancedMesh>(null);
  const orb = useRef<THREE.Mesh>(null);
  const shield = useRef<THREE.LineBasicMaterial>(null);
  const o = useMemo(() => new THREE.Object3D(), []);

  useEffect(() => {
    const add = (side: -1 | 1, n: number) => {
      for (let i = 0; i < Math.min(n, 3); i++)
        if (flights.current.length < MAX)
          flights.current.push({
            side,
            t: -i * 0.2,
            y: (Math.random() - 0.5) * 1.6,
            bounce: qday && side === 1,
          });
    };
    add(-1, harvest.classical - last.current.classical);
    add(1, harvest.qsetu - last.current.qsetu);
    last.current = harvest;
  }, [harvest, qday]);

  const shieldGeo = useMemo(() => {
    const pts: number[] = [];
    for (let y = -1.2; y <= 1.2; y += 0.3)
      for (let z = -0.6; z <= 0.6; z += 0.3)
        pts.push(0, y, z, 0, y + 0.3, z, 0, y, z, 0, y, z + 0.3);
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
    return g;
  }, []);

  useFrame((s, dt) => {
    if (orb.current) orb.current.rotation.y += dt * 0.05;
    if (shield.current)
      shield.current.opacity +=
        ((qday ? 0.5 : 0.08) - shield.current.opacity) * Math.min(1, dt * 2);
    const m = mesh.current;
    if (!m) return;
    flights.current.forEach((f) => (f.t += dt * 0.35));
    flights.current = flights.current.filter((f) => f.t < 1);
    for (let i = 0; i < MAX; i++) {
      const f = flights.current[i];
      if (!f) {
        o.scale.setScalar(0);
      } else {
        const t = f.bounce ? (f.t < 0.5 ? f.t : 1 - f.t) : f.t;
        o.position.set(f.side * (3 - t * 2.6), f.y * (1 - t), 0);
        o.scale.setScalar(f.t > 0 && f.t < 0.95 ? 0.05 : 0);
        m.setColorAt(i, c.text);
      }
      o.updateMatrix();
      m.setMatrixAt(i, o.matrix);
    }
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
    void s;
  });

  return (
    <>
      <PerspectiveCamera makeDefault position={[0, 0, 6]} fov={45} />
      <color attach="background" args={[c.bg]} />
      <mesh ref={orb}>
        <icosahedronGeometry args={[0.55, 1]} />
        <meshBasicMaterial color={qday ? c.text : c.text3} wireframe />
      </mesh>
      <Ring progress={progress} color={qday ? c.warn : c.text} track={c.text3} />
      <lineSegments geometry={shieldGeo} position={[2.2, 0, 0]}>
        <lineBasicMaterial ref={shield} color={c.accent} transparent opacity={0.08} />
      </lineSegments>
      <instancedMesh ref={mesh} args={[undefined, undefined, MAX]}>
        <boxGeometry args={[1.6, 1, 1]} />
        <meshBasicMaterial />
      </instancedMesh>
    </>
  );
}
