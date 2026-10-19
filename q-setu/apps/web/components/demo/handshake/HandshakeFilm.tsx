"use client";

/**
 * Demo 1 as a short film: two keys combine so a quantum computer can't read the session.
 *
 * The browser (left) and the server (right) are glass blocks with fresnel rims, standing on the
 * stage's reflective floor under a cone of light. Over each hangs a cloud of curl-noise particles.
 *   - ClientHello: the browser's cloud gathers into a glowing X25519 key shard (--kem), and a comet
 *     carries the share along the arc tube to the server.
 *   - Signed ServerHello: the server's cloud gathers into its ML-KEM-768 shard (--sig), inside a glass
 *     ML-DSA signature ring.
 *   - The merge (the hero moment): both shards fire across as comets along energy tubes, collide in
 *     the middle (bloom flash, a shockwave ring on the air and the floor, a particle burst, a camera
 *     punch-in and shake) and fuse into one faceted --ok crystal: the real HKDF session key, labelled
 *     with the real handshake time and byte sizes.
 *   - Messages: AES-256-GCM comets stream along the link; the crystal pulses on each real seal.
 *   - Attack: a --danger comet hits the signature ring and bursts.
 * Everything appears when its real crypto has happened. Reduced motion: each shot's composed still.
 */
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { Anchor } from "@/components/director/Anchor";
import { DirectorCamera } from "@/components/director/DirectorCamera";
import { pulse, useReactions } from "@/components/director/reactions";
import type { DirectorState } from "@/components/director/types";
import { span } from "@/components/scenes/geometry";
import { useBudget } from "@/components/fx/budget";
import { FXStage, useFX } from "@/components/fx/FXStage";
import { energyTube, glass, solid } from "@/components/fx/materials";
import { makeParticles } from "@/components/fx/Particles";
import { StageSet } from "@/components/fx/StageSet";
import { palette } from "@/components/world/palette";
import { easeToken } from "@/lib/ease";
import { springIn } from "@/lib/motion";
import { Html } from "@react-three/drei";
import { FoldSheet } from "@/components/fx/fold";
import { CONDENSE_MS } from "@/components/fx/mass";
import { registerLabel } from "@/lib/client/labels";

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
  /** When the client's ML-DSA check of the signed ServerHello passed, and how long it took. */
  verifiedAt?: number;
  verifyMs?: number;
  /** The first sealed message: its real plaintext, ciphertext and the server's decrypt. */
  msg?: { plain: Uint8Array; cipher: Uint8Array; opened: Uint8Array; at: number };
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

export const CLIENT = new THREE.Vector3(-2.7, -0.35, 0);
export const SERVER = new THREE.Vector3(2.7, -0.2, 0);
const FLOOR = -1.1;
/** Where each side's key shard forms (over its block), and where they collide. */
/** Where each shard rests once it has mass (on top of its block); its ghost hovers above. */
const SHARD_C = new THREE.Vector3(-2.7, 0.76, 0);
const SHARD_S = new THREE.Vector3(2.7, 1.11, 0);
const GHOST_UP = 0.6;
const GHOST_C = SHARD_C.clone().setY(SHARD_C.y + GHOST_UP);
const GHOST_S = SHARD_S.clone().setY(SHARD_S.y + GHOST_UP);
const CENTER = new THREE.Vector3(0, 1.0, 0);
const ARC = new THREE.CatmullRomCurve3([
  new THREE.Vector3(-2.3, 0.6, 0),
  new THREE.Vector3(-1.2, 2.0, 0.25),
  new THREE.Vector3(1.2, 2.0, 0.25),
  new THREE.Vector3(2.3, 0.6, 0),
]);
const FIRE_C = new THREE.CatmullRomCurve3([
  SHARD_C,
  new THREE.Vector3(-1.5, 1.45, 0.35),
  new THREE.Vector3(-0.5, 1.1, 0.1),
  CENTER,
]);
const FIRE_S = new THREE.CatmullRomCurve3([
  SHARD_S,
  new THREE.Vector3(1.5, 1.45, 0.35),
  new THREE.Vector3(0.5, 1.1, 0.1),
  CENTER,
]);
const LINK = new THREE.CatmullRomCurve3([
  new THREE.Vector3(-2.25, -0.15, 0),
  new THREE.Vector3(0, -0.05, 0.15),
  new THREE.Vector3(2.25, -0.15, 0),
]);
const PACKET_MS = 1600;
const ATTACK_MS = 1500;
/** The merge: a short charge, the flight, the collision at HIT, the crystal settling. */
const MERGE_MS = 2600;
const FIRE_FROM = 0.18;
const HIT = 0.55;
const MSGS = 6;

const browserOnly = (e: { source: string }) => e.source === "browser";
const sp = (ms: number, reduce: boolean) =>
  reduce ? 1 : ms <= 0 ? 0 : springIn(ms / 1000, 0.55, 1.8);
const fmtB = (n?: number) => (n === undefined ? "…" : `${n.toLocaleString("en-IN")} B`);
const fmtMs = (n?: number) =>
  n === undefined ? "…" : `${n < 10 ? n.toFixed(2) : n.toFixed(1)} ms`;

interface Props {
  state: DirectorState;
  onSettled: () => void;
  film: Film;
  kemName: string;
  sigName: string;
  /** False while the stage is off screen: skip all per-frame work. */
  active: boolean;
}

export default function HandshakeFilm(props: Props) {
  const c = useMemo(palette, []);
  return (
    <FXStage background={c.bg} active={props.active} reduce={props.state.reduce}>
      <Scene {...props} />
    </FXStage>
  );
}

function Scene({ state, onSettled, film, kemName, sigName, active }: Props) {
  const c = useMemo(palette, []);
  const fx = useFX();
  const budget = useBudget();
  const reduce = state.reduce;

  const geo = useMemo(() => {
    const shard = new THREE.OctahedronGeometry(0.26, 0);
    shard.scale(0.62, 1.55, 0.62);
    const crystal = new THREE.IcosahedronGeometry(0.42, 0).toNonIndexed();
    crystal.computeVertexNormals();
    return {
      shard,
      crystal,
      shell: new THREE.IcosahedronGeometry(0.55, 1),
      arc: new THREE.TubeGeometry(ARC, 160, 0.022, 10, false),
      fireC: new THREE.TubeGeometry(FIRE_C, 120, 0.03, 10, false),
      fireS: new THREE.TubeGeometry(FIRE_S, 120, 0.03, 10, false),
      link: new THREE.TubeGeometry(LINK, 160, 0.03, 10, false),
      head: new THREE.SphereGeometry(0.075, 20, 14),
      ring: new THREE.TorusGeometry(0.62, 0.025, 12, 96),
      wave: new THREE.TorusGeometry(1, 0.012, 8, 128),
      floorWave: new THREE.RingGeometry(0.96, 1, 128),
    };
  }, []);
  const mat = useMemo(
    () => ({
      client: glass(c.text3, { rim: 2.6, body: 0.07 }),
      server: glass(c.text3, { rim: 2.6, body: 0.07 }),
      shardC: solid(c.kem, { glow: 1.05 }),
      shardS: solid(c.sig, { glow: 1.05 }),
      crystal: solid(c.ok, { glow: 0.9, light: new THREE.Vector3(0.6, 1, 0.3) }),
      shell: glass(c.ok, { rim: 2.8, body: 0.03 }),
      sigRing: glass(c.sig, { rim: 3, body: 0.25, power: 1.6 }),
      arc: energyTube(c.kem, { base: 0.5 }),
      fireC: energyTube(c.kem, { base: 0 }),
      fireS: energyTube(c.sig, { base: 0 }),
      link: energyTube(c.kem, { base: 0.18 }),
      head: new THREE.MeshBasicMaterial({
        color: c.kem.clone().multiplyScalar(4),
        toneMapped: false,
      }),
      danger: new THREE.MeshBasicMaterial({
        color: c.danger.clone().multiplyScalar(4),
        toneMapped: false,
      }),
      wave: new THREE.MeshBasicMaterial({
        color: c.ok.clone().multiplyScalar(3),
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
      }),
      floorWave: new THREE.MeshBasicMaterial({
        color: c.ok.clone().multiplyScalar(2),
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        toneMapped: false,
      }),
    }),
    [c],
  );
  // One particle cloud per side (half the budget each); rebuilt only when the budget changes tier.
  const clouds = useMemo(() => {
    const n = Math.round(budget.particles / 2);
    return {
      c: makeParticles(n, {
        colorA: c.kem,
        colorB: c.text,
        center: GHOST_C,
        radius: 0.75,
        seed: 3,
      }),
      s: makeParticles(n, {
        colorA: c.sig,
        colorB: c.text,
        center: GHOST_S,
        radius: 0.75,
        seed: 7,
      }),
    };
  }, [budget.particles, c]);
  // The forged packet: a ghost that never gains mass (flickers --danger; the solid shard repels it).
  const attackCloud = useMemo(() => {
    const p = makeParticles(Math.round(Math.min(3000, budget.particles * 0.08)), {
      colorA: c.danger,
      colorB: c.warn,
      radius: 0.22,
      size: 0.03,
      seed: 13,
    });
    p.u.uAmp.value = 0.7;
    p.u.uOpacity.value = 0;
    return p;
  }, [budget.particles, c]);
  useEffect(
    () => () => {
      clouds.c.dispose();
      clouds.s.dispose();
      attackCloud.dispose();
    },
    [clouds, attackCloud],
  );
  // The first sealed message's real bytes, folding into a brick and unfolding at the server.
  const sheet = useMemo(
    () =>
      new FoldSheet({ plain: c.warn, cipher: c.kem, sig: c.sig, danger: c.danger }, { tile: 0.15 }),
    [c],
  );
  useEffect(() => () => sheet.dispose(), [sheet]);
  const msgG = useRef<THREE.Group>(null);
  const msgLabel = useRef<HTMLDivElement>(null);
  const msgPhase = useRef("");
  const drop = useRef({ y: [GHOST_C.y, GHOST_S.y], v: [0, 0], landed: [0, 0] });

  const r = {
    clientG: useRef<THREE.Group>(null),
    serverG: useRef<THREE.Group>(null),
    shardC: useRef<THREE.Mesh>(null),
    shardS: useRef<THREE.Mesh>(null),
    crystal: useRef<THREE.Group>(null),
    sigRing: useRef<THREE.Mesh>(null),
    wave: useRef<THREE.Mesh>(null),
    floorWave: useRef<THREE.Mesh>(null),
    packet: useRef<THREE.Mesh>(null),
    msgs: useRef<(THREE.Mesh | null)[]>([]),
    attack: useRef<THREE.Mesh>(null),
  };
  const react = useReactions(browserOnly);
  const v = useMemo(() => new THREE.Vector3(), []);
  const packetPos = useRef(new THREE.Vector3());
  const msgT = useRef(Float32Array.from({ length: MSGS }, (_, i) => i / MSGS));
  const hitDone = useRef(0);
  const attackDone = useRef(0);
  const clock = useRef(0);
  const track = () => (state.shot.id === "packet" ? packetPos.current : null);

  useFrame(({ gl }, dt) => {
    if (!active) return;
    const now = performance.now();
    if (!reduce) clock.current += dt;
    const t = clock.current;
    const id = state.shot.id;
    const pr = gl.getPixelRatio();
    for (const p of [clouds.c, clouds.s]) {
      p.u.uTime.value = t;
      p.u.uPR.value = pr;
    }
    const rot = pulse(react.current.rotate, 700);

    // The blocks breathe, and turn --ok once the session exists.
    const keyed = !!film.sessionId;
    for (const [g, m] of [
      [r.clientG.current, mat.client],
      [r.serverG.current, mat.server],
    ] as const) {
      if (g) g.scale.setScalar((reduce ? 1 : 1 + 0.01 * Math.sin(t * 1.1)) * (1 + 0.03 * rot));
      (m.uniforms.uColor!.value as THREE.Color).lerp(keyed ? c.ok : c.text3, Math.min(1, dt * 3));
    }

    // ── Trust gives mass. Each key half is a ghost (a loose, weightless, jittering cloud) from the
    // moment it exists, and gains mass only when the signed handshake really verifies: its points
    // condense, the solid shard thunks into being, drops onto its block and bounces. ─────────────
    const mergeMs = film.mergeAt ? now - film.mergeAt : -1;
    const m = film.mergeAt ? (reduce ? 1 : span(mergeMs, 0, MERGE_MS)) : 0;
    const vAt = film.verifiedAt ?? 0;
    const sinceV = vAt ? now - vAt : -1;
    const cond = reduce ? (vAt || film.sessionId ? 1 : 0) : vAt ? span(sinceV, 0, CONDENSE_MS) : 0;
    const exists = [!!film.shareAt, !!film.signedAt];
    const ghosts = [GHOST_C, GHOST_S];
    const rests = [SHARD_C, SHARD_S];
    [clouds.c, clouds.s].forEach((p, k) => {
      p.u.uCenter.value.copy(ghosts[k]!);
      p.u.uShapeAt.value.copy(ghosts[k]!);
      p.u.uShapeSize.value.set(0.34, 0.8, 0.34);
      p.u.uGather.value = cond;
      p.u.uAmp.value = 0.55 * (1 - cond) + 0.1;
      const fade = cond >= 1 ? Math.max(0, 1 - (sinceV - CONDENSE_MS) / 300) : 1;
      p.u.uOpacity.value = exists[k] ? (cond > 0 ? 0.75 : 0.36) * fade : 0;
      p.u.uBurst.value = -1;
    });
    // The drop: under gravity from where the ghost hovered onto the block, a bounce, then settle.
    const D = drop.current;
    for (let k = 0; k < 2; k++) {
      if (!vAt || reduce) {
        D.y[k] = vAt || film.sessionId ? rests[k]!.y : ghosts[k]!.y;
        D.v[k] = 0;
        if (!vAt) D.landed[k] = 0;
        continue;
      }
      if (cond < 1) continue;
      D.v[k]! += -9.8 * 0.55 * Math.min(dt, 1 / 30);
      D.y[k]! += D.v[k]! * Math.min(dt, 1 / 30);
      if (D.y[k]! < rests[k]!.y) {
        D.y[k] = rests[k]!.y;
        if (D.v[k]! < -0.3) {
          if (!D.landed[k]) {
            D.landed[k] = now;
            if (k === 1) fx.hit(0.25);
          }
          D.v[k] = -D.v[k]! * 0.32;
        } else D.v[k] = 0;
      }
    }
    const fire = reduce ? (film.mergeAt ? 1 : 0) : easeToken(span(m, FIRE_FROM, HIT));
    const shards: [THREE.Mesh | null, number, THREE.CatmullRomCurve3, THREE.ShaderMaterial][] = [
      [r.shardC.current, 0, FIRE_C, mat.shardC],
      [r.shardS.current, 1, FIRE_S, mat.shardS],
    ];
    for (const [s, k, curve, sm] of shards) {
      if (!s) continue;
      s.visible = cond >= 0.75 && m < HIT;
      sm.uniforms.uDissolve!.value = 1 - easeToken(span(cond, 0.5, 1));
      // A charge-up spin before firing, then the flight along its tube.
      const spin = reduce ? 0 : 14 * easeToken(span(m, 0, FIRE_FROM));
      if (m > FIRE_FROM) curve.getPointAt(Math.min(1, fire), s.position);
      else s.position.set(rests[k]!.x, D.y[k]!, 0);
      s.rotation.set(0, spin, fire * 1.4 * (curve === FIRE_C ? -1 : 1));
      // The thunk: a squash as it takes its weight, and again on landing, sprung back.
      const thunk = reduce || cond < 1 ? 0 : Math.exp(-Math.max(0, sinceV - CONDENSE_MS) / 120);
      const land = D.landed[k] && !reduce ? Math.exp(-(now - D.landed[k]!) / 110) : 0;
      const sq = 0.2 * thunk + 0.16 * land;
      s.scale.set(1 + sq * 0.5, 1 - sq, 1 + sq * 0.5);
      sm.uniforms.uGlow!.value = 1.05 + 1.2 * thunk + 1.6 * span(m, 0.05, HIT);
    }
    // The firing tubes carry each shard's comet tail.
    mat.fireC.uniforms.uHeads!.value[0] = m > FIRE_FROM && m < HIT + 0.05 ? fire : -1;
    mat.fireS.uniforms.uHeads!.value[0] = m > FIRE_FROM && m < HIT + 0.05 ? fire : -1;
    mat.fireC.uniforms.uOpacity!.value = mat.fireS.uniforms.uOpacity!.value =
      1 - span(m, HIT, HIT + 0.15);

    // ── The collision: flash, shockwave, burst, punch-in; one --ok crystal. ────────────────
    const hitAt = film.mergeAt ? film.mergeAt + HIT * MERGE_MS : 0;
    const since = hitAt ? now - hitAt : -1;
    if (hitAt && since >= 0 && hitDone.current !== film.mergeAt && !reduce) {
      hitDone.current = film.mergeAt!;
      fx.hit(1);
    }
    // At the collision both clouds burst from the centre (then they are spent).
    for (const p of [clouds.c, clouds.s]) {
      const burst = !reduce && since >= 0 && since < 4000;
      if (burst) {
        p.u.uBurst.value = since / 1000;
        p.u.uCenter.value.copy(CENTER);
        p.u.uGather.value = 0;
        p.u.uAmp.value = 0.45;
        p.u.uOpacity.value = 0.9;
      } else if (since >= 4000) p.u.uOpacity.value = 0;
    }
    fx.punch = reduce
      ? 0
      : since >= 0
        ? Math.max(0, 1 - Math.abs(since - 150) / 1100)
        : span(m, 0, HIT) * 0.6;
    fx.focus =
      id === "client"
        ? SHARD_C
        : id === "server"
          ? SHARD_S
          : id === "packet"
            ? packetPos.current
            : CENTER;
    if (r.crystal.current) {
      const on = reduce ? (film.sessionId ? 1 : 0) : since >= 0 ? 1 : 0;
      const g = r.crystal.current;
      g.visible = on > 0;
      const k = reduce ? 1 : springIn(Math.max(0, since) / 1000, 0.4, 1.9);
      g.scale.setScalar(Math.max(0.0001, k * (1 + 0.07 * pulse(react.current.seal, 400))));
      g.rotation.set(0.35, reduce ? 0.6 : t * 0.45, 0.1);
      mat.crystal.uniforms.uGlow!.value =
        0.9 + (reduce ? 0 : 5 * Math.exp(-Math.max(0, since) / 260));
    }
    if (r.wave.current && r.floorWave.current) {
      const k = !reduce && since >= 0 ? span(since, 0, 1100) : 1;
      r.wave.current.visible = r.floorWave.current.visible = k < 1;
      r.wave.current.scale.setScalar(0.3 + 4.5 * easeToken(k));
      r.floorWave.current.scale.setScalar(0.4 + 6 * easeToken(k));
      mat.wave.opacity = 1 - k;
      mat.floorWave.opacity = 0.8 * (1 - k);
    }

    // The signature ring round the server's shard: glass, --sig; flashes on verify, --danger on attack.
    if (r.sigRing.current) {
      const s = film.signedAt ? sp(now - film.signedAt - 400, reduce) : 0;
      const hit = film.attackAt ? pulse(film.attackAt + ATTACK_MS, 700) : 0;
      r.sigRing.current.visible = s > 0.001 && m < FIRE_FROM;
      r.sigRing.current.scale.setScalar(
        Math.max(0.0001, s) * (1 + 0.08 * pulse(react.current.verify, 600) + 0.2 * hit),
      );
      r.sigRing.current.rotation.set(0, reduce ? 0 : t * 0.5, 0);
      r.sigRing.current.position.set(SHARD_S.x, D.y[1]!, 0);
      (mat.sigRing.uniforms.uColor!.value as THREE.Color).copy(hit > 0.05 ? c.danger : c.sig);
    }

    // The ClientHello: a comet along the arc.
    const pt = film.packetAt ? (now - film.packetAt) / PACKET_MS : -1;
    const along = reduce ? (id === "packet" && film.helloBytes ? 0.5 : -1) : pt;
    mat.arc.uniforms.uHeads!.value[0] = along >= 0 && along <= 1 ? easeToken(along) : -1;
    if (r.packet.current) {
      r.packet.current.visible = along >= 0 && along < 1;
      ARC.getPointAt(easeToken(Math.min(1, Math.max(0, along))), packetPos.current);
      r.packet.current.position.copy(packetPos.current);
    }

    // AES-256-GCM messages: comets streaming along the link.
    for (let i = 0; i < MSGS; i++) {
      msgT.current[i] = reduce ? i / MSGS : (msgT.current[i]! + dt * 0.45) % 1;
      const u = msgT.current[i]!;
      mat.link.uniforms.uHeads!.value[i] = film.sparks ? u : -1;
      const h = r.msgs.current[i];
      if (h) {
        h.visible = !!film.sparks;
        LINK.getPointAt(u, h.position);
        h.scale.setScalar(0.7 + 0.5 * pulse(react.current.seal, 400));
      }
    }
    mat.link.uniforms.uBase!.value = film.sparks ? 0.6 : 0.3;

    // Attack: the forged packet never gains mass. It drifts in as a --danger ghost, and the
    // server's solid shard repels it like a magnet of the same pole; it flickers and fades.
    const a = film.attackAt ? (now - film.attackAt) / ATTACK_MS : -1;
    if (r.attack.current) r.attack.current.visible = false;
    {
      const u = attackCloud.u;
      u.uTime.value = t;
      u.uPR.value = gl.getPixelRatio();
      if (a < 0) u.uOpacity.value = 0;
      else if (reduce) {
        u.uCenter.value.set(SHARD_S.x - 1.1, SHARD_S.y + 0.4, 0.3);
        u.uOpacity.value = 0.6;
      } else {
        ARC.getPointAt(Math.min(1, Math.max(0, easeToken(Math.min(a, 0.92)))), v);
        // After contact: pushed away, decelerating (repulsion), and it keeps flickering.
        const away = a > 0.92 ? 1.4 * (1 - Math.exp(-(a - 0.92) * 2.2)) : 0;
        u.uCenter.value.set(v.x - away, v.y + away * 0.4, v.z + away * 0.3);
        const flick = Math.sin(now / 38) > -0.2 ? 1 : 0.3;
        u.uOpacity.value = 0.6 * flick * (1 - span(a, 2.2, 3.2));
      }
    }
    if (film.attackAt && a >= 1 && attackDone.current !== film.attackAt && !reduce) {
      attackDone.current = film.attackAt;
      fx.hit(0.7);
    }

    // ── Encryption is folding: the first real message, as a sheet of its bytes. ─────────────
    if (msgG.current) {
      const g = msgG.current;
      const msg = film.msg;
      g.visible = !!msg;
      // drei's <Html> ignores its parent's visibility: hide the label until there is a message.
      if (msgLabel.current) msgLabel.current.style.display = msg ? "" : "none";
      if (msg) {
        const since = reduce ? 1e9 : now - msg.at;
        const FOLD_AT = 700;
        const D2 = sheet.duration;
        const TRAVEL = 1500;
        const openAt = FOLD_AT + D2 + TRAVEL;
        let phase = "plain";
        if (since < FOLD_AT) {
          if (sheet.kind !== "flat") sheet.setFlat();
        } else if (since < FOLD_AT + D2) {
          if (sheet.kind !== "seal") sheet.seal(msg.at + FOLD_AT);
          phase = "sealing";
        } else if (since < openAt) {
          phase = "sealed";
        } else {
          if (sheet.kind !== "open") sheet.open(reduce ? now - 1e6 : msg.at + openAt);
          phase = "opened";
        }
        if (msgPhase.current === "" && msg) sheet.setBytes(msg.plain, msg.cipher);
        // Where it is: at the browser, along the link, at the server.
        const tr = reduce ? 1 : easeToken(span(since, FOLD_AT + D2, openAt));
        LINK.getPointAt(0.04 + 0.92 * tr, v);
        g.position.set(v.x, v.y + 0.75, 0.6);
        const appear = reduce ? 1 : springIn(since / 1000, 0.55, 1.8);
        g.scale.setScalar(Math.max(0.0001, appear));
        sheet.update(now, reduce);
        if (phase !== msgPhase.current && msgLabel.current) {
          msgPhase.current = phase;
          const el = msgLabel.current;
          const text = new TextDecoder().decode(msg.opened);
          el.children[0]!.textContent =
            phase === "plain"
              ? `Plaintext · ${msg.plain.length} B · exposed`
              : phase === "opened"
                ? "Decrypted at the server"
                : "AES-256-GCM · X25519MLKEM768 session";
          el.children[1]!.textContent =
            phase === "opened"
              ? text
              : phase === "plain"
                ? "the first real message"
                : "folded · ML-DSA-65 signed session";
          el.children[0]!.className =
            phase === "plain" ? "text-warn" : phase === "opened" ? "text-ok" : "text-kem";
        }
      } else msgPhase.current = "";
    }

    for (const tube of [mat.arc, mat.fireC, mat.fireS, mat.link]) tube.uniforms.uTime!.value = t;
  });

  const show = state.settled;
  const id = state.shot.id;
  const total =
    film.helloMs !== undefined && film.respondMs !== undefined && film.finishMs !== undefined
      ? film.helloMs + film.respondMs + film.finishMs
      : undefined;
  // During the merge the camera orbits ~25° round the collision (none under reduced motion).
  const mergeOrbit = () =>
    film.mergeAt && id === "merge" && !reduce
      ? 0.45 * easeToken(span(performance.now() - film.mergeAt, 0, MERGE_MS))
      : 0;
  return (
    <>
      <DirectorCamera state={state} onSettled={onSettled} track={track} autoYaw={mergeOrbit} />
      <fog attach="fog" args={[c.bg, 8, 20]} />
      <StageSet y={FLOOR} coneColor={c.kem} coneAt={[0, 0]} coneStrength={0.12} />

      {/* The two ends: glass blocks with fresnel rims. */}
      <group ref={r.clientG} position={CLIENT}>
        <mesh material={mat.client}>
          <boxGeometry args={[0.95, 1.4, 0.2]} />
        </mesh>
      </group>
      <group ref={r.serverG} position={SERVER}>
        <mesh material={mat.server}>
          <boxGeometry args={[0.9, 1.8, 0.75]} />
        </mesh>
      </group>

      {/* The particle clouds the shards gather out of (and burst into at the collision). */}
      <primitive object={clouds.c.points} />
      <primitive object={clouds.s.points} />
      <mesh ref={r.shardC} geometry={geo.shard} material={mat.shardC} visible={false} />
      <mesh ref={r.shardS} geometry={geo.shard} material={mat.shardS} visible={false} />
      <mesh
        ref={r.sigRing}
        geometry={geo.ring}
        material={mat.sigRing}
        position={SHARD_S}
        visible={false}
      />

      {/* Energy tubes: the open arc, each shard's firing path, and the sealed link. */}
      <mesh geometry={geo.arc} material={mat.arc} />
      <mesh geometry={geo.fireC} material={mat.fireC} />
      <mesh geometry={geo.fireS} material={mat.fireS} />
      <mesh geometry={geo.link} material={mat.link} />
      <mesh ref={r.packet} geometry={geo.head} material={mat.head} visible={false} />
      {Array.from({ length: MSGS }, (_, i) => (
        <mesh
          key={i}
          ref={(x) => void (r.msgs.current[i] = x)}
          geometry={geo.head}
          material={mat.head}
          visible={false}
        />
      ))}
      <mesh ref={r.attack} geometry={geo.head} material={mat.danger} visible={false} />
      <primitive object={attackCloud.points} />
      <group ref={msgG} visible={false}>
        <primitive object={sheet.group} />
        <Html position={[0, 0.9, 0]} center zIndexRange={[20, 0]} style={{ pointerEvents: "none" }}>
          <MsgLabel into={msgLabel} />
        </Html>
      </group>

      {/* The shared key: a faceted --ok crystal in a glass shell, and the shockwave. */}
      <group ref={r.crystal} position={CENTER} visible={false}>
        <mesh geometry={geo.crystal} material={mat.crystal} />
        <mesh geometry={geo.shell} material={mat.shell} />
      </group>
      <mesh
        ref={r.wave}
        geometry={geo.wave}
        material={mat.wave}
        position={CENTER}
        visible={false}
      />
      <mesh
        ref={r.floorWave}
        geometry={geo.floorWave}
        material={mat.floorWave}
        position={[CENTER.x, FLOOR + 0.01, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        visible={false}
      />

      {/* Labels: real values, shown once the camera has settled on their beat. */}
      <Anchor
        position={[CLIENT.x, FLOOR + 0.25, 0]}
        label="Browser"
        value="client · this tab"
        show={show && (id === "establish" || id === "pullback")}
        side="down"
      />
      <Anchor
        position={[SERVER.x, FLOOR + 0.25, 0]}
        label="Server"
        value={`${sigName} identity`}
        show={show && (id === "establish" || id === "pullback")}
        side="down"
      />
      <Anchor
        position={[SHARD_C.x, SHARD_C.y + 0.6, 0]}
        label="X25519 key shard"
        role="kem"
        value={`${fmtB(film.x25519Bytes)} · ${fmtMs(film.helloMs)}`}
        show={show && id === "client" && !!film.shareHex}
      />
      <Anchor
        position={[0, 2.3, 0.25]}
        label="ClientHello · in the open"
        role="kem"
        value={fmtB(film.helloBytes)}
        show={show && id === "packet"}
      />
      <Anchor
        position={[SHARD_S.x, SHARD_S.y + 0.75, 0]}
        label={`${kemName} key shard · ${sigName} signed`}
        role="sig"
        value={
          film.kemPkBytes && film.sigBytes
            ? `${fmtB(film.kemPkBytes)} key · ${fmtB(film.sigBytes)} signature · ${fmtMs(film.respondMs)}${film.verified ? " · verified ✓" : ""}`
            : "…"
        }
        show={show && id === "server" && !!film.signedAt}
      />
      <Anchor
        position={[SHARD_S.x, SHARD_S.y - 0.75, 0]}
        side="down"
        label="Mass gained · ML-DSA-65 verified"
        role="sig"
        value={
          film.verifyMs !== undefined ? `signed handshake checked in ${fmtMs(film.verifyMs)}` : "…"
        }
        show={show && id === "merge" && !!film.verifiedAt}
      />
      <Anchor
        position={[CENTER.x, CENTER.y + 0.75, 0]}
        label="Shared key"
        role="ok"
        value={
          film.sessionId
            ? `32 B · ${kemName} ct ${fmtB(film.ctBytes)} · handshake ${fmtMs(total)}`
            : "deriving…"
        }
        show={show && id === "merge" && !!film.sessionId}
      />
      <Anchor
        position={[0, -0.4, 0]}
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
        position={[SHARD_S.x - 0.4, SHARD_S.y + 0.8, 0]}
        label={`${sigName} verify ✗ · rejected`}
        role="danger"
        value="forged ML-KEM key, original signature"
        show={show && id === "attack" && !!film.attackRejected}
      />
    </>
  );
}

/** The travelling message's label (its text is set from the frame loop, by phase: no React state). */
function MsgLabel({ into }: { into: { current: HTMLDivElement | null } }) {
  const reg = useRef<ReturnType<typeof registerLabel>>(undefined);
  return (
    <div
      aria-hidden
      ref={(el) => {
        into.current = el;
        reg.current?.remove();
        reg.current = el ? registerLabel(el, "up") : undefined;
        reg.current?.show(true);
      }}
      className="whitespace-nowrap rounded-sm border border-line bg-base px-2 py-1 text-center font-mono text-label uppercase"
    >
      <span className="text-warn">Plaintext</span>
      <span className="block normal-case text-fg">…</span>
    </div>
  );
}
