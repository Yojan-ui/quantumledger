"use client";

/**
 * The scanner's results as glass pillars on the stage's reflective floor: each scan of this session
 * (up to five, in the order they were made) rises out of the floor as a glass pillar with a fresnel
 * rim, filled with liquid light up to its readiness score, in its grade's colour (--danger critical,
 * --warn at risk, --ok quantum-ready). A scan beam sweeps across them and flares when a new result
 * lands. Aggregates only: each pillar is one scan's score; nothing is named or ranked.
 * Static under reduced motion.
 */
import { PerspectiveCamera } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { Anchor } from "@/components/director/Anchor";
import { FXStage, useFX } from "@/components/fx/FXStage";
import { glass, solid } from "@/components/fx/materials";
import { StageSet } from "@/components/fx/StageSet";
import { palette } from "@/components/world/palette";
import { springIn } from "@/lib/motion";

export interface ScanPillar {
  /** When this scan's result arrived (performance.now()). */
  at: number;
  score: number;
  grade: "Critical" | "At risk" | "Quantum-ready";
  /** What was scanned, by kind only ("live TLS", "pasted config"). */
  kind: string;
}

export interface ScannerBarsProps {
  pillars: ScanPillar[];
  active: boolean;
  reduce: boolean;
}

const H = 2.2;
const GAP = 1.05;
const FLOOR = 0;
const MAX = 5;

export default function ScannerBars(props: ScannerBarsProps) {
  const c = useMemo(palette, []);
  return (
    <FXStage background={c.bg} active={props.active} reduce={props.reduce}>
      <Scene {...props} />
    </FXStage>
  );
}

const roleOf = (g: ScanPillar["grade"]) =>
  g === "Quantum-ready" ? "ok" : g === "At risk" ? "warn" : "danger";

function Scene({ pillars, active, reduce }: ScannerBarsProps) {
  const c = useMemo(palette, []);
  const fx = useFX();
  const colOf = (g: ScanPillar["grade"]) =>
    g === "Quantum-ready" ? c.ok : g === "At risk" ? c.warn : c.danger;
  const geo = useMemo(
    () => ({
      shell: new THREE.CylinderGeometry(0.3, 0.3, H, 48, 1, true).translate(0, H / 2, 0),
      liquid: new THREE.CylinderGeometry(0.26, 0.26, 1, 48).translate(0, 0.5, 0),
      cap: new THREE.TorusGeometry(0.3, 0.02, 10, 48).rotateX(Math.PI / 2),
      beam: new THREE.PlaneGeometry(0.025, H + 0.6),
    }),
    [],
  );
  const mats = useMemo(
    () =>
      Array.from({ length: MAX }, () => ({
        shell: glass(c.text3, { rim: 1.6, body: 0.04 }),
        liquid: solid(c.ok, { glow: 1.1 }),
        cap: new THREE.MeshBasicMaterial({ toneMapped: false }),
      })),
    [c],
  );
  const beamMat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: c.kem.clone().multiplyScalar(2.5),
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        toneMapped: false,
      }),
    [c],
  );
  const shown = pillars.slice(-MAX);
  const xs = shown.map((_, i) => (i - (shown.length - 1) / 2) * GAP);
  // Fit the whole row to the stage's width, whatever its aspect.
  const aspect = useThree((st) => st.size.width / Math.max(1, st.size.height));
  const rowW = Math.max(3, shown.length) * GAP + 1.6;
  const fit = Math.max(4.6, rowW / 2 / (Math.tan((19 * Math.PI) / 180) * aspect));
  const groups = useRef<(THREE.Group | null)[]>([]);
  const liquids = useRef<(THREE.Mesh | null)[]>([]);
  const caps = useRef<(THREE.Mesh | null)[]>([]);
  const beam = useRef<THREE.Mesh>(null);
  const clock = useRef(0);
  const last = useRef(0);

  useFrame((_, dt) => {
    if (!active) return;
    const now = performance.now();
    if (!reduce) clock.current += dt;
    const t = clock.current;
    const newest = shown[shown.length - 1]?.at ?? 0;
    if (newest && newest !== last.current && !reduce) {
      last.current = newest;
      fx.hit(0.25);
    }
    shown.forEach((p, i) => {
      const g = groups.current[i];
      const l = liquids.current[i];
      const cap = caps.current[i];
      const m = mats[i]!;
      if (!g || !l || !cap) return;
      // The pillar rises out of the floor (a spring), then the liquid fills to the score.
      const rise = reduce ? 1 : springIn((now - p.at) / 1000, 0.55, 1.5);
      const fill = reduce ? 1 : springIn((now - p.at - 450) / 1000, 0.5, 1.2);
      g.position.set(xs[i]!, FLOOR - H * (1 - Math.min(1, rise)), 0);
      g.scale.set(1, Math.max(0.0001, rise), 1);
      const level = Math.max(0.03, (p.score / 100) * (H - 0.08)) * Math.max(0.0001, fill);
      l.scale.set(1, level, 1);
      cap.position.y = level;
      const col = colOf(p.grade);
      (m.shell.uniforms.uColor!.value as THREE.Color).copy(col);
      (m.liquid.uniforms.uColor!.value as THREE.Color).copy(col);
      // The liquid's light breathes a little, as if it were moving.
      m.liquid.uniforms.uGlow!.value = 1.1 + (reduce ? 0 : 0.15 * Math.sin(t * 2.2 + i));
      m.cap.color.copy(col).multiplyScalar(3);
    });
    // The scan beam sweeps across the row (and flares when a result lands).
    if (beam.current) {
      const span = rowW / 2;
      const flare = newest ? Math.max(0, 1 - (now - newest) / 900) : 0;
      beam.current.visible = shown.length > 0;
      beam.current.position.set(
        reduce ? -span : -span + ((t * 0.5) % 1) * span * 2,
        FLOOR + (H + 0.6) / 2,
        0.4,
      );
      beamMat.opacity = 0.3 + 0.6 * flare;
    }
    fx.focus = null;
  });

  return (
    <>
      <PerspectiveCamera
        makeDefault
        position={[0, 1.9 + fit * 0.12, fit]}
        fov={38}
        onUpdate={(cam) => cam.lookAt(0, 1.0, 0)}
      />
      <fog attach="fog" args={[c.bg, fit + 2, fit + 12]} />
      <StageSet y={FLOOR} coneColor={c.kem} coneAt={[0, 0]} coneStrength={0.1} />
      {shown.map((p, i) => (
        <group key={p.at} ref={(g) => void (groups.current[i] = g)} position={[xs[i]!, FLOOR, 0]}>
          <mesh geometry={geo.shell} material={mats[i]!.shell} />
          <mesh
            ref={(l) => void (liquids.current[i] = l)}
            geometry={geo.liquid}
            material={mats[i]!.liquid}
          />
          <mesh
            ref={(m) => void (caps.current[i] = m)}
            geometry={geo.cap}
            material={mats[i]!.cap}
          />
          <Anchor
            position={i % 2 === 0 ? [0, H + 0.25, 0] : [0, -0.15, 0.4]}
            side={i % 2 === 0 ? "up" : "down"}
            label={`Scan ${pillars.length - shown.length + i + 1} · ${p.kind}`}
            value={`${p.score} / 100 · ${p.grade}`}
            role={roleOf(p.grade)}
            show={active}
          />
        </group>
      ))}
      <mesh ref={beam} geometry={geo.beam} material={beamMat} visible={false} />
    </>
  );
}
