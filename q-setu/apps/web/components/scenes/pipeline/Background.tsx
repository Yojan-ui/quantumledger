"use client";

/**
 * Behind everything: a dark grid floor fading into the fog, and a faint skyline of thin towers made
 * of dots (5–8% opacity) that rise slowly as the pipeline secures the system.
 */
import { useFrame } from "@react-three/fiber";
import { useMemo } from "react";
import * as THREE from "three";
import { rng } from "./geometry";
import type { Look } from "./look";

const TOWERS = 46;
const DOTS = 24;

export function Background({ look, progress }: { look: React.RefObject<Look>; progress: number }) {
  const towers = useMemo(() => {
    const r = rng(23);
    const base = new Float32Array(TOWERS * DOTS * 3);
    const h = Array.from({ length: TOWERS }, () => 2 + r() * 5);
    let k = 0;
    for (let i = 0; i < TOWERS; i++) {
      const x = -22 + (44 * i) / TOWERS + (r() - 0.5);
      const z = -15 - r() * 9;
      for (let j = 0; j < DOTS; j++) base.set([x, (j / DOTS) * h[i]!, z], k++ * 3);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(base.slice(), 3));
    const m = new THREE.PointsMaterial({
      size: 0.06,
      transparent: true,
      depthWrite: false,
      toneMapped: false,
    });
    return { g, m, base };
  }, []);
  const grid = useMemo(() => {
    const g = new THREE.GridHelper(80, 80);
    const m = g.material as THREE.LineBasicMaterial;
    m.transparent = true;
    m.depthWrite = false;
    return g;
  }, []);
  const scale = useMemo(() => ({ v: 0.4 }), []);
  useFrame(() => {
    const L = look.current;
    if (!L?.active) return;
    // Towers rise from 40% to full height as stages complete (slowly; at once under reduced motion).
    const target = 0.4 + 0.6 * progress;
    scale.v += (target - scale.v) * (L.reduce ? 1 : 0.01);
    const p = towers.g.attributes.position!.array as Float32Array;
    for (let i = 1; i < p.length; i += 3) p[i] = towers.base[i]! * scale.v - 2.2;
    towers.g.attributes.position!.needsUpdate = true;
    towers.m.color.copy(L.c.text).lerp(L.c.ok, progress >= 1 ? 1 : 0);
    towers.m.opacity = 0.065;
    const gm = grid.material as THREE.LineBasicMaterial;
    gm.color.copy(L.c.text3);
    gm.opacity = 0.1;
  });
  return (
    <>
      <primitive object={grid} position={[0, -2.2, 0]} />
      <points geometry={towers.g} material={towers.m} frustumCulled={false} />
    </>
  );
}
