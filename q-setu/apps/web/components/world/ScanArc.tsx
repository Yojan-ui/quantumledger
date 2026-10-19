"use client";

/**
 * The home-page scan's arc: from the scanned server's region to Mumbai (or New Delhi), drawn on over 700 ms in
 * saffron (classical key exchange) or the accent (hybrid post-quantum). The server itself stands at
 * the arc's far end as a tower made of dots (a grid of points, rising as the arc draws on).
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
  // The server tower: a 4 × 4 × 12 grid of dots, standing on the surface along its normal.
  const tower = useMemo(() => {
    const pts: number[] = [];
    for (let y = 0; y < 12; y++)
      for (let x = 0; x < 4; x++)
        for (let z = 0; z < 4; z++)
          if (x === 0 || x === 3 || z === 0 || z === 3 || y % 3 === 0)
            pts.push((x - 1.5) / 1.5, y / 11, (z - 1.5) / 1.5);
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
    const m = new THREE.PointsMaterial({
      size: 2.4,
      sizeAttenuation: false,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      toneMapped: false,
    });
    const o = new THREE.Points(g, m);
    o.visible = false;
    return o;
  }, []);
  const up = useMemo(() => new THREE.Vector3(0, 1, 0), []);
  const shown = useRef(0);

  useFrame(() => {
    const s = world.scan;
    const on = !!s && world.scanActive;
    const tm = tower.material as THREE.PointsMaterial;
    if (!on) {
      mat.opacity = Math.max(0, mat.opacity - 0.05);
      tm.opacity = Math.max(0, tm.opacity - 0.05);
      tower.visible = tm.opacity > 0.01;
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
      const base = toVec3(s.lat, s.lon, 1.003);
      tower.position.copy(base);
      tower.quaternion.setFromUnitVectors(up, base.clone().normalize());
      tm.color.copy(mat.color);
    }
    // Reduced motion (no breathing) draws the arc at once.
    const t = world.breathe ? Math.min(1, (performance.now() - s.at) / 700) : 1;
    geo.setDrawRange(0, Math.max(2, Math.round(easeToken(t) * (SEG + 1))));
    mat.opacity = 0.9;
    tower.visible = true;
    tower.scale.set(0.012, 0.06 * Math.max(0.05, easeToken(t)), 0.012);
    tm.opacity = 0.95;
  });

  return (
    <>
      <primitive object={line} />
      <primitive object={tower} />
    </>
  );
}
