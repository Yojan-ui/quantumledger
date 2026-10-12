"use client";

/**
 * Demo 4 as a film. Twelve real ledger entries on an arc, linked by SIG lines (hash + ML-DSA
 * signature): six around #42, a gap, then the six newest, which shift along as live entries arrive.
 * Tamper: #42 flickers to DANGER and every link after it dims and drops in a cascade. Verify: a scan
 * beam passes each block (OK) and stops at the first break. Restore repairs the chain in reverse.
 */
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { Anchor } from "@/components/director/Anchor";
import { DirectorCamera } from "@/components/director/DirectorCamera";
import type { DirectorState } from "@/components/director/types";
import { span } from "@/components/scenes/geometry";
import { palette } from "@/components/world/palette";
import { easeToken } from "@/lib/ease";

export const N = 12;
/** Index on the arc of the entry the insider edits. */
export const TARGET_INDEX = 3;
const R = 7;
const SPAN = (120 * Math.PI) / 180;
const STEP_MS = 110;
const CASCADE_MS = 60;

/** Where block i sits on the arc (a gap between the two halves). */
export function blockPos(i: number, out = new THREE.Vector3()) {
  const t = (i + (i >= N / 2 ? 0.8 : 0)) / (N - 1 + 0.8);
  const a = -SPAN / 2 + SPAN * t;
  return out.set(R * Math.sin(a), 0, -R * (1 - Math.cos(a)));
}

export interface LedgerFilmProps {
  state: DirectorState;
  onSettled: () => void;
  active: boolean;
  /** Entry IDs on the arc (0 = not loaded yet). */
  ids: number[];
  /** When #42 was edited (performance.now()), or 0 while the row is intact. */
  tamperedAt: number;
  /** The latest verification: when its result arrived, and where it broke (-1 = intact). */
  verify: { at: number; broken: number } | null;
  /** When the edit was undone, or 0. */
  restoredAt: number;
  /** When the newest entry arrived (for its scale-in). */
  headAt: number;
}

export default function LedgerFilm({
  state,
  onSettled,
  active,
  ids,
  tamperedAt,
  verify,
  restoredAt,
  headAt,
}: LedgerFilmProps) {
  const c = useMemo(palette, []);
  const geo = useMemo(() => new THREE.BoxGeometry(0.62, 0.44, 0.44), []);
  const edges = useMemo(() => new THREE.EdgesGeometry(geo), [geo]);
  const blocks = useRef<(THREE.Group | null)[]>([]);
  const mats = useMemo(
    () =>
      Array.from({ length: N }, () => ({
        fill: new THREE.MeshBasicMaterial({
          color: c.text3.clone(),
          transparent: true,
          opacity: 0.08,
        }),
        line: new THREE.LineBasicMaterial({ color: c.text3.clone(), transparent: true }),
      })),
    [c],
  );
  const linkGeo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array((N - 1) * 6), 3));
    g.setAttribute("color", new THREE.BufferAttribute(new Float32Array((N - 1) * 6), 3));
    return g;
  }, []);
  const beam = useRef<THREE.Mesh>(null);
  const p = useMemo(() => new THREE.Vector3(), []);
  const q = useMemo(() => new THREE.Vector3(), []);
  const col = useMemo(() => new THREE.Color(), []);
  const head = useMemo(() => blockPos(N - 1), []);
  const target = useMemo(() => blockPos(TARGET_INDEX), []);

  useFrame(({ clock }) => {
    if (!active) return;
    const now = performance.now();
    const reduce = state.reduce;
    const t = reduce ? 0 : clock.elapsedTime;
    const broken = verify?.broken ?? -1;
    // The scan beam: one block every STEP_MS from the left; it stops at the break.
    const scanned = verify
      ? reduce
        ? N
        : Math.min(broken >= 0 ? broken + 1 : N, (now - verify.at) / STEP_MS)
      : -1;
    const pos = linkGeo.attributes.position!.array as Float32Array;
    const lc = linkGeo.attributes.color!.array as Float32Array;
    for (let i = 0; i < N; i++) {
      const g = blocks.current[i];
      const m = mats[i]!;
      blockPos(i, p);
      // Cascade after the edit: every block past #42 drops and dims, 60 ms apart; restore lifts them
      // back in reverse order (last block first).
      const after = i > TARGET_INDEX;
      const down = tamperedAt
        ? easeToken(span(now - tamperedAt - (i - TARGET_INDEX) * CASCADE_MS, 0, 400))
        : restoredAt
          ? 1 - easeToken(span(now - restoredAt - (N - 1 - i) * CASCADE_MS, 0, 400))
          : 0;
      const d = after && !reduce ? down : after && tamperedAt ? 1 : 0;
      p.y = -0.12 * d + (reduce ? 0 : 0.03 * Math.sin(t * 0.8 + i * 0.6));
      const fresh = i === N - 1 && headAt ? easeToken(span(now - headAt, 0, 500)) : 1;
      if (g) {
        g.position.copy(p);
        g.lookAt(0, p.y, R * 0.6);
        g.scale.setScalar(Math.max(0.0001, fresh));
      }
      // Colour: SIG at rest; OK once the scan has passed; DANGER for the edited block.
      const isBad = i === TARGET_INDEX && !!tamperedAt;
      const flicker =
        isBad && !reduce && now - tamperedAt < 700 ? (Math.sin(now / 35) > 0 ? 1 : 0) : 1;
      if (isBad && (!verify || broken === i || scanned < i))
        col.copy(c.danger).lerp(c.text3, 1 - flicker);
      else if (scanned > i) col.copy(c.ok);
      else col.copy(c.sig);
      if (d > 0 && !isBad) col.lerp(c.text3, 0.7 * d);
      m.line.color.copy(col);
      m.fill.color.copy(col);
      m.line.opacity = 1 - 0.6 * d;
      m.fill.opacity = 0.1 * (1 - 0.6 * d) + (isBad ? 0.12 : 0);
      if (i > 0) {
        blockPos(i - 1, q);
        const k = (i - 1) * 6;
        pos.set([q.x, q.y + 0.0, q.z, p.x, p.y, p.z], k);
        // The link into a block is broken from the edit onward; the gap is drawn faint.
        const gap = i === N / 2;
        const lcol = c.sig.clone();
        if (tamperedAt && i > TARGET_INDEX) lcol.lerp(c.text3, 0.8);
        if (gap) lcol.multiplyScalar(0.25);
        lc.set([lcol.r, lcol.g, lcol.b, lcol.r, lcol.g, lcol.b], k);
      }
    }
    linkGeo.attributes.position!.needsUpdate = linkGeo.attributes.color!.needsUpdate = true;
    if (beam.current) {
      const on =
        verify &&
        scanned >= 0 &&
        scanned < N &&
        !(broken >= 0 && scanned >= broken + 1 && now - verify.at > (broken + 1) * STEP_MS + 600);
      beam.current.visible = !!on && !reduce;
      blockPos(Math.min(N - 1, Math.max(0, Math.floor(scanned))), q);
      beam.current.position.set(q.x, 0.1, q.z);
      beam.current.lookAt(0, 0.1, R * 0.6);
      (beam.current.material as THREE.MeshBasicMaterial).color.copy(
        broken >= 0 && scanned >= broken ? c.danger : c.ok,
      );
    }
  });

  const id = state.shot.id;
  const show = state.settled;
  const broken = verify?.broken ?? -1;
  return (
    <>
      <DirectorCamera state={state} onSettled={onSettled} drift={0.02} />
      <fog attach="fog" args={[c.bg, 8, 20]} />
      <ambientLight intensity={0.5} />
      <directionalLight position={[2, 5, 5]} intensity={0.8} />
      <directionalLight position={[0, 2, -8]} intensity={0.3} color={c.sig} />
      <gridHelper args={[30, 60, c.text3, c.text3]} position={[0, -0.6, -2]}>
        <meshBasicMaterial attach="material" color={c.text3} transparent opacity={0.06} />
      </gridHelper>
      <lineSegments geometry={linkGeo}>
        <lineBasicMaterial vertexColors transparent opacity={0.9} />
      </lineSegments>
      {Array.from({ length: N }, (_, i) => (
        <group key={i} ref={(g) => void (blocks.current[i] = g)}>
          <mesh geometry={geo} material={mats[i]!.fill} />
          <lineSegments geometry={edges} material={mats[i]!.line} />
        </group>
      ))}
      <mesh ref={beam} visible={false}>
        <planeGeometry args={[0.04, 1.3]} />
        <meshBasicMaterial color={c.ok} transparent opacity={0.8} toneMapped={false} />
      </mesh>

      <Anchor
        position={[head.x, 0.45, head.z]}
        label={`Entry #${ids[N - 1] || "…"}`}
        role="sig"
        value="newest · hashed + ML-DSA signed"
        show={show && id === "chain"}
      />
      <Anchor
        position={[target.x, 0.45, target.z]}
        label={`Entry #${ids[TARGET_INDEX] || 42}`}
        role={tamperedAt ? "danger" : "sig"}
        value={tamperedAt ? "edited in the database" : "signed"}
        show={show && id === "tamper"}
      />
      <Anchor
        position={[0, 0.7, -1.4]}
        label="All links verified"
        role="ok"
        value={verify && broken < 0 ? "every hash and signature checks" : "…"}
        show={show && (id === "verify" || id === "restore") && !!verify && broken < 0}
      />
      <Anchor
        position={[target.x, 0.55, target.z]}
        label={`Hash mismatch at entry #${ids[TARGET_INDEX] || 42} · signature invalid`}
        role="danger"
        value="nothing after it can be trusted"
        show={show && id === "broken" && broken === TARGET_INDEX}
      />
    </>
  );
}
