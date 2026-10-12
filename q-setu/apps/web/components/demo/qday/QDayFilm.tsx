"use client";

/**
 * Demo 3 as a film. Two glass corridors carry each system's packets (classical above, Q-Setu below)
 * while an adversary orb records both through saffron tendrils. Time-lapse: the light warms and the
 * orb grows. Q-Day: the classical packets shatter (saffron edges) and their real decrypted contents
 * float out as labels; the Q-Setu packets only glint and stay whole.
 */
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { Anchor } from "@/components/director/Anchor";
import { DirectorCamera } from "@/components/director/DirectorCamera";
import { pulse, useReactions } from "@/components/director/reactions";
import type { DirectorState } from "@/components/director/types";
import { span } from "@/components/scenes/geometry";
import { palette } from "@/components/world/palette";
import { easeToken } from "@/lib/ease";

const LEN = 9;
const ROW = 0.8;
const MAX = 12;
const SHARDS = 6;
const ORB = new THREE.Vector3(0, 0, -2.4);

const mine = (e: { source: string }) => e.source === "browser";

export interface QDayFilmProps {
  state: DirectorState;
  onSettled: () => void;
  active: boolean;
  /** 0 = today … 1 = Q-Day (the time-lapse). */
  progress: number;
  /** Recorded packets so far (each side gets one packet per recording, capped). */
  recorded: number;
  /** When the classical packets break (performance.now()), or 0. */
  breakAt: number;
  /** Real decrypted contents of the first broken records. */
  leaks: string[];
  exposed: number;
  qExposed: number | undefined;
  small: boolean;
}

export default function QDayFilm({
  state,
  onSettled,
  active,
  progress,
  recorded,
  breakAt,
  leaks,
  exposed,
  qExposed,
  small,
}: QDayFilmProps) {
  const c = useMemo(palette, []);
  // Mixed in sRGB (a 3–4.5% tint), not linear space, where the same mix would glow.
  const tint = (to: THREE.Color, k: number) =>
    c.bg
      .clone()
      .convertLinearToSRGB()
      .lerp(to.clone().convertLinearToSRGB(), k)
      .convertSRGBToLinear();
  const bgCool = useMemo(() => tint(c.kem, 0.03), [c]); // eslint-disable-line react-hooks/exhaustive-deps
  const bgWarm = useMemo(() => tint(c.warn, 0.045), [c]); // eslint-disable-line react-hooks/exhaustive-deps
  // A backdrop plane, not scene.background: inside a drei View the background would fill the page.
  const backdrop = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: bgCool.clone(),
        fog: false,
        depthWrite: false,
        toneMapped: false,
      }),
    [bgCool],
  );
  const box = useMemo(() => new THREE.BoxGeometry(0.34, 0.22, 0.22), []);
  const boxEdges = useMemo(() => new THREE.EdgesGeometry(box), [box]);
  const corridor = useMemo(() => new THREE.BoxGeometry(LEN, 0.6, 0.6), []);
  const corridorEdges = useMemo(() => new THREE.EdgesGeometry(corridor), [corridor]);
  const shardGeo = useMemo(() => new THREE.TetrahedronGeometry(0.07, 0), []);
  const tendrils = useMemo(() => {
    const pts: number[] = [];
    for (const y of [ROW, -ROW])
      for (const x of [-2.6, -0.8, 1, 2.8]) {
        const curve = new THREE.QuadraticBezierCurve3(
          ORB,
          new THREE.Vector3(x * 0.5, y * 0.4, -1.4),
          new THREE.Vector3(x, y, -0.3),
        );
        const p = curve.getPoints(24);
        for (let i = 0; i < p.length - 1; i++) pts.push(...p[i]!.toArray(), ...p[i + 1]!.toArray());
      }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
    return g;
  }, []);
  const n = Math.max(3, Math.min(small ? 6 : MAX, recorded));
  const classical = useRef<THREE.InstancedMesh>(null);
  const classicalEdges = useRef<(THREE.LineSegments | null)[]>([]);
  const qsetu = useRef<THREE.InstancedMesh>(null);
  const qsetuEdges = useRef<(THREE.LineSegments | null)[]>([]);
  const qsetuEdgeMat = useMemo(
    () =>
      new THREE.LineBasicMaterial({
        color: c.kem,
        transparent: true,
        opacity: 0.6,
        toneMapped: false,
      }),
    [c],
  );
  const frozenAt = useRef<number | null>(null);
  const shards = useRef<THREE.InstancedMesh>(null);
  const orb = useRef<THREE.Mesh>(null);
  const tendrilMat = useRef<THREE.LineBasicMaterial>(null);
  const rim = useRef<THREE.DirectionalLight>(null);
  const o = useMemo(() => new THREE.Object3D(), []);
  const react = useReactions(mine);

  const packetX = (i: number, t: number) =>
    (((((i / n) * LEN + t * 0.7) % LEN) + LEN) % LEN) - LEN / 2;

  useFrame(({ clock, scene }) => {
    if (!active) return;
    const now = performance.now();
    const t = state.reduce ? 0 : clock.elapsedTime;
    // Time-lapse: the light warms from blue-black to warm-black as the years pass.
    backdrop.color.copy(bgCool).lerp(bgWarm, progress);
    if (scene.fog) (scene.fog as THREE.Fog).color.copy(backdrop.color);
    if (rim.current) rim.current.intensity = 0.25 + 0.35 * progress;

    const broke = !!breakAt && now >= breakAt;
    if (!broke) frozenAt.current = null;
    else frozenAt.current ??= t;
    const b = broke ? (state.reduce ? 1 : easeToken(span(now - breakAt, 0, 1100))) : 0;
    const glint = breakAt ? pulse(breakAt, 700) + 0.6 * pulse(react.current.reject, 500) : 0;
    const p = pulse(breakAt - 200, 600);

    if (orb.current) {
      orb.current.scale.setScalar((0.32 + 0.38 * progress) * (1 + 0.25 * p));
      orb.current.rotation.y = t * 0.15;
    }
    if (tendrilMat.current)
      tendrilMat.current.opacity = 0.18 + 0.12 * Math.sin(t * 2.2) * (1 - b) + 0.4 * p;

    const cm = classical.current;
    const qm = qsetu.current;
    const sh = shards.current;
    if (!cm || !qm || !sh) return;
    for (let i = 0; i < MAX; i++) {
      const on = i < n ? 1 : 0;
      const x = packetX(i, frozenAt.current ?? t);
      // Classical packet: whole until Q-Day, then gone (its shards take over).
      o.position.set(x, ROW, 0);
      o.rotation.set(0, 0, 0);
      o.scale.setScalar(on * (broke ? 0.0001 : 1));
      o.updateMatrix();
      cm.setMatrixAt(i, o.matrix);
      const ce = classicalEdges.current[i];
      if (ce) ce.matrix.copy(o.matrix);
      for (let k = 0; k < SHARDS; k++) {
        const a = i * 1.7 + k * 1.05;
        o.position.set(
          x + Math.cos(a) * b * 0.6,
          ROW + Math.sin(a * 1.3) * b * 0.45 + b * 0.15,
          Math.sin(a) * b * 0.5,
        );
        o.rotation.set(a * b * 3, a, b * 2);
        o.scale.setScalar(on * (broke ? 1 - 0.4 * b : 0.0001));
        o.updateMatrix();
        sh.setMatrixAt(i * SHARDS + k, o.matrix);
      }
      // Q-Setu packet: keeps moving, and refracts the shock wave as a brief KEM glint.
      o.position.set(packetX(i, t), -ROW, 0);
      o.rotation.set(0, 0, 0);
      o.scale.setScalar(on * (1 + 0.12 * glint));
      o.updateMatrix();
      qm.setMatrixAt(i, o.matrix);
      const qe = qsetuEdges.current[i];
      if (qe) qe.matrix.copy(o.matrix);
    }
    cm.instanceMatrix.needsUpdate = qm.instanceMatrix.needsUpdate = true;
    sh.instanceMatrix.needsUpdate = true;
    sh.visible = broke;
    qsetuEdgeMat.opacity = 0.6 + 0.4 * Math.min(1, glint);
  });

  const id = state.shot.id;
  const show = state.settled;
  return (
    <>
      <DirectorCamera state={state} onSettled={onSettled} drift={0.02} />
      <fog attach="fog" args={[c.bg, 7, 18]} />
      <mesh position={[0, 0, -9]} material={backdrop} renderOrder={-2}>
        <planeGeometry args={[80, 50]} />
      </mesh>
      <ambientLight intensity={0.45} />
      <directionalLight position={[2, 4, 5]} intensity={0.9} />
      <directionalLight ref={rim} position={[0, 2, -6]} intensity={0.25} color={c.warn} />

      {/* Two glass corridors: classical above, Q-Setu below. */}
      {[ROW, -ROW].map((y) => (
        <group key={y} position={[0, y, 0]}>
          <mesh geometry={corridor}>
            <meshPhysicalMaterial
              color={c.text}
              transparent
              opacity={0.04}
              roughness={0}
              depthWrite={false}
            />
          </mesh>
          <lineSegments geometry={corridorEdges}>
            <lineBasicMaterial color={c.text3} transparent opacity={0.35} />
          </lineSegments>
        </group>
      ))}

      <instancedMesh ref={classical} args={[box, undefined, MAX]}>
        <meshBasicMaterial color={c.warn} transparent opacity={0.12} depthWrite={false} />
      </instancedMesh>
      {Array.from({ length: MAX }, (_, i) => (
        <lineSegments
          key={`c${i}`}
          ref={(l) => void (classicalEdges.current[i] = l)}
          geometry={boxEdges}
          matrixAutoUpdate={false}
        >
          <lineBasicMaterial color={c.warn} transparent opacity={0.85} />
        </lineSegments>
      ))}
      <instancedMesh ref={shards} args={[shardGeo, undefined, MAX * SHARDS]} visible={false}>
        <meshBasicMaterial color={c.warn} wireframe transparent opacity={0.85} />
      </instancedMesh>
      <instancedMesh ref={qsetu} args={[box, undefined, MAX]}>
        <meshPhysicalMaterial
          color={c.kem}
          transparent
          opacity={0.18}
          roughness={0.05}
          depthWrite={false}
        />
      </instancedMesh>
      {Array.from({ length: MAX }, (_, i) => (
        <lineSegments
          key={`q${i}`}
          ref={(l) => void (qsetuEdges.current[i] = l)}
          geometry={boxEdges}
          material={qsetuEdgeMat}
          matrixAutoUpdate={false}
        />
      ))}

      {/* The adversary: an orb recording both corridors through saffron tendrils. */}
      <mesh ref={orb} position={ORB}>
        <icosahedronGeometry args={[1, 2]} />
        <meshBasicMaterial color={c.warn} wireframe transparent opacity={0.55} />
      </mesh>
      <lineSegments geometry={tendrils}>
        <lineBasicMaterial ref={tendrilMat} color={c.warn} transparent opacity={0.2} />
      </lineSegments>

      <Anchor
        position={[-2.4, ROW + 0.35, 0]}
        label="Classical"
        value="RSA + ECDSA · recorded"
        role="warn"
        show={show && (id === "split" || id === "timelapse")}
      />
      <Anchor
        position={[-2.4, -ROW - 0.35, 0]}
        label="Q-Setu"
        value="X25519 + ML-KEM-768 · recorded"
        role="kem"
        show={show && (id === "split" || id === "timelapse")}
        side="down"
      />
      <Anchor
        position={[0, 0, -2.4]}
        label="Adversary"
        value="harvest now, decrypt later"
        role="warn"
        show={show && id === "split"}
        side="down"
      />
      {/* The climax: real decrypted contents float out of the broken packets. */}
      {leaks.slice(0, small ? 1 : 2).map((text, i) => (
        <Anchor
          key={i}
          position={[i === 0 ? -1.3 : 1.3, ROW + 0.35, 0]}
          label="Decrypted"
          value={text.length > 24 ? `${text.slice(0, 23)}…` : text}
          role="warn"
          show={show && id === "climax" && !!breakAt}
        />
      ))}
      <Anchor
        position={[2.4, -ROW - 0.35, 0]}
        label="Q-Setu · attack failed"
        value="AES-GCM tag mismatch"
        role="kem"
        show={show && id === "climax" && qExposed !== undefined}
        side="down"
      />
      <Anchor
        position={[2.4, ROW + 0.35, 0]}
        label="Records exposed"
        value={String(exposed)}
        role="warn"
        show={show && id === "aftermath"}
      />
      <Anchor
        position={[2.4, -ROW - 0.35, 0]}
        label="Records exposed"
        value={qExposed === undefined ? "…" : String(qExposed)}
        role="kem"
        show={show && id === "aftermath"}
        side="down"
      />
    </>
  );
}
