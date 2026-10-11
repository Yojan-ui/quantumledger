"use client";

/**
 * The home-page scan's arc: from the scanned server's region to Mumbai (or New Delhi), drawn on over 700 ms in
 * saffron (classical key exchange) or the accent (hybrid post-quantum).
 */
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { easeToken } from "./director";
import { arcPoints, CITIES, toVec3 } from "./geo";
import { palette } from "./palette";
import { world } from "./store";

const SEG = 96;

export function ScanArc() {
  const c = useMemo(palette, []);
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array((SEG + 1) * 3), 3));
    return g;
  }, []);
  const mat = useMemo(
    () =>
      new THREE.LineBasicMaterial({
        color: c.warn.clone(),
        transparent: true,
        opacity: 0,
        depthWrite: false,
      }),
    [c],
  );
  const line = useMemo(() => new THREE.Line(geo, mat), [geo, mat]);
  const shown = useRef(0);

  useFrame(() => {
    const s = world.scan;
    const on = !!s && world.scanActive;
    if (!on) {
      mat.opacity = Math.max(0, mat.opacity - 0.05);
      return;
    }
    if (shown.current !== s.at) {
      shown.current = s.at;
      // Link the server to Indian users: Mumbai, or New Delhi if the server is already near Mumbai.
      const nearMumbai = Math.hypot(s.lat - CITIES.mumbai[0], s.lon - CITIES.mumbai[1]) < 4;
      const to = nearMumbai ? CITIES.delhi : CITIES.mumbai;
      const pts = arcPoints(toVec3(s.lat, s.lon), toVec3(to[0], to[1]), SEG);
      const a = geo.attributes.position!.array as Float32Array;
      pts.forEach((p, i) => a.set([p.x, p.y, p.z], i * 3));
      geo.attributes.position!.needsUpdate = true;
      geo.computeBoundingSphere();
      mat.color.copy(s.ok ? c.accent : c.warn);
    }
    // Reduced motion (no breathing) draws the arc at once.
    const t = world.breathe ? Math.min(1, (performance.now() - s.at) / 700) : 1;
    geo.setDrawRange(0, Math.max(2, Math.round(easeToken(t) * (SEG + 1))));
    mat.opacity = 0.9;
  });

  return <primitive object={line} />;
}
