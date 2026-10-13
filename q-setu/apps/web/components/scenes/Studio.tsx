"use client";

/**
 * A dark studio for the premium scenes: a procedural environment (Lightformers, so no HDRI download
 * and offline mode keeps working; never shown as a background), one key light, one rim light in the
 * scene's role colour, a soft contact shadow on the floor, and exponential fog for depth.
 */
import { ContactShadows, Environment, Lightformer } from "@react-three/drei";
import type * as THREE from "three";

export function Studio({
  rim,
  fog,
  floorY = -1.2,
  shadow = true,
}: {
  /** The rim light's role colour. */
  rim: THREE.Color;
  /** The page colour, for fog that fades into it. */
  fog: THREE.Color;
  floorY?: number;
  shadow?: boolean;
}) {
  return (
    <>
      <fogExp2 attach="fog" args={[fog, 0.055]} />
      <ambientLight intensity={0.15} />
      <directionalLight position={[4, 6, 5]} intensity={1.6} />
      <pointLight position={[-4, 2.5, -4]} intensity={30} distance={14} color={rim} />
      <Environment resolution={64} frames={1} background={false}>
        <Lightformer form="rect" intensity={2.2} position={[0, 4, 3]} scale={[8, 2, 1]} />
        <Lightformer
          form="rect"
          intensity={0.6}
          position={[-5, 1, 0]}
          rotation-y={Math.PI / 2}
          scale={[6, 2, 1]}
        />
        <Lightformer form="ring" intensity={1.4} color={rim} position={[4, 0.5, -3]} scale={2.4} />
      </Environment>
      {shadow && (
        <ContactShadows
          position={[0, floorY, 0]}
          opacity={0.55}
          scale={16}
          blur={2.4}
          far={4}
          resolution={256}
          frames={1}
        />
      )}
    </>
  );
}
