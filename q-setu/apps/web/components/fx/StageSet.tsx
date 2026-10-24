"use client";

/**
 * The set every demo stage stands on: a dark reflective floor (drei MeshReflectorMaterial, blurred,
 * fading into the fog), soft contact shadows, a volumetric cone of light from above, and the lights
 * the floor needs. The budget drops the reflection and the shadows on slow devices and phones.
 */
import { ContactShadows, MeshReflectorMaterial } from "@react-three/drei";
import { useMemo } from "react";
import * as THREE from "three";
import { palette } from "@/components/world/palette";
import { useBudget } from "./budget";
import { lightCone } from "./materials";

export function StageSet({
  y = -1.2,
  cone = true,
  coneColor,
  coneAt = [0, 0],
  coneStrength = 0.16,
}: {
  y?: number;
  cone?: boolean;
  coneColor?: THREE.Color;
  coneAt?: [number, number];
  coneStrength?: number;
}) {
  const c = useMemo(palette, []);
  const b = useBudget();
  // The floor: the page's own background, a touch lifted so its reflections read.
  const floor = useMemo(() => c.bg.clone().lerp(c.text3, 0.05), [c]);
  const coneMat = useMemo(
    () => lightCone(coneColor ?? c.text, coneStrength),
    [c, coneColor, coneStrength],
  );
  return (
    <>
      <ambientLight intensity={0.35} />
      <directionalLight position={[3, 6, 4]} intensity={1.0} />
      <spotLight
        position={[coneAt[0], y + 7, coneAt[1]]}
        angle={0.45}
        penumbra={0.8}
        intensity={30}
        distance={14}
        color={coneColor ?? c.text}
      />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, y, 0]}>
        <planeGeometry args={[60, 60]} />
        {b.reflect > 0 ? (
          <MeshReflectorMaterial
            resolution={b.reflect}
            blur={[320, 90]}
            mixBlur={1}
            mixStrength={1.6}
            mixContrast={1.1}
            roughness={0.9}
            depthScale={1.2}
            minDepthThreshold={0.35}
            maxDepthThreshold={1.4}
            color={floor}
            metalness={0.55}
            mirror={0.55}
          />
        ) : (
          <meshStandardMaterial color={floor} roughness={0.85} metalness={0.4} />
        )}
      </mesh>
      {b.shadows && (
        <ContactShadows
          position={[0, y + 0.005, 0]}
          scale={16}
          blur={2.6}
          far={4}
          opacity={0.6}
          resolution={256}
          color="black"
        />
      )}
      {cone && (
        <mesh position={[coneAt[0], y + 3.6, coneAt[1]]} material={coneMat}>
          <coneGeometry args={[2.8, 7.2, 48, 1, true]} />
        </mesh>
      )}
    </>
  );
}
