"use client";

/**
 * The ledger core: a small iridescent glass gem standing on the QuantumLedger node (Mumbai), where the
 * audience's packets land. drei's MeshTransmissionMaterial on three's own transmission pass
 * (transmissionSampler: no extra scene render), with chromatic dispersion kept low and a KEM tint.
 * It turns slowly; under reduced motion it holds still.
 */
import { Environment, Lightformer, MeshTransmissionMaterial } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import type * as THREE from "three";
import { HUB } from "@/data/room";
import { toVec3 } from "./geo";
import { palette } from "./palette";
import { world } from "./store";

export function LedgerCore() {
  const c = useMemo(palette, []);
  const g = useRef<THREE.Group>(null);
  const m = useRef<THREE.Mesh>(null);
  const at = useMemo(() => toVec3(HUB[0], HUB[1], 1.03), []);
  useFrame((_, dt) => {
    if (!g.current || !m.current) return;
    g.current.position.copy(at);
    g.current.lookAt(at.clone().multiplyScalar(2));
    g.current.visible = !world.index && world.mode !== "deploy";
    if (world.breathe) m.current.rotation.z += dt * 0.6;
  });
  return (
    <>
      {/* Local light cards for the glass to refract (no HDR download; only PBR materials use it). */}
      <Environment resolution={64}>
        <Lightformer
          form="rect"
          intensity={3}
          color={c.kem}
          position={[0, 2, 3]}
          scale={[4, 1, 1]}
        />
        <Lightformer
          form="rect"
          intensity={2}
          color={c.sig}
          position={[-3, -1, 2]}
          scale={[2, 2, 1]}
        />
        <Lightformer form="ring" intensity={2} color={c.text} position={[3, 1, -2]} scale={2} />
      </Environment>
      <group ref={g}>
        <mesh ref={m} rotation={[Math.PI / 2, 0, 0]}>
          <octahedronGeometry args={[0.035, 0]} />
          <MeshTransmissionMaterial
            transmissionSampler
            transmission={1}
            thickness={0.4}
            roughness={0.08}
            ior={1.4}
            chromaticAberration={0.04}
            anisotropicBlur={0.05}
            iridescence={1}
            iridescenceIOR={1.3}
            iridescenceThicknessRange={[100, 400]}
            color={c.kem}
            attenuationColor={c.sig}
            attenuationDistance={0.6}
            emissive={c.kem}
            emissiveIntensity={0.25}
            backside
            backsideThickness={0.2}
            toneMapped={false}
          />
        </mesh>
      </group>
    </>
  );
}
