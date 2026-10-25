"use client";

/**
 * A solid, premium body inside a wireframe: glass (real transmission, low roughness, clearcoat) or
 * brushed dark metal, both lit by the scene's environment. It follows the wireframe's material each
 * frame (role colour as a tint, opacity, visibility), so a scene's existing choreography drives it.
 * Quality ladder (lib/client/gfx): at step 3, and always on phones, glass drops transmission and
 * falls back to a standard material.
 */
import { useFrame } from "@react-three/fiber";
import { useMemo } from "react";
import * as THREE from "three";
import { gfx } from "@/lib/client/gfx";
import { palette } from "@/components/world/palette";

const mobile = () => typeof window !== "undefined" && window.innerWidth < 768;

export function Body({
  geometry,
  like,
  kind = "glass",
  tint = 0.35,
  opacity = 0.9,
  position,
}: {
  geometry: THREE.BufferGeometry;
  /** The wireframe's material: colour, opacity and visibility are mirrored from it. */
  like: THREE.LineBasicMaterial;
  kind?: "glass" | "metal";
  /** How much of the role colour tints the body (0..1). */
  tint?: number;
  /** The body's opacity relative to the wireframe's. */
  opacity?: number;
  position?: THREE.Vector3 | [number, number, number];
}) {
  const c = useMemo(palette, []);
  const base = useMemo(
    () => (kind === "metal" ? c.bg.clone().lerp(c.text3, 0.4) : c.text),
    [kind, c],
  );
  const mat = useMemo(() => {
    if (kind === "metal")
      return new THREE.MeshStandardMaterial({
        color: c.bg.clone().lerp(c.text3, 0.4),
        metalness: 0.9,
        roughness: 0.3,
        envMapIntensity: 1.3,
        transparent: true,
        depthWrite: false,
      });
    return new THREE.MeshPhysicalMaterial({
      color: c.text.clone(),
      metalness: 0,
      roughness: 0.14,
      transmission: mobile() ? 0 : 0.9,
      thickness: 0.35,
      ior: 1.35,
      clearcoat: 1,
      clearcoatRoughness: 0.2,
      envMapIntensity: 1.3,
      transparent: true,
      depthWrite: false,
    });
  }, [kind, c]);
  useFrame(() => {
    mat.color.copy(base).lerp(like.color, tint);
    mat.opacity = (like.transparent ? like.opacity : 1) * opacity;
    mat.visible = like.visible && mat.opacity > 0.01;
    if (mat instanceof THREE.MeshPhysicalMaterial) {
      const t = gfx.quality >= 3 || mobile() ? 0 : 0.9;
      if (mat.transmission !== t) {
        mat.transmission = t;
        mat.needsUpdate = true;
      }
    }
  });
  return <mesh geometry={geometry} material={mat} position={position} renderOrder={-1} />;
}
