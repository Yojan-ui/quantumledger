"use client";

/**
 * Demo 1 as a short film. Two lattice cubes (client, server) on a faint grid in fog. Every object
 * appears when its real crypto has happened, and labels carry the real bytes:
 *   client key share (X25519) → KEM packet along the tube → SIG ring around the server's ML-KEM key
 *   → classical + post-quantum halves fuse through the HKDF lens → AES-GCM sparks between the cubes.
 * Real bus events (seal / verify / reject / rotate) ripple the object they belong to.
 * Once the session exists (the real HKDF merge), the endpoints become the diagnostics stage's
 * glowing icospheres and a flowing --kem particle arc joins them (Stage 3).
 */
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { Anchor } from "@/components/director/Anchor";
import { DirectorCamera } from "@/components/director/DirectorCamera";
import { pulse, useReactions } from "@/components/director/reactions";
import type { DirectorState } from "@/components/director/types";
import { latticeCube, span, set3 } from "@/components/scenes/geometry";
import { palette } from "@/components/world/palette";
import { easeToken } from "@/lib/ease";
import { PushDust } from "@/components/scenes/PushDust";
import { Thicken } from "@/components/scenes/Thicken";

export interface Film {
  shareHex?: string;
  helloBytes?: number;
  packetAt?: number;
  kemPkBytes?: number;
  sigBytes?: number;
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
const TUBE = new THREE.CubicBezierCurve3(
  new THREE.Vector3(-2.05, 0.35, 0),
  new THREE.Vector3(-1, 1.7, 0.3),
  new THREE.Vector3(1, 1.7, 0.3),
  new THREE.Vector3(2.05, 0.35, 0),
);
// Fixed points the per-frame code lerps between (allocated once, not every frame).
const MERGE_A = new THREE.Vector3(-0.05, 0, 0);
const MERGE_B = new THREE.Vector3(0.05, 0, 0);
const MERGE_MS = 2600;
const ATTACK_FROM = new THREE.Vector3(-1, 2.4, 1.2);
const ATTACK_TO = new THREE.Vector3(2.6 - 0.6, 0.1, 0);
const PACKET_MS = 1600;
const ATTACK_MS = 1500;
const SPARKS = 48;
const ARC_N = 260;
const ARC_LUT = TUBE.getSpacedPoints(160);

const browserOnly = (e: { source: string }) => e.source === "browser";

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
  const cube = useMemo(() => latticeCube(1.1, 3), []);
  const tubeGeo = useMemo(() => new THREE.TubeGeometry(TUBE, 96, 0.006, 6, false), []);
  const shareGeo = useMemo(() => {
    // The X25519 share as a small sphere of points (a 32-byte value made visible).
    const pts: number[] = [];
    for (let i = 0; i < 160; i++) {
      const y = 1 - (i / 159) * 2;
      const r = Math.sqrt(1 - y * y);
      const th = i * 2.399963;
      pts.push(Math.cos(th) * r * 0.28, y * 0.28, Math.sin(th) * r * 0.28);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
    return g;
  }, []);
  const mats = useMemo(
    () => ({
      client: new THREE.LineBasicMaterial({
        color: c.text3.clone(),
        transparent: true,
        depthWrite: false,
      }),
      server: new THREE.LineBasicMaterial({
        color: c.text3.clone(),
        transparent: true,
        depthWrite: false,
      }),
      tube: new THREE.MeshBasicMaterial({
        color: c.text3.clone(),
        transparent: true,
        depthWrite: false,
        opacity: 0.5,
      }),
    }),
    [c],
  );
  // Stage 3's endpoints and arc.
  const ico = useMemo(() => new THREE.IcosahedronGeometry(0.42, 1), []);
  const icoEdges = useMemo(() => new THREE.EdgesGeometry(ico), [ico]);
  const icoFill = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: c.kem,
        transparent: true,
        opacity: 0.3,
        depthWrite: false,
        toneMapped: false,
      }),
    [c],
  );
  const icoLine = useMemo(
    () =>
      new THREE.LineBasicMaterial({
        color: c.text,
        transparent: true,
        depthWrite: false,
        toneMapped: false,
      }),
    [c],
  );
  const icoA = useRef<THREE.Group>(null);
  const icoB = useRef<THREE.Group>(null);
  const arc = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(ARC_N * 3), 3));
    const m = new THREE.PointsMaterial({
      color: c.kem,
      size: 0.035,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    });
    const p = new THREE.Points(g, m);
    p.frustumCulled = false;
    const seed = Array.from({ length: ARC_N }, (_, i) => [
      (i * 0.6180339) % 1,
      Math.sin(i * 12.9898) * 0.06,
      Math.cos(i * 78.233) * 0.06,
      0.6 + ((i * 0.37) % 0.8),
    ]);
    return { p, g, m, seed };
  }, [c]);
  const arcV = useMemo(() => new THREE.Vector3(), []);
  const clientG = useRef<THREE.Group>(null);
  const serverG = useRef<THREE.Group>(null);
  const share = useRef<THREE.Points>(null);
  const packet = useRef<THREE.Mesh>(null);
  const ring = useRef<THREE.Mesh>(null);
  const pk = useRef<THREE.Mesh>(null);
  const halfA = useRef<THREE.Mesh>(null);
  const halfB = useRef<THREE.Mesh>(null);
  const lens = useRef<THREE.Mesh>(null);
  const key = useRef<THREE.Mesh>(null);
  const flash = useRef<THREE.Mesh>(null);
  const sparks = useRef<THREE.InstancedMesh>(null);
  const attackPkt = useRef<THREE.Mesh>(null);
  const shards = useRef<THREE.InstancedMesh>(null);
  const o = useMemo(() => new THREE.Object3D(), []);
  const tmp = useMemo(() => new THREE.Vector3(), []);
  const sparkT = useRef(Float32Array.from({ length: SPARKS }, (_, i) => i / SPARKS));
  const react = useReactions(browserOnly);
  // Phones: half the sparks and no focus pull. Reduced motion: no focus pull either.
  const nearV = useMemo(() => new THREE.Vector3(), []);
  const small = useMemo(() => window.matchMedia("(max-width: 767px)").matches, []);
  const focus = small || state.reduce ? undefined : state.shot.focus;

  // The camera follows the hello packet in the "track" shot.
  const packetPos = useRef(new THREE.Vector3());
  const track = () => (state.shot.id === "packet" ? packetPos.current : null);

  useFrame(({ clock, camera }, dt) => {
    if (!active) return;
    const now = performance.now();
    const time = clock.elapsedTime;
    const breathe = state.reduce ? 1 : 1 + 0.012 * Math.sin((time * 2 * Math.PI) / 6);
    const rekey = film.rekeyAt ? easeToken(Math.min(1, (now - film.rekeyAt) / 700)) : 1;
    const hs = pulse(react.current.rotate, 700);

    // Focus pull: the subject stays sharp; everything else softens (dims) slightly.
    const dimOf = (id: string) => (focus && focus !== id ? 0.35 : 1);
    mats.client.opacity += (dimOf("client") - mats.client.opacity) * Math.min(1, dt * 4);
    mats.server.opacity += (dimOf("server") - mats.server.opacity) * Math.min(1, dt * 4);
    mats.tube.opacity += (0.5 * dimOf("packet") - mats.tube.opacity) * Math.min(1, dt * 4);
    const keyed = !!film.mergeAt;
    mats.client.color.lerp(keyed ? c.ok : c.text3, Math.min(1, dt * 3));
    mats.server.color.lerp(keyed ? c.ok : c.text3, Math.min(1, dt * 3));

    if (clientG.current && serverG.current) {
      clientG.current.scale.setScalar(breathe * (1 + 0.04 * hs));
      serverG.current.scale.setScalar(breathe * (1 + 0.04 * hs));
      // Re-key on a policy hot-swap: a quick quarter turn.
      clientG.current.rotation.set(0.45, 0.6 + (Math.PI / 2) * rekey, 0);
      serverG.current.rotation.set(0.45, -0.6 - (Math.PI / 2) * rekey, 0);
      // Stage 3: once the session is derived, the cubes become icospheres and the arc flows.
      const fused = film.mergeAt
        ? state.reduce
          ? 1
          : easeToken(Math.min(1, (performance.now() - film.mergeAt) / 1200))
        : film.sessionId
          ? 1
          : 0;
      const cubeScale = Math.max(0.0001, 1 - fused);
      clientG.current.children[0]?.scale.setScalar(cubeScale);
      serverG.current.children[0]?.scale.setScalar(cubeScale);
      for (const g of [icoA.current, icoB.current]) {
        if (!g) continue;
        g.scale.setScalar(Math.max(0.0001, fused));
        g.rotation.y += state.reduce ? 0 : dt * 0.5;
      }
      arc.p.visible = fused > 0;
      if (fused > 0) {
        const ap = arc.g.attributes.position!.array as Float32Array;
        const t = state.reduce ? 0 : performance.now() / 1000;
        for (let i = 0; i < ARC_N; i++) {
          const [s0, ox, oz, sp] = arc.seed[i]!;
          const x = ((s0! + t * 0.2 * sp!) % 1) * fused * (ARC_LUT.length - 1);
          const k = Math.floor(x);
          arcV.copy(ARC_LUT[k]!).lerp(ARC_LUT[Math.min(k + 1, ARC_LUT.length - 1)]!, x - k);
          set3(ap, i, arcV.x + ox!, arcV.y + ox! * 0.5, arcV.z + oz!);
        }
        arc.g.attributes.position!.needsUpdate = true;
        arc.m.opacity = 0.85 * fused;
      }
    }
    if (share.current) {
      const s = film.shareHex ? 1 : 0;
      share.current.scale.lerp(tmp.setScalar(Math.max(0.0001, s)), Math.min(1, dt * 5));
      share.current.rotation.y += dt * 0.2;
    }
    if (packet.current) {
      const t = film.packetAt ? (now - film.packetAt) / PACKET_MS : -1;
      packet.current.visible = t >= 0 && t < 1;
      TUBE.getPoint(easeToken(Math.min(1, Math.max(0, t))), packetPos.current);
      packet.current.position.copy(packetPos.current);
    }
    if (pk.current) {
      const on = film.signedAt ? 1 : 0;
      pk.current.scale.lerp(tmp.setScalar(Math.max(0.0001, on)), Math.min(1, dt * 5));
    }
    if (ring.current) {
      const t = film.signedAt ? easeToken(span(now - film.signedAt, 0, 900)) : 0;
      const v = pulse(react.current.verify, 600);
      const hit = film.attackAt ? pulse(film.attackAt + ATTACK_MS, 500) : 0;
      ring.current.scale.setScalar(Math.max(0.0001, t) * (1 + 0.08 * v + 0.15 * hit));
      ring.current.rotation.z += dt * (state.reduce ? 0 : 0.15);
      (ring.current.material as THREE.MeshBasicMaterial).color.copy(hit > 0.05 ? c.danger : c.sig);
      // The camera's orbit round the merge passes by the ring: fade it as the lens nears its tube,
      // so it never fills the frame.
      const lc = ring.current.worldToLocal(nearV.copy(camera.position));
      const tube = Math.hypot(Math.hypot(lc.x, lc.y) - 0.72, lc.z) * ring.current.scale.x;
      (ring.current.material as THREE.MeshBasicMaterial).opacity = Math.min(
        1,
        Math.max(0, (tube - 0.25) / 0.6),
      );
    }
    // Merge: classical (white) and post-quantum (KEM) halves fly into the HKDF lens and fuse.
    // The hero moment: slow (2.6 s), full-frame, the camera orbiting the lens as the halves fuse.
    const m = film.mergeAt ? (state.reduce ? 1 : span(now - film.mergeAt, 0, MERGE_MS)) : 0;
    // Magnetic: a 120 ms wind-up apart, then an accelerating close (cubic) until they touch at 85%.
    const w = 120 / MERGE_MS / 0.85;
    const u = Math.min(1, m / 0.85);
    const me = u < w ? -0.06 * Math.sin((Math.PI * u) / w) : ((u - w) / (1 - w)) ** 3;
    if (halfA.current && halfB.current && lens.current && key.current && flash.current) {
      const flying = m > 0 && m < 0.85;
      halfA.current.visible = halfB.current.visible = flying;
      halfA.current.position.lerpVectors(CLIENT, MERGE_A, me);
      halfB.current.position.lerpVectors(SERVER, MERGE_B, me);
      lens.current.scale.setScalar(
        m > 0 ? Math.min(1, m * 3) * (1 - Math.max(0, m - 0.9) * 10) || 0.0001 : 0.0001,
      );
      key.current.visible = m >= 0.85 || (film.mergeAt !== undefined && m === 1);
      key.current.rotation.y += dt * 0.5;
      const f =
        film.mergeAt && !state.reduce
          ? span(now - film.mergeAt, MERGE_MS * 0.85, MERGE_MS * 0.85 + 900)
          : 0;
      flash.current.visible = f > 0 && f < 1;
      flash.current.scale.setScalar(0.3 + 2.4 * easeToken(f));
      (flash.current.material as THREE.MeshBasicMaterial).opacity = 0.8 * (1 - f);
    }
    // AES-GCM sparks: a fast stream between the cubes, brighter on every real seal.
    const sp = sparks.current;
    if (sp) {
      sp.visible = !!film.sparks;
      sp.count = small ? SPARKS / 2 : SPARKS;
      const glow = 1 + 0.6 * pulse(react.current.seal, 400);
      for (let i = 0; i < SPARKS; i++) {
        sparkT.current[i] = (sparkT.current[i]! + dt * (state.reduce ? 0 : 1.6)) % 1;
        const t = sparkT.current[i]!;
        o.position.set(
          -2.0 + 4.0 * t,
          Math.sin(i * 1.7) * 0.18 + Math.sin(t * Math.PI) * 0.25,
          Math.cos(i * 2.3) * 0.18,
        );
        o.scale.setScalar(0.022 * glow);
        o.updateMatrix();
        sp.setMatrixAt(i, o.matrix);
      }
      sp.instanceMatrix.needsUpdate = true;
    }
    // Attack: a DANGER packet hits the signature ring and shatters.
    if (attackPkt.current && shards.current) {
      const t = film.attackAt ? (now - film.attackAt) / ATTACK_MS : -1;
      attackPkt.current.visible = t >= 0 && t < 1;
      attackPkt.current.position.lerpVectors(
        ATTACK_FROM,
        ATTACK_TO,
        easeToken(Math.min(1, Math.max(0, t))),
      );
      const s = t >= 1 ? span(now - (film.attackAt! + ATTACK_MS), 0, 1100) : 0;
      shards.current.visible = s > 0 && s < 1;
      for (let i = 0; i < 20; i++) {
        const a = i * 2.4;
        o.position.set(
          1.95 + Math.cos(a) * s * 0.9,
          0.1 + Math.sin(a * 1.3) * s * 0.7,
          Math.sin(a) * s * 0.6,
        );
        o.rotation.set(a * s * 3, a, s * 4);
        o.scale.setScalar(0.06 * (1 - s));
        o.updateMatrix();
        shards.current.setMatrixAt(i, o.matrix);
      }
      shards.current.instanceMatrix.needsUpdate = true;
    }
  });

  const show = state.settled;
  const id = state.shot.id;
  // During the merge the camera orbits ~34° around the lens (none under reduced motion).
  const mergeOrbit = () =>
    film.mergeAt && state.shot.id === "merge" && !state.reduce
      ? 0.6 * easeToken(span(performance.now() - film.mergeAt, 0, MERGE_MS))
      : 0;
  return (
    <Thicken>
      <DirectorCamera state={state} onSettled={onSettled} track={track} autoYaw={mergeOrbit} />
      <fog attach="fog" args={[c.bg, 6, 16]} />
      <ambientLight intensity={0.5} />
      <directionalLight position={[3, 5, 4]} intensity={0.9} />
      <directionalLight position={[-4, 1, -5]} intensity={0.4} color={c.kem} />
      <gridHelper args={[24, 48, c.text3, c.text3]} position={[0, -1.25, 0]}>
        <meshBasicMaterial
          attach="material"
          color={c.text3}
          transparent
          depthWrite={false}
          opacity={0.08}
        />
      </gridHelper>

      <group ref={clientG} position={CLIENT}>
        <lineSegments geometry={cube} material={mats.client} />
        <group ref={icoA} scale={0.0001}>
          <mesh geometry={ico} material={icoFill} />
          <lineSegments geometry={icoEdges} material={icoLine} />
        </group>
      </group>
      <group ref={serverG} position={SERVER}>
        <lineSegments geometry={cube} material={mats.server} />
        <group ref={icoB} scale={0.0001}>
          <mesh geometry={ico} material={icoFill} />
          <lineSegments geometry={icoEdges} material={icoLine} />
        </group>
      </group>
      <primitive object={arc.p} />
      <mesh geometry={tubeGeo} material={mats.tube} />

      <points ref={share} geometry={shareGeo} position={[-2.6, 1.05, 0]} scale={0.0001}>
        <pointsMaterial
          color={c.text}
          size={0.025}
          sizeAttenuation
          transparent
          depthWrite={false}
          opacity={0.9}
        />
      </points>
      <mesh ref={packet} visible={false}>
        <boxGeometry args={[0.2, 0.12, 0.12]} />
        <meshBasicMaterial color={c.kem} toneMapped={false} />
      </mesh>
      <mesh ref={pk} position={SERVER} scale={0.0001}>
        <icosahedronGeometry args={[0.24, 0]} />
        <meshBasicMaterial color={c.kem} wireframe toneMapped={false} />
      </mesh>
      <mesh ref={ring} position={SERVER} rotation={[0, Math.PI / 2, 0]} scale={0.0001}>
        <torusGeometry args={[0.72, 0.012, 8, 96]} />
        <meshBasicMaterial color={c.sig} toneMapped={false} transparent depthWrite={false} />
      </mesh>
      <mesh ref={halfA} visible={false} rotation={[0, Math.PI / 2, 0]}>
        <sphereGeometry args={[0.3, 32, 16, 0, Math.PI]} />
        <meshBasicMaterial color={c.text} side={THREE.DoubleSide} />
      </mesh>
      <mesh ref={halfB} visible={false} rotation={[0, -Math.PI / 2, 0]}>
        <sphereGeometry args={[0.3, 32, 16, 0, Math.PI]} />
        <meshBasicMaterial color={c.kem} side={THREE.DoubleSide} />
      </mesh>
      <mesh ref={lens} rotation={[0, Math.PI / 2, 0]} scale={0.0001}>
        <torusGeometry args={[0.55, 0.018, 12, 96]} />
        <meshBasicMaterial
          color={c.text}
          transparent
          depthWrite={false}
          opacity={0.85}
          toneMapped={false}
        />
      </mesh>
      <mesh ref={key} visible={false}>
        <octahedronGeometry args={[0.32, 0]} />
        <meshBasicMaterial color={c.ok} wireframe toneMapped={false} />
      </mesh>
      {/* The fuse's shock: dust round the lens, pushed out when the halves touch (85% of the merge). */}
      {film.mergeAt !== undefined && (
        <PushDust
          color={c.ok}
          count={small ? 70 : 140}
          inner={0.6}
          outer={1.8}
          opacity={0.4}
          reduce={state.reduce}
          since={() =>
            film.mergeAt ? (performance.now() - film.mergeAt) / 1000 - (MERGE_MS * 0.85) / 1000 : -1
          }
        />
      )}
      <mesh ref={flash} visible={false} rotation={[0, Math.PI / 2, 0]}>
        <ringGeometry args={[0.7, 0.74, 96]} />
        <meshBasicMaterial color={c.ok} transparent depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
      <instancedMesh ref={sparks} args={[undefined, undefined, SPARKS]} visible={false}>
        <sphereGeometry args={[1, 6, 6]} />
        <meshBasicMaterial color={c.kem} toneMapped={false} />
      </instancedMesh>
      <mesh ref={attackPkt} visible={false}>
        <boxGeometry args={[0.2, 0.12, 0.12]} />
        <meshBasicMaterial color={c.danger} toneMapped={false} />
      </mesh>
      <instancedMesh ref={shards} args={[undefined, undefined, 20]} visible={false}>
        <tetrahedronGeometry args={[1, 0]} />
        <meshBasicMaterial color={c.danger} wireframe toneMapped={false} />
      </instancedMesh>

      {/* Anchored labels: real values, shown once the camera has settled on their shot. */}
      <Anchor
        position={[-2.6, -0.95, 0]}
        label="Client"
        value="browser · app · device"
        show={show && (id === "establish" || id === "pullback")}
        side="down"
      />
      <Anchor
        position={[2.6, -0.95, 0]}
        label="Server"
        value={`${sigName} identity`}
        show={show && (id === "establish" || id === "pullback")}
        side="down"
      />
      <Anchor
        position={[-2.6, 1.45, 0]}
        label="X25519 key share"
        role="kem"
        value={film.shareHex ? `${film.shareHex}…` : "…"}
        show={show && id === "client" && !!film.shareHex}
      />
      <Anchor
        position={[0, 1.85, 0.3]}
        label="ClientHello"
        role="kem"
        value={film.helloBytes ? `${film.helloBytes.toLocaleString("en-IN")} B · public` : "…"}
        show={show && id === "packet"}
      />
      <Anchor
        position={[2.6, 0.78, 0]}
        label={`${kemName} key · ${sigName} signature`}
        role="sig"
        value={
          film.sigBytes && film.kemPkBytes
            ? `${film.kemPkBytes.toLocaleString("en-IN")} B key · ${film.sigBytes.toLocaleString("en-IN")} B signature ${film.verified ? "· verified ✓" : "· verifying…"}`
            : "…"
        }
        show={show && id === "server" && !!film.signedAt}
      />
      <Anchor
        position={[0, 0.6, 0]}
        label="Session key · HKDF-SHA256"
        role="ok"
        value={film.sessionId ? `session ${film.sessionId.slice(0, 8)}…` : "deriving…"}
        show={show && id === "merge" && !!film.sessionId}
      />
      <Anchor
        position={[0, 0.75, 0]}
        label="AES-256-GCM"
        role="kem"
        value={
          film.perUs !== undefined
            ? `${Math.round(film.perSecond ?? 0).toLocaleString("en-IN")} msg/s · ${film.perUs.toFixed(1)} µs each`
            : "…"
        }
        show={show && id === "pullback" && !!film.sparks}
      />
      <Anchor
        position={[2.2, 1.0, 0]}
        label="ML-DSA verify ✗ · rejected"
        role="danger"
        value="forged ML-KEM key, original signature"
        show={show && id === "attack" && !!film.attackRejected}
      />
    </Thicken>
  );
}
