"use client";

/**
 * Demo 1 as a short film: two keys combine so a quantum computer can't read the session.
 *
 * The browser (left) and the server (right) are glass blocks. Each builds one half of the key out
 * of two solid pieces, each piece appearing only once its real value exists:
 *   - the browser's X25519 share (--kem) when the ClientHello is made;
 *   - the server's X25519 share (--kem) and its ML-KEM-768 key (--sig), with the ML-DSA signature
 *     ring round them, when the signed ServerHello is made;
 *   - the browser's ML-KEM-768 ciphertext (--sig) when it encapsulates (the finish).
 * Merge: the two halves fly to the centre, lock together with a pulse and become one --ok "shared
 * key" cube (the real HKDF session). Then AES-256-GCM messages run along the link as capsules; an
 * attack is a --danger capsule that shatters on the signature ring.
 * Motion is springs with a slight overshoot; reduced motion shows each shot's composed end state.
 * Real bus events (seal / verify / rotate) nudge the object they belong to.
 */
import { Line } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { Anchor } from "@/components/director/Anchor";
import { DirectorCamera } from "@/components/director/DirectorCamera";
import { pulse, useReactions } from "@/components/director/reactions";
import type { DirectorState } from "@/components/director/types";
import { span } from "@/components/scenes/geometry";
import { PushDust } from "@/components/scenes/PushDust";
import { Thicken } from "@/components/scenes/Thicken";
import { palette } from "@/components/world/palette";
import { easeToken } from "@/lib/ease";
import { burst, piece, springIn, type Piece } from "@/lib/motion";

export interface Film {
  shareHex?: string;
  /** When the browser's X25519 share was made (performance.now()). */
  shareAt?: number;
  helloBytes?: number;
  /** Real compute time of each handshake step in this tab (ms). */
  helloMs?: number;
  respondMs?: number;
  finishMs?: number;
  x25519Bytes?: number;
  packetAt?: number;
  kemPkBytes?: number;
  sigBytes?: number;
  ctBytes?: number;
  signedAt?: number;
  verified?: boolean;
  finishBytes?: number;
  mergeAt?: number;
  sessionId?: string;
  sparks?: boolean;
  perUs?: number;
  perSecond?: number;
  attackAt?: number;
  attackRejected?: boolean;
  rekeyAt?: number;
}

export const CLIENT = new THREE.Vector3(-2.6, 0, 0);
export const SERVER = new THREE.Vector3(2.6, 0, 0);
/** Where each side builds its half of the key (above its block), and where the halves lock. */
const BUILD_C = new THREE.Vector3(-2.6, 1.2, 0);
const BUILD_S = new THREE.Vector3(2.6, 1.2, 0);
const CENTER = new THREE.Vector3(0, 1.0, 0);
/** One key piece: a quarter of the final cube (the halves split left/right, X25519 over ML-KEM). */
const Q = 0.3;
const GAP = 0.03;
const ARC = new THREE.CubicBezierCurve3(
  new THREE.Vector3(-2.1, 0.55, 0),
  new THREE.Vector3(-1, 2.1, 0.3),
  new THREE.Vector3(1, 2.1, 0.3),
  new THREE.Vector3(2.1, 0.55, 0),
);
const ARC_POINTS = ARC.getPoints(64);
const LINK_Y = -0.15;
const LINK: [number, number, number][] = [
  [-2.15, LINK_Y, 0],
  [2.15, LINK_Y, 0],
];
const PACKET_MS = 1600;
const ATTACK_MS = 1500;
/** The merge: the browser's ML-KEM piece appears, the halves fly, lock (at LOCK), turn --ok. */
const MERGE_MS = 2600;
const LOCK = 0.62;
const MSGS = 18;
const SHARDS = 14;
const ATTACK_FROM = new THREE.Vector3(0.6, 2.8, 1.4);
const ATTACK_TO = new THREE.Vector3(BUILD_S.x - 0.55, BUILD_S.y, 0.05);
const SHARD_PIECES: Piece[] = burst(SHARDS, 0.06, 7, 1.4);
const shardRot = new THREE.Euler();

const browserOnly = (e: { source: string }) => e.source === "browser";
/** A spring with a slight overshoot and settle (about 9% over, settled in ~0.6 s). */
const sp = (ms: number, reduce: boolean) =>
  reduce ? 1 : ms <= 0 ? 0 : springIn(ms / 1000, 0.6, 1.8);
const fmtB = (n?: number) => (n === undefined ? "…" : `${n.toLocaleString("en-IN")} B`);
const fmtMs = (n?: number) =>
  n === undefined ? "…" : `${n < 10 ? n.toFixed(2) : n.toFixed(1)} ms`;

export default function HandshakeFilm({
  state,
  onSettled,
  film,
  kemName,
  sigName,
  active,
}: {
  state: DirectorState;
  onSettled: () => void;
  film: Film;
  kemName: string;
  sigName: string;
  /** False while the stage is off screen: skip all per-frame work. */
  active: boolean;
}) {
  const c = useMemo(palette, []);
  const reduce = state.reduce;
  const small = useMemo(() => window.matchMedia("(max-width: 767px)").matches, []);

  const geo = useMemo(
    () => ({
      piece: new THREE.BoxGeometry(Q - GAP, Q - GAP, 2 * Q - GAP),
      key: new THREE.BoxGeometry(2 * Q, 2 * Q, 2 * Q),
      capsule: new THREE.CapsuleGeometry(0.05, 0.14, 4, 12).rotateZ(Math.PI / 2),
      packet: new THREE.CapsuleGeometry(0.08, 0.2, 4, 16).rotateZ(Math.PI / 2),
      shard: new THREE.TetrahedronGeometry(0.07, 0),
      ring: new THREE.TorusGeometry(0.52, 0.022, 12, 96),
      pulse: new THREE.TorusGeometry(0.5, 0.012, 8, 96),
    }),
    [],
  );
  const mat = useMemo(() => {
    const solid = (col: THREE.Color, glow = 0.5) =>
      new THREE.MeshStandardMaterial({
        color: col.clone(),
        emissive: col.clone(),
        emissiveIntensity: glow,
        roughness: 0.35,
        metalness: 0.1,
        transparent: true,
      });
    const glass = () =>
      new THREE.MeshPhysicalMaterial({
        color: c.text3.clone(),
        transparent: true,
        opacity: 0.28,
        roughness: 0.12,
        emissive: c.text3.clone(),
        emissiveIntensity: 0.12,
        metalness: 0,
        clearcoat: 1,
        clearcoatRoughness: 0.1,
        depthWrite: false,
      });
    return {
      client: glass(),
      server: glass(),
      xC: solid(c.kem),
      kC: solid(c.sig),
      xS: solid(c.kem),
      kS: solid(c.sig),
      key: solid(c.ok, 0.6),
      packet: solid(c.kem, 0.8),
      msg: solid(c.kem, 0.8),
      ring: solid(c.sig, 0.7),
      attack: solid(c.danger, 0.8),
      shard: solid(c.danger, 0.7),
      pulse: new THREE.MeshBasicMaterial({
        color: c.ok.clone(),
        transparent: true,
        depthWrite: false,
        toneMapped: false,
      }),
    };
  }, [c]);

  const clientG = useRef<THREE.Group>(null);
  const serverG = useRef<THREE.Group>(null);
  const halfC = useRef<THREE.Group>(null);
  const halfS = useRef<THREE.Group>(null);
  const pieces = useRef<(THREE.Mesh | null)[]>([]);
  const keyCube = useRef<THREE.Mesh>(null);
  const ring = useRef<THREE.Mesh>(null);
  const lockRing = useRef<THREE.Mesh>(null);
  const packet = useRef<THREE.Mesh>(null);
  const msgs = useRef<THREE.InstancedMesh>(null);
  const attackPkt = useRef<THREE.Mesh>(null);
  const shards = useRef<THREE.InstancedMesh>(null);
  const arcLine = useRef<{ material: { color: THREE.Color; opacity: number } }>(null);
  const linkLine = useRef<{ material: { color: THREE.Color; opacity: number } }>(null);
  const o = useMemo(() => new THREE.Object3D(), []);
  const v = useMemo(() => new THREE.Vector3(), []);
  const w = useMemo(() => new THREE.Vector3(), []);
  const msgT = useRef(Float32Array.from({ length: MSGS }, (_, i) => i / MSGS));
  const packetPos = useRef(new THREE.Vector3());
  const react = useReactions(browserOnly);
  const track = () => (state.shot.id === "packet" ? packetPos.current : null);

  useFrame(({ clock }, dt) => {
    if (!active) return;
    const now = performance.now();
    const t = reduce ? 0 : clock.elapsedTime;
    const id = state.shot.id;
    const rot = pulse(react.current.rotate, 700);
    const rekey = film.rekeyAt && !reduce ? easeToken(Math.min(1, (now - film.rekeyAt) / 700)) : 1;

    // The blocks: a slow breath, a nudge on each real re-key.
    for (const g of [clientG.current, serverG.current]) {
      if (!g) continue;
      g.scale.setScalar((reduce ? 1 : 1 + 0.01 * Math.sin(t * 1.1)) * (1 + 0.03 * rot));
      g.rotation.y = (g === clientG.current ? 0.35 : -0.35) * rekey;
    }
    const keyed = !!film.sessionId;
    mat.client.color.lerp(keyed ? c.ok : c.text3, Math.min(1, dt * 3));
    mat.server.color.lerp(keyed ? c.ok : c.text3, Math.min(1, dt * 3));

    // ── The pieces. Each springs in when its real value exists. ───────────────────────────
    const mergeMs = film.mergeAt ? now - film.mergeAt : -1;
    const m = film.mergeAt ? (reduce ? 1 : span(mergeMs, 0, MERGE_MS)) : 0;
    const ctIn = film.mergeAt ? sp(mergeMs, reduce) : film.sessionId ? 1 : 0;
    const grow = [
      film.shareAt ? sp(now - film.shareAt, reduce) : 0, // browser X25519
      ctIn, // browser ML-KEM ciphertext (made on the finish)
      film.signedAt ? sp(now - film.signedAt, reduce) : 0, // server X25519
      film.signedAt ? sp(now - film.signedAt - 180, reduce) : 0, // server ML-KEM-768 key
    ];
    const locked = m >= LOCK;
    pieces.current.forEach((p, i) => {
      if (!p) return;
      p.visible = grow[i]! > 0.001 && !locked;
      p.scale.setScalar(Math.max(0.0001, grow[i]!));
    });
    // The flight: both halves lift and close on the centre, from 22% to LOCK of the merge.
    const f = reduce ? (film.mergeAt ? 1 : 0) : easeToken(span(m, 0.22, LOCK));
    const lift = Math.sin(Math.PI * f) * 0.35;
    if (halfC.current) {
      halfC.current.position.lerpVectors(BUILD_C, w.copy(CENTER).add(v.set(-Q / 2, 0, 0)), f);
      halfC.current.position.y += lift;
      halfC.current.rotation.y = reduce ? 0 : 0.4 * Math.sin(t * 0.6) * (1 - f);
    }
    if (halfS.current) {
      halfS.current.position.lerpVectors(BUILD_S, w.copy(CENTER).add(v.set(Q / 2, 0, 0)), f);
      halfS.current.position.y += lift;
      halfS.current.rotation.y = reduce ? 0 : -0.4 * Math.sin(t * 0.6) * (1 - f);
    }
    // Lock: one --ok cube, a click (spring from 0.85) and a pulse ring.
    const lockMs = film.mergeAt ? mergeMs - LOCK * MERGE_MS : -1;
    if (keyCube.current) {
      // Only once the halves have locked (or, under reduced motion, once the session exists).
      const on = reduce ? (film.sessionId ? 1 : 0) : locked ? 1 : 0;
      keyCube.current.visible = on > 0;
      const click =
        reduce || !film.mergeAt ? 1 : 0.85 + 0.15 * springIn(Math.max(0, lockMs) / 1000, 0.45, 2.4);
      keyCube.current.scale.setScalar(click * (1 + 0.06 * pulse(react.current.seal, 400)));
      keyCube.current.rotation.set(0.35, reduce ? 0.6 : 0.6 + t * 0.35, 0);
      mat.key.emissiveIntensity =
        0.6 + (reduce ? 0 : 0.8 * Math.max(0, 1 - Math.max(0, lockMs) / 500));
    }
    if (lockRing.current) {
      const k = !reduce && lockMs > 0 ? span(lockMs, 0, 900) : 0;
      lockRing.current.visible = k > 0 && k < 1;
      lockRing.current.scale.setScalar(0.6 + 2.2 * easeToken(k));
      mat.pulse.opacity = 0.9 * (1 - k);
    }

    // The signature ring round the server's half: on when signed; flashes on verify; red on attack.
    if (ring.current) {
      const s = film.signedAt ? sp(now - film.signedAt - 300, reduce) : 0;
      const hit = film.attackAt ? pulse(film.attackAt + ATTACK_MS, 600) : 0;
      ring.current.visible = s > 0.001 && f < 0.05;
      ring.current.scale.setScalar(
        Math.max(0.0001, s) * (1 + 0.08 * pulse(react.current.verify, 600) + 0.15 * hit),
      );
      ring.current.rotation.z += reduce ? 0 : dt * 0.25;
      mat.ring.color.copy(hit > 0.05 ? c.danger : c.sig);
      mat.ring.emissive.copy(mat.ring.color);
    }

    // The ClientHello: a --kem capsule along the arc (the arc lights while it travels).
    const pt = film.packetAt ? (now - film.packetAt) / PACKET_MS : -1;
    if (packet.current) {
      const along = reduce ? (id === "packet" && film.helloBytes ? 0.5 : -1) : pt;
      packet.current.visible = along >= 0 && along < 1;
      ARC.getPoint(easeToken(Math.min(1, Math.max(0, along))), packetPos.current);
      packet.current.position.copy(packetPos.current);
      ARC.getTangent(Math.min(1, Math.max(0, along)), v);
      packet.current.rotation.z = Math.atan2(v.y, v.x);
    }
    if (arcLine.current) {
      const lit = pt >= 0 && pt < 1.2 ? 1 : 0;
      arcLine.current.material.color.copy(c.text3).lerp(c.kem, lit * 0.8);
      arcLine.current.material.opacity = 0.35 + 0.45 * lit;
    }

    // AES-256-GCM messages: capsules along the link, brighter on each real seal.
    const ms = msgs.current;
    if (ms) {
      ms.visible = !!film.sparks;
      ms.count = small ? MSGS / 2 : MSGS;
      const glow = 1 + 0.5 * pulse(react.current.seal, 400);
      for (let i = 0; i < MSGS; i++) {
        msgT.current[i] = reduce ? i / MSGS : (msgT.current[i]! + dt * 0.55) % 1;
        const u = msgT.current[i]!;
        o.position.set(LINK[0]![0] + (LINK[1]![0] - LINK[0]![0]) * u, LINK_Y, 0);
        o.rotation.set(0, 0, 0);
        o.scale.setScalar(glow * Math.min(1, Math.sin(Math.PI * u) * 3));
        o.updateMatrix();
        ms.setMatrixAt(i, o.matrix);
      }
      ms.instanceMatrix.needsUpdate = true;
    }
    if (linkLine.current) {
      linkLine.current.material.color.copy(film.sparks ? c.kem : c.text3);
      linkLine.current.material.opacity = film.sparks ? 0.7 : 0.3;
    }

    // Attack: a --danger capsule hits the signature ring and shatters (velocity, spin, gravity).
    if (attackPkt.current && shards.current) {
      const a = film.attackAt ? (now - film.attackAt) / ATTACK_MS : -1;
      attackPkt.current.visible = !reduce && a >= 0 && a < 1;
      attackPkt.current.position.lerpVectors(
        ATTACK_FROM,
        ATTACK_TO,
        easeToken(Math.min(1, Math.max(0, a))),
      );
      const tau = film.attackAt
        ? reduce
          ? 0.5
          : Math.max(0, (now - film.attackAt - ATTACK_MS) / 1000)
        : 0;
      shards.current.visible = !!film.attackAt && tau > 0 && tau < 1.6;
      const fade = 1 - span(tau, 0.9, 1.6);
      for (let i = 0; i < SHARDS; i++) {
        piece(SHARD_PIECES[i]!, tau, o.position, shardRot, { drag: 1.6, gravity: -0.9 });
        o.position.add(ATTACK_TO);
        o.rotation.copy(shardRot);
        o.scale.setScalar(Math.max(0.0001, fade));
        o.updateMatrix();
        shards.current.setMatrixAt(i, o.matrix);
      }
      shards.current.instanceMatrix.needsUpdate = true;
    }
  });

  const show = state.settled;
  const id = state.shot.id;
  const total =
    film.helloMs !== undefined && film.respondMs !== undefined && film.finishMs !== undefined
      ? film.helloMs + film.respondMs + film.finishMs
      : undefined;
  // During the merge the camera orbits ~25° round the lock (none under reduced motion).
  const mergeOrbit = () =>
    film.mergeAt && id === "merge" && !reduce
      ? 0.45 * easeToken(span(performance.now() - film.mergeAt, 0, MERGE_MS))
      : 0;
  // The four pieces: [browser X25519, browser ML-KEM ct, server X25519, server ML-KEM key].
  const pieceAt: [number, number, number][] = [
    [0, Q / 2, 0],
    [0, -Q / 2, 0],
    [0, Q / 2, 0],
    [0, -Q / 2, 0],
  ];
  const pieceMat = [mat.xC, mat.kC, mat.xS, mat.kS];
  return (
    <Thicken>
      <DirectorCamera state={state} onSettled={onSettled} track={track} autoYaw={mergeOrbit} />
      <fog attach="fog" args={[c.bg, 7, 18]} />
      <ambientLight intensity={0.55} />
      <directionalLight position={[3, 5, 4]} intensity={1.1} />
      <directionalLight position={[-4, 1, -5]} intensity={0.5} color={c.kem} />
      <gridHelper args={[24, 48, c.text3, c.text3]} position={[0, -1.1, 0]}>
        <meshBasicMaterial
          attach="material"
          color={c.text3}
          transparent
          depthWrite={false}
          opacity={0.07}
        />
      </gridHelper>

      {/* The two ends: glass blocks (the browser a slab, the server a tower). */}
      <group ref={clientG} position={CLIENT}>
        <mesh material={mat.client}>
          <boxGeometry args={[0.9, 1.2, 0.18]} />
        </mesh>
      </group>
      <group ref={serverG} position={SERVER}>
        <mesh material={mat.server}>
          <boxGeometry args={[0.85, 1.5, 0.7]} />
        </mesh>
      </group>

      {/* The links: the open arc the ClientHello travels, and the sealed link messages run on. */}
      <Line
        ref={arcLine as never}
        points={ARC_POINTS}
        lineWidth={2.5}
        color={c.text3}
        transparent
        opacity={0.35}
        depthWrite={false}
      />
      <Line
        ref={linkLine as never}
        points={LINK}
        lineWidth={2.5}
        color={c.text3}
        transparent
        opacity={0.3}
        depthWrite={false}
      />

      {/* Each side's half of the key: X25519 (--kem) over ML-KEM-768 (--sig). */}
      <group ref={halfC} position={BUILD_C}>
        {[0, 1].map((i) => (
          <mesh
            key={i}
            ref={(m) => void (pieces.current[i] = m)}
            geometry={geo.piece}
            material={pieceMat[i]}
            position={pieceAt[i]}
            visible={false}
          />
        ))}
      </group>
      <group ref={halfS} position={BUILD_S}>
        {[2, 3].map((i) => (
          <mesh
            key={i}
            ref={(m) => void (pieces.current[i] = m)}
            geometry={geo.piece}
            material={pieceMat[i]}
            position={pieceAt[i]}
            visible={false}
          />
        ))}
        <mesh ref={ring} geometry={geo.ring} material={mat.ring} visible={false} />
      </group>
      <mesh ref={keyCube} geometry={geo.key} material={mat.key} position={CENTER} visible={false} />
      <mesh
        ref={lockRing}
        geometry={geo.pulse}
        material={mat.pulse}
        position={CENTER}
        visible={false}
      />
      {film.mergeAt !== undefined && (
        <PushDust
          color={c.ok}
          count={small ? 60 : 120}
          inner={0.5}
          outer={1.6}
          opacity={0.4}
          reduce={reduce}
          since={() =>
            film.mergeAt ? (performance.now() - film.mergeAt - LOCK * MERGE_MS) / 1000 : -1
          }
        />
      )}

      <mesh ref={packet} geometry={geo.packet} material={mat.packet} visible={false} />
      <instancedMesh ref={msgs} args={[geo.capsule, mat.msg, MSGS]} visible={false} />
      <mesh ref={attackPkt} geometry={geo.packet} material={mat.attack} visible={false} />
      <instancedMesh ref={shards} args={[geo.shard, mat.shard, SHARDS]} visible={false} />

      {/* Labels: real values, shown once the camera has settled on their beat. */}
      <Anchor
        position={[-2.6, -0.75, 0]}
        label="Browser"
        value="client · this tab"
        show={show && (id === "establish" || id === "pullback")}
        side="down"
      />
      <Anchor
        position={[2.6, -0.9, 0]}
        label="Server"
        value={`${sigName} identity`}
        show={show && (id === "establish" || id === "pullback")}
        side="down"
      />
      <Anchor
        position={[BUILD_C.x, BUILD_C.y + 0.4, 0]}
        label="X25519 share"
        role="kem"
        value={`${fmtB(film.x25519Bytes)} · ${fmtMs(film.helloMs)}`}
        show={show && id === "client" && !!film.shareHex}
      />
      <Anchor
        position={[0, 2.25, 0.3]}
        label="ClientHello · in the open"
        role="kem"
        value={fmtB(film.helloBytes)}
        show={show && id === "packet"}
      />
      <Anchor
        position={[BUILD_S.x, BUILD_S.y + 0.65, 0]}
        label={`X25519 + ${kemName} key · ${sigName} signed`}
        role="sig"
        value={
          film.kemPkBytes && film.sigBytes
            ? `${fmtB(film.kemPkBytes)} key · ${fmtB(film.sigBytes)} signature · ${fmtMs(film.respondMs)}${film.verified ? " · verified ✓" : ""}`
            : "…"
        }
        show={show && id === "server" && !!film.signedAt}
      />
      <Anchor
        position={[CENTER.x, CENTER.y + 0.55, 0]}
        label="Shared key · HKDF-SHA256"
        role="ok"
        value={
          film.sessionId
            ? `32 B · ${kemName} ct ${fmtB(film.ctBytes)} · handshake ${fmtMs(total)}`
            : "deriving…"
        }
        show={show && id === "merge" && !!film.sessionId}
      />
      <Anchor
        position={[0, LINK_Y - 0.25, 0]}
        label="AES-256-GCM messages"
        role="kem"
        side="down"
        value={
          film.perUs !== undefined
            ? `${Math.round(film.perSecond ?? 0).toLocaleString("en-IN")} msg/s · ${film.perUs.toFixed(1)} µs each`
            : "…"
        }
        show={show && id === "pullback" && !!film.sparks}
      />
      <Anchor
        position={[ATTACK_TO.x, ATTACK_TO.y + 0.6, 0]}
        label={`${sigName} verify ✗ · rejected`}
        role="danger"
        value="forged ML-KEM key, original signature"
        show={show && id === "attack" && !!film.attackRejected}
      />
    </Thicken>
  );
}
