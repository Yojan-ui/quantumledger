"use client";

/**
 * Demo 3 as a film: recorded traffic opens at Q-Day unless it was sealed with a hybrid key.
 *
 * One line of traffic. Packets are solid capsules moving along it, alternating classical (--warn,
 * RSA / ECDH) and hybrid (--kem, X25519 + ML-KEM-768). Below, the attacker's drum (the simulated
 * network's recorder) takes a copy of each packet: one copy drops into it per real recording.
 * Time-lapse: the light warms and the drum fills. Q-Day: a 300 ms freeze, then the classical
 * packets shatter (each shard with its own velocity and spin, under a short slow-motion ramp) and
 * their real decrypted contents rise out; the hybrid packets stay whole and glow --kem.
 * Springs settle with a slight overshoot; reduced motion shows each shot's composed end state.
 */
import { Html, Line } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { Anchor } from "@/components/director/Anchor";
import { DirectorCamera } from "@/components/director/DirectorCamera";
import { pulse, useReactions } from "@/components/director/reactions";
import type { DirectorState } from "@/components/director/types";
import { span } from "@/components/scenes/geometry";
import { Thicken } from "@/components/scenes/Thicken";
import { palette } from "@/components/world/palette";
import { easeToken } from "@/lib/ease";
import { burst, piece, sceneTime, springIn, wobble, type Piece } from "@/lib/motion";

const LEN = 9;
const Y = 0.35;
/** Packets on the line: even slots classical, odd slots hybrid. */
const MAX = 14;
const SHARDS = 7;
const DRUM = new THREE.Vector3(-3.3, -0.95, 0.4);
const DRUM_H = 1.0;
const DRUM_R = 0.55;
/** A copy's fall from the line into the drum. */
const COPY_MS = 900;
const COPIES = 6;
/** The beat between the key falling and the packets breaking. */
const FREEZE_MS = 300;
const PIECES: Piece[][] = Array.from({ length: MAX }, (_, i) => burst(SHARDS, 0.07, 101 + i, 0.9));
const shardRot = new THREE.Euler();
const LINE: [number, number, number][] = [
  [-LEN / 2, Y, 0],
  [LEN / 2, Y, 0],
];

const mine = (e: { source: string }) => e.source === "browser";

export interface QDayFilmProps {
  state: DirectorState;
  onSettled: () => void;
  active: boolean;
  /** 0 = today … 1 = Q-Day (the time-lapse). */
  progress: number;
  /** Recorded packets so far (from the simulated network). */
  recorded: number;
  /** When the classical packets break (performance.now()), or 0. */
  breakAt: number;
  /** Real decrypted contents of the first broken records. */
  leaks: string[];
  exposed: number;
  qExposed: number | undefined;
  small: boolean;
  /** The estimated Q-Day year (from facts.ts). */
  qDayYear: number;
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
  qDayYear,
}: QDayFilmProps) {
  const c = useMemo(palette, []);
  const reduce = state.reduce;
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
  const geo = useMemo(
    () => ({
      capsule: new THREE.CapsuleGeometry(0.11, 0.26, 6, 16).rotateZ(Math.PI / 2),
      copy: new THREE.CapsuleGeometry(0.06, 0.13, 4, 12).rotateZ(Math.PI / 2),
      shard: new THREE.TetrahedronGeometry(0.075, 0),
      drum: new THREE.CylinderGeometry(DRUM_R, DRUM_R, DRUM_H, 48, 1, true),
      lid: new THREE.TorusGeometry(DRUM_R, 0.03, 10, 64).rotateX(Math.PI / 2),
      fill: new THREE.CylinderGeometry(DRUM_R * 0.9, DRUM_R * 0.9, 1, 48),
      halo: new THREE.SphereGeometry(0.26, 20, 14),
    }),
    [],
  );
  const mat = useMemo(() => {
    const solid = (
      col: THREE.Color,
      glow: number,
      extra: Partial<THREE.MeshStandardMaterialParameters> = {},
    ) =>
      new THREE.MeshStandardMaterial({
        color: col.clone(),
        emissive: col.clone(),
        emissiveIntensity: glow,
        roughness: 0.35,
        metalness: 0.1,
        ...extra,
      });
    return {
      classical: solid(c.warn, 0.45),
      hybrid: solid(c.kem, 0.5),
      shard: solid(c.warn, 0.6),
      copy: solid(c.warn, 0.5, { transparent: true }),
      drum: new THREE.MeshPhysicalMaterial({
        color: c.text3.clone(),
        transparent: true,
        opacity: 0.3,
        roughness: 0.2,
        clearcoat: 1,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
      lid: solid(c.warn, 0.6),
      fill: solid(c.warn, 0.35, { transparent: true, opacity: 0.55 }),
      halo: new THREE.MeshBasicMaterial({
        color: c.kem.clone(),
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
      }),
    };
  }, [c]);

  const classical = useRef<THREE.InstancedMesh>(null);
  const hybrid = useRef<THREE.InstancedMesh>(null);
  const halos = useRef<THREE.InstancedMesh>(null);
  const shards = useRef<THREE.InstancedMesh>(null);
  const copies = useRef<THREE.InstancedMesh>(null);
  const fill = useRef<THREE.Mesh>(null);
  const drum = useRef<THREE.Group>(null);
  const rim = useRef<THREE.DirectionalLight>(null);
  const o = useMemo(() => new THREE.Object3D(), []);
  const from = useMemo(() => new THREE.Vector3(), []);
  const react = useReactions(mine);
  // One falling copy per new real recording (at most COPIES in flight).
  const copyAt = useRef<Float64Array>(new Float64Array(COPIES));
  const copyX = useRef<Float32Array>(new Float32Array(COPIES));
  const seen = useRef(0);
  const nextCopy = useRef(0);
  const frozenAt = useRef<number | null>(null);
  const n = small ? MAX / 2 : MAX;

  const packetX = (i: number, t: number) =>
    (((((i / n) * LEN + t * 0.55) % LEN) + LEN) % LEN) - LEN / 2;

  useFrame(({ clock, scene }) => {
    if (!active) return;
    const now = performance.now();
    const t = reduce ? 0 : clock.elapsedTime;
    // Time-lapse: the light warms from blue-black to warm-black as the years pass.
    backdrop.color.copy(bgCool).lerp(bgWarm, progress);
    if (scene.fog) (scene.fog as THREE.Fog).color.copy(backdrop.color);
    if (rim.current) rim.current.intensity = 0.3 + 0.4 * progress;

    const broke = !!breakAt && now >= breakAt;
    if (!broke) frozenAt.current = null;
    else frozenAt.current ??= t;
    // Q-Day: the 300 ms freeze, then the impact under a slow-motion ramp (1 → 0.2 → 1).
    const since = broke ? (now - breakAt) / 1000 : 0;
    const at = FREEZE_MS / 1000;
    const tau = broke
      ? reduce
        ? 1.4
        : Math.max(0, sceneTime(since, at, 0.2, 0.2, 0.6) - sceneTime(at, at, 0.2, 0.2, 0.6))
      : 0;
    const b = Math.min(1, tau / 2.2);
    const glint = breakAt
      ? pulse(breakAt + FREEZE_MS, 900) + 0.5 * pulse(react.current.reject, 500)
      : 0;

    // New recordings: one copy drops from where a packet is into the drum.
    if (recorded < seen.current) {
      seen.current = 0;
      copyAt.current.fill(0);
    }
    for (let k = 0; seen.current < recorded && k < 2; k++, seen.current++) {
      const j = nextCopy.current++ % COPIES;
      copyAt.current[j] = now + k * 160;
      copyX.current[j] = packetX((seen.current * 2) % n, t);
    }

    const cm = classical.current;
    const hm = hybrid.current;
    const hl = halos.current;
    const sh = shards.current;
    const cp = copies.current;
    if (!cm || !hm || !hl || !sh || !cp) return;
    let ci = 0;
    let hi = 0;
    for (let i = 0; i < MAX; i++) {
      const on = i < n ? 1 : 0;
      const isHybrid = i % 2 === 1;
      // Packets enter with a spring as the film starts (and stand still under reduced motion).
      const enter = reduce ? 1 : springIn(Math.max(0, t - i * 0.06), 0.6, 1.6);
      if (!isHybrid) {
        const x = packetX(i, frozenAt.current ?? t);
        o.position.set(x, Y, 0);
        o.rotation.set(0, 0, 0);
        o.scale.setScalar(Math.max(0.0001, on * enter * (broke ? 0.0001 : 1)));
        o.updateMatrix();
        cm.setMatrixAt(ci, o.matrix);
        for (let k = 0; k < SHARDS; k++) {
          piece(PIECES[i]![k]!, tau, o.position, shardRot, { drag: 1.5, gravity: -0.6 });
          o.position.x += x;
          o.position.y += Y;
          o.rotation.copy(shardRot);
          o.scale.setScalar(Math.max(0.0001, on * (broke ? 1 - 0.5 * b : 0)));
          o.updateMatrix();
          sh.setMatrixAt(ci * SHARDS + k, o.matrix);
        }
        ci++;
      } else {
        // Hybrid: keeps moving; the shock wave reaches it after |x| / 8 s and rings down.
        const x = packetX(i, t);
        const shock = breakAt && !reduce ? wobble(since - at - Math.abs(x) / 8, 2.2, 3.2) : 0;
        o.position.set(x, Y + 0.05 * shock, 0);
        o.rotation.set(0, 0, 0.1 * shock);
        o.scale.setScalar(Math.max(0.0001, on * enter * (1 + 0.15 * Math.min(1, glint))));
        o.updateMatrix();
        hm.setMatrixAt(hi, o.matrix);
        o.scale.setScalar(Math.max(0.0001, on * (broke ? 1 : 0.0001)));
        o.updateMatrix();
        hl.setMatrixAt(hi, o.matrix);
        hi++;
      }
    }
    cm.instanceMatrix.needsUpdate = hm.instanceMatrix.needsUpdate = true;
    hl.instanceMatrix.needsUpdate = sh.instanceMatrix.needsUpdate = true;
    sh.visible = broke;
    // The hybrid packets' --kem glow after Q-Day.
    mat.halo.opacity = broke ? 0.18 + 0.3 * Math.min(1, glint) : 0;
    mat.hybrid.emissiveIntensity = 0.5 + (broke ? 0.5 + 0.6 * Math.min(1, glint) : 0);

    // The copies: an arc from the line down into the drum's mouth.
    for (let j = 0; j < COPIES; j++) {
      const u = copyAt.current[j] && !reduce ? (now - copyAt.current[j]!) / COPY_MS : 2;
      const vis = u >= 0 && u <= 1;
      from.set(copyX.current[j]!, Y - 0.15, 0);
      const e = easeToken(Math.min(1, Math.max(0, u)));
      o.position.set(
        from.x + (DRUM.x - from.x) * e,
        from.y + (DRUM.y + DRUM_H / 2 - from.y) * e + 0.5 * Math.sin(Math.PI * e),
        from.z + (DRUM.z - from.z) * e,
      );
      o.rotation.set(0, 0, -1.2 * e);
      o.scale.setScalar(vis ? 1 - 0.4 * e : 0.0001);
      o.updateMatrix();
      cp.setMatrixAt(j, o.matrix);
    }
    cp.instanceMatrix.needsUpdate = true;
    // The drum fills with what it has recorded (to 85% at Q-Day), and bumps on each landing copy.
    if (fill.current) {
      const level = Math.max(0.04, Math.min(0.85, 0.12 + 0.73 * progress));
      fill.current.scale.y = level * DRUM_H;
      fill.current.position.y = -DRUM_H / 2 + (level * DRUM_H) / 2;
    }
    if (drum.current) {
      let landed = 0;
      for (let j = 0; j < COPIES; j++)
        landed = Math.max(landed, pulse(copyAt.current[j]! + COPY_MS, 350));
      drum.current.scale.setScalar(1 + (reduce ? 0 : 0.04 * landed));
    }
  });

  const id = state.shot.id;
  const show = state.settled;
  // Label anchors: a classical packet's and a hybrid packet's lane, left of centre.
  return (
    <Thicken>
      <DirectorCamera state={state} onSettled={onSettled} drift={0.02} />
      <fog attach="fog" args={[c.bg, 7, 18]} />
      <mesh position={[0, 0, -9]} material={backdrop} renderOrder={-2}>
        <planeGeometry args={[80, 50]} />
      </mesh>
      <ambientLight intensity={0.55} />
      <directionalLight position={[2, 4, 5]} intensity={1.1} />
      <directionalLight ref={rim} position={[0, 2, -6]} intensity={0.3} color={c.warn} />
      <gridHelper args={[24, 48, c.text3, c.text3]} position={[0, -1.9, 0]}>
        <meshBasicMaterial
          attach="material"
          color={c.text3}
          transparent
          depthWrite={false}
          opacity={0.06}
        />
      </gridHelper>

      {/* The one line all traffic travels on. */}
      <Line
        points={LINE}
        lineWidth={2.5}
        color={c.text3}
        transparent
        opacity={0.45}
        depthWrite={false}
      />
      <instancedMesh ref={classical} args={[geo.capsule, mat.classical, MAX / 2]} />
      <instancedMesh ref={hybrid} args={[geo.capsule, mat.hybrid, MAX / 2]} />
      <instancedMesh ref={halos} args={[geo.halo, mat.halo, MAX / 2]} />
      <instancedMesh
        ref={shards}
        args={[geo.shard, mat.shard, (MAX / 2) * SHARDS]}
        visible={false}
      />

      {/* The attacker's drum (the simulated network's recorder) and the copies falling into it. */}
      <group ref={drum} position={DRUM}>
        <mesh geometry={geo.drum} material={mat.drum} />
        <mesh ref={fill} geometry={geo.fill} material={mat.fill} />
        <mesh geometry={geo.lid} material={mat.lid} position={[0, DRUM_H / 2, 0]} />
        <mesh geometry={geo.lid} material={mat.lid} position={[0, -DRUM_H / 2, 0]} />
      </group>
      <instancedMesh ref={copies} args={[geo.copy, mat.copy, COPIES]} />

      {/* Which is which: one label per kind of packet. */}
      <Anchor
        position={[-1.6, Y + 0.25, 0]}
        label="Classical packets"
        value="RSA / ECDH keys"
        role="warn"
        show={show && (id === "split" || id === "climax")}
      />
      <Anchor
        position={[1.6, Y - 0.25, 0]}
        label="Hybrid packets"
        value="X25519 + ML-KEM-768"
        role="kem"
        side="down"
        show={show && (id === "split" || id === "climax")}
      />
      <Anchor
        position={[DRUM.x, DRUM.y - DRUM_H / 2 - 0.1, DRUM.z]}
        side="down"
        label="Attacker storage (sim)"
        value={`${recorded.toLocaleString("en-IN")} packets recorded`}
        role="warn"
        show={show && (id === "split" || id === "timelapse")}
      />
      <Anchor
        position={[DRUM.x + 1.2, DRUM.y, DRUM.z]}
        label="Estimated Q-Day"
        value={`${qDayYear} (estimate)`}
        role="warn"
        side="down"
        show={show && id === "timelapse"}
      />
      {/* The climax: the real decrypted contents float out of the broken packets. */}
      {leaks.slice(0, small ? 1 : 2).map((text, i) => (
        <Anchor
          key={i}
          position={[i === 0 ? -1.3 : 1.3, Y + 0.5, 0]}
          label="Decrypted"
          value={text.length > 24 ? `${text.slice(0, 23)}…` : text}
          role="warn"
          show={show && id === "climax" && !!breakAt && reduce}
        />
      ))}
      {/* One record's real plaintext rises out of the break (one is enough to read; more overlap). */}
      {!reduce && leaks[0] && (
        <FloatingText
          text={leaks[0]}
          from={[-1.4, Y + 0.7, 0.3]}
          start={breakAt ? breakAt + FREEZE_MS + 600 : 0}
          show={id === "climax" && !!breakAt}
        />
      )}
      <Anchor
        position={[2.6, Y - 0.25, 0]}
        label="Hybrid · still sealed"
        value={qExposed === undefined ? "AES-GCM tag mismatch" : `${qExposed} records opened`}
        role="kem"
        side="down"
        show={show && (id === "climax" || id === "aftermath") && qExposed !== undefined}
      />
      <Anchor
        position={[-2.6, Y + 0.25, 0]}
        label="Classical · exposed"
        value={`${exposed.toLocaleString("en-IN")} records opened`}
        role="warn"
        show={show && id === "aftermath"}
      />
    </Thicken>
  );
}

/** Large type that rises slowly from a point in the scene and fades in (a DOM overlay: no font download). */
function FloatingText({
  text,
  from,
  start,
  show,
}: {
  text: string;
  from: [number, number, number];
  start: number;
  show: boolean;
}) {
  const g = useRef<THREE.Group>(null);
  const el = useRef<HTMLDivElement>(null);
  useFrame(() => {
    if (!g.current || !el.current) return;
    const k = show && start ? easeToken(span(performance.now() - start, 0, 2600)) : 0;
    g.current.position.set(from[0], from[1] + 0.45 * k, from[2] + 0.3 * k);
    el.current.style.opacity = String(Math.min(1, k * 1.6));
  });
  return (
    <group ref={g}>
      <Html center zIndexRange={[5, 0]} style={{ pointerEvents: "none" }}>
        <div
          ref={el}
          className="whitespace-nowrap font-mono text-h3 text-warn opacity-0"
          aria-hidden
        >
          <span className="block text-label uppercase text-fg-3">decrypted</span>
          {text.length > 28 ? `${text.slice(0, 27)}…` : text}
        </div>
      </Html>
    </group>
  );
}
