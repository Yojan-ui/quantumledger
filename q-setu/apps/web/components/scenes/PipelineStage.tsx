"use client";

/**
 * The five-stage diagnostics stage, built on the director. Six shots (standby, then one per stage);
 * the camera moves when the pipeline's stage changes, and every visual change waits for the real
 * event behind it (scan result, plan, handshake, ledger append, sweep result). The viewer can drag
 * to orbit, scroll to zoom and double-click to re-frame; hovering an object shows its label.
 * Off screen it pauses. Reduced motion: cuts, no drift, nothing streams. Phones: half the particles,
 * no focus pull.
 */
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { Anchor } from "@/components/director/Anchor";
import { DirectorCamera } from "@/components/director/DirectorCamera";
import type { Shot } from "@/components/director/types";
import { useDirector } from "@/components/director/useDirector";
import { palette } from "@/components/world/palette";
import { burst } from "@/lib/client/burst";
import { LEVELS, type PipelineState } from "@/lib/client/pipeline";
import { mosca } from "@/lib/mosca";
import { Background } from "./pipeline/Background";
import { CLIENT, LINK_MID, R, SERVER, VAULT } from "./pipeline/geometry";
import { Link } from "./pipeline/Link";
import { CAMERA_MS, makeLook, updateLook, type Look } from "./pipeline/look";
import { Merkle, ROOT } from "./pipeline/Merkle";
import { Mosca } from "./pipeline/Mosca";
import { Radar } from "./pipeline/Radar";
import { Swarm } from "./pipeline/Swarm";
import { tap, Vault, type Taps } from "./pipeline/Vault";
import { hero as heroState, useHero } from "@/lib/client/hero";
import { Thicken } from "@/components/scenes/Thicken";
import { Crystal } from "./pipeline/Crystal";
import { KeyField } from "./pipeline/KeyField";
import { Dust } from "./Dust";
import { Studio } from "./Studio";
import { termify } from "@/components/ui/Term";

const heroExit = () => heroState.exit;

const SHOTS: Shot[] = [
  { id: "standby", camera: { position: [0, 1.6, 11], target: [0, 0.6, 0], fov: 42 }, caption: "" },
  {
    id: "harvest",
    camera: { position: [-2.2, 1.2, 8.6], target: [0, 0.2, 0.6], fov: 42 },
    caption: "",
  },
  { id: "score", camera: { position: [0.6, 2.2, 7.4], target: [0, 1.5, 0], fov: 44 }, caption: "" },
  {
    id: "defend",
    camera: { position: [0, 2.6, 9.6], target: [0, 0.8, 0.4], fov: 44 },
    caption: "",
  },
  {
    id: "prove",
    camera: { position: [1.1, 4.4, 7.6], target: [-0.4, 3.6, 0], fov: 44 },
    caption: "",
  },
  { id: "rescan", camera: { position: [0, 7.6, 11.5], target: [0, 1.5, 0], fov: 46 }, caption: "" },
];

const hex = (h: string, n = 10) => `${h.slice(0, n)}…`;

/** An invisible hit area: hovering it shows the object's label. */
function Hit({
  id,
  at,
  r,
  on,
  pick,
}: {
  id: string;
  at: THREE.Vector3 | [number, number, number];
  r: number;
  on: (id: string | null) => void;
  /** Click: pin (or unpin) this object's label. */
  pick: (id: string) => void;
}) {
  return (
    <mesh
      position={at}
      onPointerOver={(e) => {
        e.stopPropagation();
        on(id);
      }}
      onPointerOut={() => on(null)}
      onClick={(e) => {
        e.stopPropagation();
        pick(id);
      }}
    >
      <sphereGeometry args={[r, 12, 8]} />
      <meshBasicMaterial transparent opacity={0} depthWrite={false} colorWrite={false} />
    </mesh>
  );
}

export default function PipelineStage({
  state: s,
  active,
  hero = false,
}: {
  state: PipelineState;
  active: boolean;
  /**
   * The homepage hero: the opening's particle mark (lib/client/hero) and no anchored labels; the
   * headline and the status pill over the stage say what's happening instead.
   */
  hero?: boolean;
}) {
  const c = useMemo(palette, []);
  const director = useDirector(SHOTS);
  const look = useRef<Look>(makeLook(c));
  const taps = useRef<Taps>({ drops: [], next: 0, count: 0 });
  const sweepStart = useRef(0);
  const entered = useRef<number[]>([0, 0, 0, 0, 0]);
  const sweepResult = useRef(0);
  const [hover, setHover] = useState<string | null>(null);
  // A clicked object's label stays up (click it again to unpin); hover shows the others.
  const [pinned, setPinnedId] = useState<string | null>(null);
  const pick = (id: string) => setPinnedId((p) => (p === id ? null : id));
  const lit = (id: string) => hover === id || pinned === id;
  const mobile = useMemo(() => typeof window !== "undefined" && window.innerWidth < 768, []);
  // Fewer, calmer particles: the shape reads better than the quantity.
  const count = mobile ? 1000 : 2000;
  // Once the hero's opening has played, the camera stops swaying: a settled end.
  const heroPhase = useHero((h) => h.phase);

  // The camera follows the pipeline's stage (shot 0 is standby).
  useEffect(() => {
    if (s.stage >= 0) entered.current[s.stage] = performance.now();
    director.go(s.stage + 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.stage]);

  // Real-event timestamps the scene needs beyond doneAt: when the sweep began, when its result came.
  const rescan = s.status[4];
  useEffect(() => {
    // The sweep line starts once the camera has framed the radar.
    if (rescan === "running")
      sweepStart.current = performance.now() + (director.state.reduce ? 0 : CAMERA_MS);
    if (rescan === "idle") sweepStart.current = sweepResult.current = 0;
    if (rescan === "done" || rescan === "failed") sweepResult.current = performance.now();
  }, [rescan, director.state.reduce]);
  // A new scan resets the wiretap counter.
  useEffect(() => {
    if (s.status[0] === "running") Object.assign(taps.current, { drops: [], next: 0, count: 0 });
  }, [s.status]);

  // One burst when the real sweep verifies (once per sweep).
  const verified = s.status[4] === "done" && !!s.sweep?.ok;
  useEffect(() => {
    if (!verified || director.state.reduce) return;
    const t = setTimeout(() => {
      const el = [...document.querySelectorAll<HTMLElement>("[data-hud-stage]")].find(
        (e) => e.offsetParent,
      );
      if (el) burst(el);
    }, 2600);
    return () => clearTimeout(t);
  }, [verified, director.state.reduce]);

  useFrame(() => {
    const L = look.current;
    L.active = active;
    L.reduce = director.state.reduce;
    L.mobile = mobile;
    if (active)
      updateLook(L, s, performance.now(), sweepStart.current, sweepResult.current, entered.current);
  }, -1);

  const doneCount = s.status.filter((x) => x === "done").length;
  const stage = s.stage;
  const settled = director.state.settled;
  const show = (st: number, id?: string) =>
    (settled && stage === st) || (id !== undefined && lit(id));
  const p = s.scan?.probe;
  const m = mosca(s.mosca.x, s.mosca.y);
  const year = new Date().getFullYear();
  const L = s.patch ? LEVELS[s.patch.level] : LEVELS[s.level];
  const failed = s.sweep && !s.sweep.ok ? s.sweep.broken : undefined;
  const role =
    stage === 0
      ? c.danger
      : stage === 1
        ? c.warn
        : stage === 2
          ? c.kem
          : stage === 3
            ? c.sig
            : c.ok;
  const orbitEl = useMemo(
    () => () =>
      [...document.querySelectorAll<HTMLElement>("[data-hud-stage]")].find((e) => e.offsetParent) ??
      null,
    [],
  );

  return (
    <Thicken>
      <DirectorCamera
        state={director.state}
        onSettled={director.onSettled}
        drift={hero && heroPhase === "idle" ? 0 : 0.02}
        range={[1.2, 1.6]}
        orbit={orbitEl}
        zoom={!hero}
        shiftX={hero && !mobile ? 0.2 : 0}
        shiftY={hero && mobile ? 0.24 : 0}
        pull={hero ? heroExit : undefined}
      />
      <fog attach="fog" args={[c.bg, 11, 34]} />
      <ambientLight intensity={0.35} />
      <directionalLight position={[3, 6, 5]} intensity={0.8} />
      {/* The rim light takes the stage's role colour. */}
      <pointLight position={[0, 2, -5]} intensity={8} distance={14} color={role} />

      {/* The hero's backdrop: this visitor's own ML-KEM-768 public key, one dot per byte. */}
      {hero && <KeyField look={look} />}
      <Background look={look} progress={doneCount / 5} />
      <Swarm look={look} count={count} intro={hero} />
      <Crystal look={look} />
      <Dust color={c.text3} count={600} />
      {/* Reflections for the glass blocks and the metal drum, and a soft shadow on the floor. */}
      <Studio rim={c.kem} lights={false} floorY={-2.95} shadowScale={14} />
      <Link look={look} onCopy={() => tap(taps.current, performance.now())} />
      <Vault look={look} taps={taps} labelled={!mobile && !hero} labelIn={[0, 2, 4]} />
      <Mosca look={look} x={s.mosca.x} y={s.mosca.y} count={mobile ? 500 : 900} compact={mobile} />
      <Merkle
        look={look}
        previous={s.proof?.previous.length ?? 0}
        failedAt={!!failed && failed.id === s.proof?.anchorId}
      />
      <Radar look={look} />

      <Hit id="sphere" at={[0, 0, 0]} r={R} on={setHover} pick={pick} />
      <Hit id="server" at={SERVER} r={0.6} on={setHover} pick={pick} />
      <Hit id="client" at={CLIENT} r={0.6} on={setHover} pick={pick} />
      <Hit id="vault" at={VAULT} r={0.7} on={setHover} pick={pick} />
      <Hit id="link" at={LINK_MID} r={0.4} on={setHover} pick={pick} />
      {s.proof && <Hit id="block" at={ROOT} r={0.45} on={setHover} pick={pick} />}

      {/* On phones the drawer below shows these values: labels would escape the small stage. */}
      {!mobile && !hero && (
        <>
          {/* 01 HARVESTING: the real scan values. */}
          <Anchor
            position={[0, R + 0.35, 0]}
            label={p ? `${p.protocol ?? "TLS"} · ${p.group}` : "target"}
            value={p ? `${p.host}${s.cached ? " (cached real scan)" : ""}` : "awaiting scan"}
            role={p?.hybridPq ? "ok" : "danger"}
            show={!!p && show(0, "sphere")}
          />
          <Anchor
            position={[SERVER.x, 0.75, 0]}
            label={s.patch ? `${L.sig} (sim)` : "server certificate"}
            value={s.patch ? "patched certificate key" : (p?.certKey ?? "—")}
            role={s.patch ? "sig" : "danger"}
            show={!!p && show(0, "server")}
          />
          <Anchor
            position={[CLIENT.x, 0.75, 0]}
            label="client"
            value={s.patch ? `X25519 share · ${s.patch.clientHelloBytes} B` : "browser / app"}
            role={s.patch ? "kem" : undefined}
            show={lit("client")}
          />
          {/* 02 SHELF-LIFE: Mosca, from the sliders and the cited estimate. */}
          {m && (
            <Anchor
              position={[2.6, -0.2, 0.6]}
              label={`${s.mosca.x} + ${s.mosca.y} = ${m.sum} ${m.exposed ? ">" : "≤"} Z`}
              value={`Z ${m.z.low}–${m.z.high} yr (estimate) · risk ${s.risk ?? "—"}/100`}
              role={m.exposed ? "danger" : "ok"}
              show={s.risk !== undefined && show(1, "sphere")}
            />
          )}
          {m && (
            <Anchor
              position={[-R * 1.42, 0.55, 0]}
              label="Estimated Q-Day"
              value={`${year + m.z.low}–${year + m.z.high} (estimate)`}
              role="warn"
              side="down"
              show={s.risk !== undefined && show(1)}
            />
          )}
          {/* 03 LATTICE: the real handshake's sizes and timings. */}
          <Anchor
            position={[LINK_MID.x, LINK_MID.y + 0.3, LINK_MID.z]}
            label={
              s.patch
                ? `${s.patch.kem} ciphertext · ${s.patch.ciphertextBytes} B`
                : "classical key exchange"
            }
            value={
              s.patch
                ? `HKDF-SHA256(X25519 ‖ ML-KEM) → session ${s.patch.sessionId.slice(0, 8)} · ${s.patch.ms.toFixed(1)} ms`
                : `${p?.group ?? "—"} · recordable`
            }
            role={s.patch ? "kem" : "danger"}
            show={(!!s.patch && show(2, "link")) || (!s.patch && lit("link"))}
          />
          <Anchor
            position={[VAULT.x - 2.0, VAULT.y + 1.0, VAULT.z]}
            label="WIRETAP DISSOLVED"
            value="new captures unreadable"
            role="kem"
            show={!!s.patch && show(2, "vault")}
          />
          {/* 04 ANCHORED: the real Merkle root, block and signature. */}
          {s.proof && (
            <>
              <Anchor
                position={[ROOT.x - 1.6, ROOT.y + 0.1, 0]}
                label={`Merkle root ${hex(s.proof.root)}`}
                value={termify("scan · CBOM · policy · transcript", false)}
                role="sig"
                show={show(3)}
              />
              <Anchor
                position={[ROOT.x + 1.4, ROOT.y + 0.4, 0]}
                label={`Block #${s.proof.anchorId} · ${s.proof.alg}`}
                value={`hash ${hex(s.proof.blockHash, 12)}`}
                role={failed ? "danger" : s.sweep?.ok ? "ok" : "sig"}
                show={show(3, "block")}
              />
            </>
          )}
        </>
      )}
      {/* 05 VERIFIED, or where the sweep stopped. */}
      <Anchor
        position={[0, R + 0.9, 0]}
        label="100% PQC-READY (sim)"
        value={
          s.sweep
            ? `sweep ✓ checkpoint + ${s.sweep.checked} entries · ${s.sweep.ms.toFixed(1)} ms`
            : ""
        }
        role="ok"
        show={!hero && verified && settled && stage === 4}
      />
      {failed && (
        <Anchor
          position={[ROOT.x + 2.4, ROOT.y - 0.4, 0]}
          label={`Hash mismatch at #${failed.id}`}
          value={
            failed.expected && failed.actual
              ? `stored ${hex(failed.expected, 8)} ≠ recomputed ${hex(failed.actual, 8)}`
              : failed.detail
          }
          role="danger"
          show={settled && stage === 4}
        />
      )}
    </Thicken>
  );
}
