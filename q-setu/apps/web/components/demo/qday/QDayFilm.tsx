"use client";

/**
 * Demo 3 as a film: recorded traffic opens at Q-Day unless it was sealed with a hybrid key.
 *
 * One line of traffic: a glowing energy tube on the stage's reflective floor. Packets ride it as
 * solid capsules, alternating classical (--warn, RSA / ECDH) and hybrid (--kem, X25519 + ML-KEM-768),
 * each hybrid one inside a glass --kem lattice shield. A dark recorder (the simulated network's) sits
 * below and sucks copies off the line as a stream of red particles, brighter with each real recording.
 *
 * Q-Day (the hero moment, on the real break): the picture drains of colour, time slows to 0.2×,
 * a shockwave sweeps the air and the floor (shake, chromatic aberration), the classical packets burn
 * away (a noise dissolve with a glowing edge) and shatter into thousands of particles, while each
 * hybrid packet's shield ripples as the wave passes and holds. Time ramps back to normal; the real
 * decrypted contents rise out of the break. Reduced motion: each shot's composed still.
 */
import { Html } from "@react-three/drei";
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
import { springIn, wobble } from "@/lib/motion";
import { FoldSheet } from "@/components/fx/fold";

const LEN = 9;
const Y = 0.35;
const FLOOR = -1.45;
/** Packets on the line: even slots classical, odd slots hybrid. */
const MAX = 12;
const RECORDER = new THREE.Vector3(-3.1, -0.85, 0.6);
/** The beat between the key falling and the packets breaking. */
const FREEZE_MS = 300;
const SLOW = 0.2;
/** Seconds (real) at 0.2×, then the ramp back to 1×. */
const SLOW_HOLD = 1.6;
const SLOW_RAMP = 1.4;
const FRONT_CLASSICAL = new THREE.Vector3(-1.9, -0.1, 1.3);
const FRONT_HYBRID_A = new THREE.Vector3(1.7, -0.2, 1.4);
const FRONT_HYBRID_B = new THREE.Vector3(2.6, -0.2, 1.2);
const LINE = new THREE.LineCurve3(
  new THREE.Vector3(-LEN / 2, Y, 0),
  new THREE.Vector3(LEN / 2, Y, 0),
);

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
  /** Real recorded ciphertexts: one classical record's, and QuantumLedger records'. */
  samples: { classical?: Uint8Array; hybrid: Uint8Array[] };
}

export default function QDayFilm(props: QDayFilmProps) {
  const c = useMemo(palette, []);
  return (
    <FXStage background={c.bg} active={props.active} reduce={props.state.reduce}>
      <Scene {...props} />
    </FXStage>
  );
}

function Scene({
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
  samples,
}: QDayFilmProps) {
  const c = useMemo(palette, []);
  const fx = useFX();
  // ── Encryption is folding. The recorded classical traffic is a crumpled sheet in the recorder;
  // at Q-Day the (simulated) quantum attacker pulls it out and smooths it flat: readable. The
  // hybrid records are folded bricks: the attack starts to unfold them, they jam and crumple. ──
  const folds = useMemo(() => {
    const col = { plain: c.warn, cipher: c.kem, sig: c.sig, danger: c.danger };
    return {
      classical: new FoldSheet(col, { tile: 0.13, seed: 3 }),
      hybrid: [
        new FoldSheet(col, { tile: 0.1, seed: 5 }),
        new FoldSheet(col, { tile: 0.1, seed: 9 }),
      ],
    };
  }, [c]);
  useEffect(
    () => () => {
      folds.classical.dispose();
      folds.hybrid.forEach((f) => f.dispose());
    },
    [folds],
  );
  useEffect(() => {
    const enc = new TextEncoder();
    const leak = enc.encode(leaks[0] ?? "");
    folds.classical.setBytes(
      leak.length ? leak : (samples.classical ?? new Uint8Array()),
      samples.classical ?? leak,
    );
    folds.hybrid.forEach((f, i) => {
      const ct = samples.hybrid[i] ?? samples.hybrid[0] ?? new Uint8Array(64);
      f.setBytes(new Uint8Array(0), ct);
    });
  }, [folds, samples, leaks]);
  const classicalG = useRef<THREE.Group>(null);
  const hybridG = useRef<(THREE.Group | null)[]>([]);
  const foldPos = useMemo(() => new THREE.Vector3(), []);
  const budget = useBudget();
  const reduce = state.reduce;
  const n = small ? MAX / 2 : MAX;

  const geo = useMemo(
    () => ({
      capsule: new THREE.CapsuleGeometry(0.12, 0.3, 8, 20).rotateZ(Math.PI / 2),
      shield: new THREE.IcosahedronGeometry(0.29, 1),
      tube: new THREE.TubeGeometry(LINE, 200, 0.035, 12, false),
      recorder: new THREE.CylinderGeometry(0.62, 0.72, 1.0, 48, 1),
      mouth: new THREE.TorusGeometry(0.62, 0.035, 12, 64).rotateX(Math.PI / 2),
      wave: new THREE.TorusGeometry(1, 0.015, 8, 160),
      floorWave: new THREE.RingGeometry(0.97, 1, 160),
    }),
    [],
  );
  const mat = useMemo(() => {
    const classical = Array.from({ length: MAX / 2 }, () =>
      solid(c.warn, { glow: 0.55, edge: c.warn }),
    );
    const hybrid = solid(c.kem, { glow: 0.7 });
    return {
      classical,
      hybrid,
      shields: Array.from({ length: MAX / 2 }, () => glass(c.kem, { rim: 1.3, body: 0.03 })),
      tube: energyTube(c.text3, { base: 0.55, speed: 0.4 }),
      recorder: solid(c.bg.clone().lerp(c.text3, 0.2), { glow: 0.02 }),
      mouth: new THREE.MeshBasicMaterial({
        color: c.danger.clone().multiplyScalar(2.2),
        toneMapped: false,
      }),
      wave: new THREE.MeshBasicMaterial({
        color: c.text.clone().multiplyScalar(2.5),
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
      }),
      floorWave: new THREE.MeshBasicMaterial({
        color: c.warn.clone().multiplyScalar(2),
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
      }),
    };
  }, [c]);
  // The copies the recorder sucks in (red), and the classical packets' shatter (thousands of points).
  const parts = useMemo(() => {
    const stream = makeParticles(Math.round(budget.particles * 0.35), {
      colorA: c.danger,
      colorB: c.warn,
      radius: 0.1,
      size: 0.045,
      seed: 5,
    });
    stream.u.uStream.value = 1;
    stream.u.uStreamFrom.value.set(0.4, Y, 0);
    stream.u.uStreamSpread.value = LEN * 0.8;
    stream.u.uTarget.value.copy(RECORDER).add(new THREE.Vector3(0, 0.5, 0));
    stream.u.uOpacity.value = 0.55;
    // One burst per classical packet, centred where that packet froze.
    const shatter = Array.from({ length: MAX / 2 }, (_, k) => {
      const p = makeParticles(Math.round((budget.particles * 0.6) / (MAX / 2)), {
        colorA: c.warn,
        colorB: c.danger,
        radius: 0.16,
        size: 0.034,
        seed: 11 + k,
      });
      p.u.uBurstSpeed.value = 1.5;
      p.u.uAmp.value = 0.6;
      p.u.uOpacity.value = 0;
      p.u.uBright.value = 1.1;
      return p;
    });
    return { stream, shatter };
  }, [budget.particles, c]);
  useEffect(
    () => () => {
      parts.stream.dispose();
      parts.shatter.forEach((p) => p.dispose());
    },
    [parts],
  );

  const r = {
    classical: useRef<(THREE.Mesh | null)[]>([]),
    hybrid: useRef<(THREE.Group | null)[]>([]),
    wave: useRef<THREE.Mesh>(null),
    floorWave: useRef<THREE.Mesh>(null),
    recorder: useRef<THREE.Group>(null),
  };
  const react = useReactions(mine);
  const clock = useRef(0);
  const frozenAt = useRef<number | null>(null);
  const seen = useRef(0);
  const lastRec = useRef(0);
  const hitDone = useRef(0);

  const packetX = (i: number, t: number) =>
    (((((i / n) * LEN + t * 0.55) % LEN) + LEN) % LEN) - LEN / 2;

  useFrame(({ gl }, dt) => {
    if (!active) return;
    const now = performance.now();
    const broke = !!breakAt && now >= breakAt;
    // Q-Day's clock: frozen for the beat, then 0.2× for a moment, then back up to 1×.
    const since = broke ? (now - breakAt) / 1000 : -1;
    const at = FREEZE_MS / 1000;
    fx.time = reduce
      ? 1
      : !broke || since < 0
        ? 1
        : since < at
          ? 0
          : since < at + SLOW_HOLD
            ? SLOW
            : SLOW + (1 - SLOW) * easeToken(Math.min(1, (since - at - SLOW_HOLD) / SLOW_RAMP));
    if (!reduce) clock.current += dt * fx.time;
    const t = clock.current;
    fx.desat = reduce ? (broke ? 0.5 : 0) : broke ? 0.7 * (1 - span(since, 2.4, 4.5)) + 0.08 : 0;
    // The impact: the moment the freeze ends.
    if (broke && since >= at && hitDone.current !== breakAt && !reduce) {
      hitDone.current = breakAt;
      fx.hit(1);
    }
    fx.punch = reduce || !broke ? 0 : Math.max(0, 1 - Math.abs(since - at - 0.2) / 1.6) * 0.8;
    fx.focus = state.shot.id === "timelapse" ? RECORDER : null;
    const pr = gl.getPixelRatio();
    for (const p of [parts.stream, ...parts.shatter]) {
      p.u.uTime.value = t;
      p.u.uPR.value = pr;
    }

    // The recorder's stream: steady, brighter for a moment on each real recording (sim).
    if (recorded < seen.current) seen.current = 0;
    if (recorded > seen.current) {
      seen.current = recorded;
      lastRec.current = now;
    }
    parts.stream.u.uOpacity.value = broke ? 0.35 : 0.85 + 0.6 * pulse(lastRec.current, 700);
    parts.stream.u.uBright.value = 1.1;
    if (r.recorder.current)
      r.recorder.current.scale.setScalar(1 + (reduce ? 0 : 0.04 * pulse(lastRec.current, 400)));
    // The time-lapse: the recorder's mouth burns hotter as the years pass (it is filling up).
    mat.mouth.color.copy(c.danger).multiplyScalar(2.2 + 2.4 * progress);

    // The shockwave: from the line's centre, across the air and the floor (after the freeze).
    const wk = broke && !reduce ? span(since - at, 0, 1.6) : 1;
    if (r.wave.current && r.floorWave.current) {
      r.wave.current.visible = r.floorWave.current.visible = wk > 0 && wk < 1;
      r.wave.current.scale.setScalar(0.2 + 7 * easeToken(wk));
      r.floorWave.current.scale.setScalar(0.2 + 9 * easeToken(wk));
      mat.wave.opacity = 0.9 * (1 - wk);
      mat.floorWave.opacity = 0.8 * (1 - wk);
    }
    const waveR = broke ? (reduce ? 99 : 0.2 + 7 * easeToken(wk)) : -1;

    if (!broke) frozenAt.current = null;
    else frozenAt.current ??= t;
    let ci = 0;
    let hi = 0;
    for (let i = 0; i < MAX; i++) {
      const on = i < n;
      const enter = reduce ? 1 : springIn(Math.max(0, t - i * 0.05), 0.6, 1.6);
      if (i % 2 === 0) {
        const m = r.classical.current[ci];
        const cm = mat.classical[ci]!;
        ci++;
        if (!m) continue;
        const x = packetX(i, frozenAt.current ?? t);
        m.position.set(x, Y, 0);
        m.visible = on;
        m.scale.setScalar(Math.max(0.0001, enter));
        // Burns away when the wave reaches it, and bursts into thousands of points from there.
        const reached = waveR >= 0 ? span(waveR - Math.abs(x), 0, 0.9) : 0;
        cm.uniforms.uDissolve!.value = reduce ? (broke ? 1 : 0) : reached;
        const sh = parts.shatter[ci - 1]!;
        sh.u.uCenter.value.set(x, Y, 0);
        const burstT = reduce
          ? 1.1
          : reached > 0.3
            ? (since - at - Math.abs(x) / 4.4) * fx.time
            : -1;
        sh.u.uBurst.value = broke && on && burstT >= 0 ? burstT + 0.001 : -1;
        sh.u.uOpacity.value =
          broke && on && burstT >= 0 ? (reduce ? 0.6 : 1 - span(since, 3.5, 6.5)) : 0;
      } else {
        const g = r.hybrid.current[hi];
        const sm = mat.shields[hi]!;
        hi++;
        if (!g) continue;
        const x = packetX(i, t);
        // The shield ripples as the wave passes it, and holds.
        const hit = broke && !reduce ? wobble(since - at - Math.abs(x) / 4.4, 3, 5) : 0;
        g.position.set(x, Y + 0.03 * hit, 0);
        g.visible = on;
        g.scale.setScalar(Math.max(0.0001, enter));
        const shell = g.children[1];
        if (shell) shell.scale.setScalar(1 + 0.18 * Math.abs(hit) + (broke ? 0.05 : 0));
        sm.uniforms.uRim!.value =
          1.3 + (broke ? 1.2 + 3 * Math.abs(hit) : 0) + pulse(react.current.reject, 500);
      }
    }
    mat.hybrid.uniforms.uGlow!.value = broke ? 1.0 : 0.7;
    mat.tube.uniforms.uTime!.value = t;
    mat.tube.uniforms.uBase!.value = broke ? 0.3 : 0.55;

    // The folds: crumpled in the recorder until Q-Day; then pulled out and smoothed (classical),
    // and the hybrid bricks try to open, jam at a crease and crumple.
    const pull = broke ? (reduce ? 1 : easeToken(span(since - at, 0, 0.9))) : 0;
    if (classicalG.current) {
      foldPos.set(RECORDER.x, RECORDER.y + 0.75, RECORDER.z).lerp(FRONT_CLASSICAL, pull);
      classicalG.current.position.copy(foldPos);
      classicalG.current.scale.setScalar(0.55 + 0.45 * pull);
      const f = folds.classical;
      if (!broke) {
        if (f.kind !== "crumpled") f.setCrumpled();
      } else if (f.kind !== "smooth") f.smooth(reduce ? now - 1e6 : breakAt + FREEZE_MS + 600);
      f.update(now, reduce);
    }
    folds.hybrid.forEach((f, k) => {
      const g = hybridG.current[k];
      if (!g) return;
      g.position.copy(k === 0 ? FRONT_HYBRID_A : FRONT_HYBRID_B);
      g.rotation.set(-0.35, 0.5 - k * 0.25, 0.15);
      if (!broke) {
        if (f.kind !== "sealed") f.setSealed();
      } else if (f.kind !== "jam")
        f.jam(reduce ? now - 1e6 : breakAt + FREEZE_MS + 300 + k * 260, 1 + k);
      f.update(now, reduce);
    });
  });

  const id = state.shot.id;
  const show = state.settled;
  return (
    <>
      <DirectorCamera state={state} onSettled={onSettled} drift={0.02} />
      <fog attach="fog" args={[c.bg, 8, 20]} />
      <StageSet y={FLOOR} coneColor={c.warn} coneAt={[RECORDER.x, RECORDER.z]} coneStrength={0.1} />

      {/* The one line all traffic travels on. */}
      <mesh geometry={geo.tube} material={mat.tube} />
      {Array.from({ length: MAX / 2 }, (_, k) => (
        <mesh
          key={`c${k}`}
          ref={(m) => void (r.classical.current[k] = m)}
          geometry={geo.capsule}
          material={mat.classical[k]}
        />
      ))}
      {Array.from({ length: MAX / 2 }, (_, k) => (
        <group key={`h${k}`} ref={(g) => void (r.hybrid.current[k] = g)}>
          <mesh geometry={geo.capsule} material={mat.hybrid} />
          <mesh geometry={geo.shield} material={mat.shields[k]} />
        </group>
      ))}
      <primitive object={parts.stream.points} />
      {parts.shatter.map((p, k) => (
        <primitive key={k} object={p.points} />
      ))}

      {/* The recorder (the simulated network's): a dark drum with a red mouth. */}
      <group ref={r.recorder} position={RECORDER}>
        <mesh geometry={geo.recorder} material={mat.recorder} />
        <mesh geometry={geo.mouth} material={mat.mouth} position={[0, 0.5, 0]} />
      </group>

      <group ref={classicalG}>
        <primitive object={folds.classical.group} />
      </group>
      {folds.hybrid.map((f, k) => (
        <group key={k} ref={(g) => void (hybridG.current[k] = g)}>
          <primitive object={f.group} />
        </group>
      ))}
      <Anchor
        position={[FRONT_CLASSICAL.x, FRONT_CLASSICAL.y + 0.7, FRONT_CLASSICAL.z]}
        label="Classical record · unfolded by the attacker (sim)"
        value={leaks[0] ? (leaks[0].length > 26 ? `${leaks[0].slice(0, 25)}…` : leaks[0]) : "…"}
        role="warn"
        show={show && (id === "climax" || id === "aftermath") && !!breakAt}
      />
      <Anchor
        position={[
          (FRONT_HYBRID_A.x + FRONT_HYBRID_B.x) / 2,
          FRONT_HYBRID_A.y - 0.4,
          FRONT_HYBRID_A.z,
        ]}
        side="down"
        label="Hybrid records · won't unfold"
        value="the folds jam: tag mismatch"
        role="danger"
        show={show && (id === "climax" || id === "aftermath") && !!breakAt}
      />
      <mesh
        ref={r.wave}
        geometry={geo.wave}
        material={mat.wave}
        position={[0, Y, 0]}
        visible={false}
      />
      <mesh
        ref={r.floorWave}
        geometry={geo.floorWave}
        material={mat.floorWave}
        position={[0, FLOOR + 0.01, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        visible={false}
      />

      {/* Which is which: one label per kind of packet. */}
      <Anchor
        position={[-1.6, Y + 0.3, 0]}
        label="Classical packets"
        value="RSA / ECDH keys"
        role="warn"
        show={show && (id === "split" || id === "climax")}
      />
      <Anchor
        position={[1.6, Y - 0.35, 0]}
        label="Hybrid packets"
        value="X25519 + ML-KEM-768 · shielded"
        role="kem"
        side="down"
        show={show && (id === "split" || id === "climax")}
      />
      <Anchor
        position={[RECORDER.x, RECORDER.y - 0.6, RECORDER.z]}
        side="down"
        label="Recorder (sim)"
        value={`${recorded.toLocaleString("en-IN")} packets copied`}
        role="danger"
        show={show && (id === "split" || id === "timelapse")}
      />
      <Anchor
        position={[RECORDER.x + 1.3, RECORDER.y, RECORDER.z]}
        label="Estimated Q-Day"
        value={`${qDayYear} (estimate)`}
        role="warn"
        side="down"
        show={show && id === "timelapse"}
      />
      {leaks.slice(0, small ? 1 : 2).map((text, i) => (
        <Anchor
          key={i}
          position={[i === 0 ? -1.3 : 1.3, Y + 0.6, 0]}
          label="Decrypted"
          value={text.length > 24 ? `${text.slice(0, 23)}…` : text}
          role="warn"
          show={show && id === "climax" && !!breakAt && reduce}
        />
      ))}
      {!reduce && leaks[0] && (
        <FloatingText
          text={leaks[0]}
          from={[-1.4, Y + 0.75, 0.3]}
          start={breakAt ? breakAt + FREEZE_MS + 900 : 0}
          show={id === "climax" && !!breakAt}
        />
      )}
      <Anchor
        position={[2.6, Y - 0.35, 0]}
        label="Hybrid · still sealed"
        value={qExposed === undefined ? "AES-GCM tag mismatch" : `${qExposed} records opened`}
        role="kem"
        side="down"
        show={show && (id === "climax" || id === "aftermath") && qExposed !== undefined}
      />
      <Anchor
        position={[-2.6, Y + 0.3, 0]}
        label="Classical · exposed"
        value={`${exposed.toLocaleString("en-IN")} records opened`}
        role="warn"
        show={show && id === "aftermath"}
      />
    </>
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
