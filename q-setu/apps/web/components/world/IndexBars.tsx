"use client";

/**
 * The Readiness Index on the globe: one bar per sector rising out of India, its height the measured
 * share (thin ghost column = 100%), its colour --warn → --ok by how ready that share means (mixed in
 * sRGB). Bars rise 80 ms apart over 450 ms and sink when the section leaves. They stand in a row
 * across India; a bar's place doesn't mean that sector's sites are there.
 */
import { useFrame, useThree } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { SECTORS } from "@/lib/readiness";
import { easeToken } from "./director";
import { toVec3 } from "./geo";
import { palette } from "./palette";
import { world } from "./store";

const MAX_H = 0.55;
const W = 0.032;
const RISE_MS = 450;
const STAGGER_MS = 80;

export function IndexBars() {
  const c = useMemo(palette, []);
  const geo = useMemo(() => {
    const g = new THREE.BoxGeometry(W, W, 1);
    g.translate(0, 0, 0.5);
    return g;
  }, []);
  const edges = useMemo(() => new THREE.EdgesGeometry(geo), [geo]);
  const groups = useRef<(THREE.Group | null)[]>([]);
  const bars = useRef<(THREE.Mesh | null)[]>([]);
  const ghosts = useRef<(THREE.LineSegments | null)[]>([]);
  const mats = useMemo(
    () =>
      SECTORS.map(() => ({
        fill: new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.85, toneMapped: false }),
        ghost: new THREE.LineBasicMaterial({
          color: c.text3,
          transparent: true,
          opacity: 0.25,
          toneMapped: false,
        }),
      })),
    [c],
  );
  const shown = useRef(0);
  const warnS = useMemo(() => c.warn.clone().convertLinearToSRGB(), [c]);
  const okS = useMemo(() => c.ok.clone().convertLinearToSRGB(), [c]);
  // A row across India (lat 15°, lon 67°–93°): each bar leans between straight out and north, so on
  // screen it stands up like a chart while still rising off the surface.
  const at = useMemo(
    () =>
      SECTORS.map((_, i) => {
        const lat = 15;
        const lon = 67 + i * 6.5;
        const p = toVec3(lat, lon, 1.004);
        const la = (lat * Math.PI) / 180;
        const lo = (lon * Math.PI) / 180;
        const north = new THREE.Vector3(
          -Math.sin(la) * Math.cos(lo),
          Math.cos(la),
          Math.sin(la) * Math.sin(lo),
        );
        const dir = p
          .clone()
          .normalize()
          .multiplyScalar(0.55)
          .add(north.multiplyScalar(0.85))
          .normalize();
        return { p, look: p.clone().add(dir) };
      }),
    [],
  );
  const camera = useThree((st) => st.camera);
  const size = useThree((st) => st.size);
  const v3 = useMemo(() => new THREE.Vector3(), []);
  const look = useMemo(() => new THREE.Vector3(), []);

  useFrame((_, dt) => {
    const ix = world.index;
    const fr = world.focusRect;
    const screen: (null | { x: number; y: number })[] = [];
    shown.current += ((ix ? 1 : 0) - shown.current) * Math.min(1, dt * 6);
    const now = performance.now();
    SECTORS.forEach((_, i) => {
      const g = groups.current[i];
      const b = bars.current[i];
      const gh = ghosts.current[i];
      if (!g || !b || !gh) return;
      const vis = shown.current > 0.01;
      g.visible = vis;
      if (!vis || !ix) return;
      g.position.copy(at[i]!.p);
      // lookAt wants a world-space target; ours is in the (rotating) globe's space.
      g.lookAt(g.parent ? g.parent.localToWorld(look.copy(at[i]!.look)) : at[i]!.look);
      const v = ix.values[i] ?? 0;
      const rise = world.breathe
        ? easeToken(Math.min(1, Math.max(0, (now - ix.at - i * STAGGER_MS) / RISE_MS)))
        : 1;
      b.scale.set(1, 1, Math.max(0.002, v * MAX_H * rise * shown.current));
      gh.scale.set(1, 1, MAX_H * shown.current);
      const ready = ix.good ? v : 1 - v;
      mats[i]!.fill.color.copy(warnS).lerp(okS, ready).convertSRGBToLinear();
      mats[i]!.fill.opacity = 0.85 * shown.current;
      mats[i]!.ghost.opacity = 0.25 * shown.current;
      // Where the bar's tip is on screen, for its DOM label (only inside the globe's area).
      v3.set(0, 0, Math.max(0.002, v * MAX_H * rise) + 0.03)
        .applyMatrix4(g.matrixWorld)
        .project(camera);
      const x = ((v3.x + 1) / 2) * size.width;
      const y = ((1 - v3.y) / 2) * size.height;
      screen[i] =
        fr &&
        rise > 0.6 &&
        x > fr.left &&
        x < fr.left + fr.width &&
        y > fr.top &&
        y < fr.top + fr.height
          ? { x, y }
          : null;
    });
    world.indexScreen = screen;
  });

  return (
    <>
      {SECTORS.map((s, i) => (
        <group key={s.id} ref={(g) => void (groups.current[i] = g)} visible={false}>
          <mesh ref={(m) => void (bars.current[i] = m)} geometry={geo} material={mats[i]!.fill} />
          <lineSegments
            ref={(l) => void (ghosts.current[i] = l)}
            geometry={edges}
            material={mats[i]!.ghost}
          />
        </group>
      ))}
    </>
  );
}
