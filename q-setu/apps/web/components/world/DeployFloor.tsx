"use client";

/**
 * Demo 2 only: the dotted globe stands over a dark reflective floor (drei MeshReflectorMaterial,
 * blurred), so its glowing nodes and arcs reflect beneath it. Mounted only in deploy mode, so no
 * other page pays for the reflection pass; the budget drops it on slow devices and phones.
 */
import { MeshReflectorMaterial } from "@react-three/drei";
import { useMemo } from "react";
import { useBudget } from "@/components/fx/budget";
import { palette } from "./palette";
import { useWorld } from "./store";

export function DeployFloor() {
  const deploy = useWorld((w) => w.mode === "deploy");
  const b = useBudget();
  const c = useMemo(palette, []);
  const floor = useMemo(() => c.bg.clone().lerp(c.text3, 0.04), [c]);
  if (!deploy || b.reflect === 0) return null;
  return (
    <>
      <ambientLight intensity={0.6} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.22, 0]} renderOrder={-5}>
        <circleGeometry args={[9, 96]} />
        <MeshReflectorMaterial
          resolution={Math.min(384, b.reflect)}
          blur={[400, 120]}
          mixBlur={1}
          mixStrength={2.2}
          mixContrast={1.15}
          roughness={0.95}
          depthScale={0.8}
          minDepthThreshold={0.3}
          maxDepthThreshold={1.5}
          color={floor}
          metalness={0.5}
          mirror={0.6}
          transparent
        />
      </mesh>
    </>
  );
}
