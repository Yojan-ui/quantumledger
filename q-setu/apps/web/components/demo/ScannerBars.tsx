"use client";

/**
 * The scanner's result as solid bars: one for the readiness score (out of 100, coloured by its
 * grade: --danger critical, --warn at risk, --ok quantum-ready) and one per severity (how many
 * findings), plus a node for the live TLS probe's key exchange when there is one (--ok if it
 * negotiated hybrid ML-KEM, --warn if not). Aggregates only: nothing is ranked or named. Each new
 * result grows the bars with a spring (a slight overshoot, then settle); static under reduced motion.
 */
import { PerspectiveCamera } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { Anchor } from "@/components/director/Anchor";
import { palette } from "@/components/world/palette";
import { springIn } from "@/lib/motion";

export interface ScanTotals {
  score: number;
  grade: "Critical" | "At risk" | "Quantum-ready";
  summary: { critical: number; high: number; medium: number; low: number };
  /** The live TLS probe, if this result came from one. */
  hybridPq?: boolean;
}

export interface ScannerBarsProps {
  /** When this result arrived (performance.now()): the bars grow from here. */
  at: number;
  /** The latest result's totals (none yet: an empty floor). */
  result: ScanTotals | undefined;
  active: boolean;
  reduce: boolean;
}

const GAP = 0.85;
const MAX_H = 2;
/** Severity counts are drawn against 10 findings (more than 10 reach the top). */
const CAP = 10;

export default function ScannerBars({ at, result, active, reduce }: ScannerBarsProps) {
  const c = useMemo(palette, []);
  const score = result?.score ?? 0;
  const grade = result?.grade ?? "Critical";
  const hybridPq = result?.hybridPq;
  const summary = result?.summary;
  const geo = useMemo(() => new THREE.BoxGeometry(0.5, 1, 0.5).translate(0, 0.5, 0), []);
  const node = useMemo(() => new THREE.IcosahedronGeometry(0.22, 1), []);
  const bars = useMemo(() => {
    if (!summary) return [];
    const gradeCol = grade === "Quantum-ready" ? c.ok : grade === "At risk" ? c.warn : c.danger;
    const rows: { key: string; label: string; value: string; h: number; col: THREE.Color }[] = [
      {
        key: "score",
        label: "Readiness",
        value: `${score} / 100`,
        h: (score / 100) * MAX_H,
        col: gradeCol,
      },
      { key: "critical", label: "Critical", value: String(summary.critical), h: 0, col: c.danger },
      { key: "high", label: "High", value: String(summary.high), h: 0, col: c.warn },
      { key: "medium", label: "Medium", value: String(summary.medium), h: 0, col: c.sig },
      { key: "low", label: "Low", value: String(summary.low), h: 0, col: c.text3 },
    ];
    for (const r of rows.slice(1))
      r.h = (Math.min(CAP, summary[r.key as keyof typeof summary]) / CAP) * MAX_H * 0.8;
    return rows.map((r, i) => ({
      ...r,
      x: (i - (rows.length - 1) / 2) * GAP + (i === 0 ? -0.25 : 0.1),
      mat: new THREE.MeshStandardMaterial({
        color: r.col.clone(),
        emissive: r.col.clone(),
        emissiveIntensity: 0.4,
        roughness: 0.35,
        metalness: 0.1,
      }),
    }));
  }, [c, score, grade, summary]);
  const nodeMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: (hybridPq ? c.ok : c.warn).clone(),
        emissive: (hybridPq ? c.ok : c.warn).clone(),
        emissiveIntensity: 0.5,
        roughness: 0.3,
      }),
    [c, hybridPq],
  );
  // Fit the whole row (bars and the probe node) to the stage's width, whatever its aspect.
  const aspect = useThree((st) => st.size.width / Math.max(1, st.size.height));
  const rowW = (bars.length + (hybridPq !== undefined ? 1 : 0)) * GAP + 1.4;
  const fit = Math.max(5.2, rowW / 2 / (Math.tan((19 * Math.PI) / 180) * aspect));
  const cx = hybridPq !== undefined ? 0.45 : 0;
  const meshes = useRef<(THREE.Mesh | null)[]>([]);
  const probe = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    if (!active) return;
    const now = performance.now();
    bars.forEach((b, i) => {
      const m = meshes.current[i];
      if (!m) return;
      // Each bar grows with a spring, 90 ms after the one before.
      const k = reduce ? 1 : springIn((now - at - i * 90) / 1000, 0.55, 1.6);
      m.scale.set(1, Math.max(0.0001, Math.max(0.02, b.h) * k), 1);
    });
    if (probe.current) {
      const k = reduce ? 1 : springIn((now - at - 500) / 1000, 0.5, 1.8);
      probe.current.scale.setScalar(Math.max(0.0001, k));
      probe.current.rotation.y = reduce ? 0.4 : clock.elapsedTime * 0.4;
    }
  });

  const top = (h: number) => Math.max(0.02, h) + 0.15;
  return (
    <>
      <PerspectiveCamera
        makeDefault
        position={[cx, 1.2 + fit * 0.18, fit]}
        fov={38}
        onUpdate={(cam) => cam.lookAt(cx, 0.85, 0)}
      />
      <ambientLight intensity={0.6} />
      <directionalLight position={[3, 5, 4]} intensity={1.1} />
      <directionalLight position={[-3, 2, -3]} intensity={0.35} color={c.kem} />
      <gridHelper args={[10, 20, c.text3, c.text3]} position={[0, 0, 0]}>
        <meshBasicMaterial
          attach="material"
          color={c.text3}
          transparent
          depthWrite={false}
          opacity={0.08}
        />
      </gridHelper>
      {bars.map((b, i) => (
        <group key={b.key} position={[b.x, 0, 0]}>
          <mesh
            ref={(m) => void (meshes.current[i] = m)}
            geometry={geo}
            material={b.mat}
            scale={[1, 0.0001, 1]}
          />
          <Anchor
            // Staggered (above the bar, then below its base) so neighbours never collide.
            position={i % 2 === 1 ? [0, -0.12, 0.3] : [0, top(b.h), 0]}
            side={i % 2 === 1 ? "down" : "up"}
            // One line for the counts (the stage is narrow); two for the score.
            label={b.key === "score" ? b.label : `${b.value} ${b.label}`}
            value={b.key === "score" ? b.value : undefined}
            role={
              b.key === "score"
                ? grade === "Quantum-ready"
                  ? "ok"
                  : grade === "At risk"
                    ? "warn"
                    : "danger"
                : undefined
            }
            show={active}
          />
        </group>
      ))}
      {hybridPq !== undefined && bars.length > 0 && (
        <group position={[bars[bars.length - 1]!.x + GAP + 0.1, 0.5, 0]}>
          <mesh ref={probe} geometry={node} material={nodeMat} />
          <Anchor
            position={[0, 0.45, 0]}
            label="Live TLS"
            value={hybridPq ? "hybrid ML-KEM ✓" : "classical only"}
            role={hybridPq ? "ok" : "warn"}
            show={active}
          />
        </group>
      )}
    </>
  );
}
