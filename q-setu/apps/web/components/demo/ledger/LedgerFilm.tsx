"use client";

/**
 * Demo 4 as a film. Twelve real ledger entries on an arc, linked by SIG lines (hash + ML-DSA
 * signature): six around #42, a gap, then the six newest, which shift along as live entries arrive.
 * The links are a light rope (lib/motion Rope: verlet, three points per link), so they hang and swing.
 * Tamper: #42 jolts, flickers to DANGER and cracks; the blocks after it are let go and the links after
 * it slacken, so that part of the chain sags between the break and the newest block and swings.
 * Verify: a small sweep ring moves block to block (OK as each link checks) and a soft pulse runs
 * along the rope; both stop hard at the first break: the pulse recoils and the broken block jolts.
 * Blocks are glass (fresnel rims) with a glowing seal inside, in their role colour; the links are
 * an energy tube that follows the rope, carrying the verify pulse as a comet. When the pulse slams
 * into the break, sparks burst there and the stage takes the impact. The edited block's halves burn
 * in a red dissolve, and the sagging part of the chain flickers. Restore pulls the chain taut: the
 * links take up their length again and each block springs back to its place, last first.
 * Every motion starts at a real event (the edit, the verification result, the restore).
 */
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { Anchor } from "@/components/director/Anchor";
import { DirectorCamera } from "@/components/director/DirectorCamera";
import type { DirectorState } from "@/components/director/types";
import { span, set3 } from "@/components/scenes/geometry";
import { palette } from "@/components/world/palette";
import { easeToken } from "@/lib/ease";
import { Rope, springIn, wobble } from "@/lib/motion";
import { Thicken } from "@/components/scenes/Thicken";
import { useBudget } from "@/components/fx/budget";
import { makeDynamicTube } from "@/components/fx/DynamicTube";
import { FXStage, useFX } from "@/components/fx/FXStage";
import { energyTube, glass, solid } from "@/components/fx/materials";
import { makeParticles } from "@/components/fx/Particles";
import { StageSet } from "@/components/fx/StageSet";

export const N = 12;
/** Index on the arc of the entry the insider edits. */
export const TARGET_INDEX = 3;
const R = 7;
const SPAN = (120 * Math.PI) / 180;
/** The verification pulse: one block every 220 ms (slow enough to follow), stopping at a break. */
const STEP_MS = 220;
const CASCADE_MS = 90;
/** The edited block cracking open. */
const CRACK_MS = 900;

/** Rope points per link (block to block). */
const SUB = 4;
const LINKS = (N - 1) * SUB;

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
  /** A SHA3-256 Merkle tree over the four newest entries' hashes (computed in a worker). */
  merkle?: { levels: string[][]; root: string; at: number };
  /** Clicking block i opens its entry (index into `ids`). */
  onPick?: (i: number) => void;
}

export default function LedgerFilm(props: LedgerFilmProps) {
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
  ids,
  onPick,
  tamperedAt,
  verify,
  restoredAt,
  headAt,
  merkle,
}: LedgerFilmProps) {
  const c = useMemo(palette, []);
  const fx = useFX();
  const budget = useBudget();
  // Sparks where the verify pulse slams into the break.
  const sparks = useMemo(() => {
    const p = makeParticles(Math.round(budget.particles * 0.25), {
      colorA: c.danger,
      colorB: c.warn,
      radius: 0.12,
      size: 0.03,
      seed: 21,
    });
    p.u.uBurstSpeed.value = 1.6;
    p.u.uAmp.value = 0.5;
    p.u.uOpacity.value = 0;
    p.u.uBright.value = 1.4;
    return p;
  }, [budget.particles, c]);
  useEffect(() => () => sparks.dispose(), [sparks]);
  const sparked = useRef(0);
  // Stage 4's Merkle build over the four newest blocks.
  const nodes = useRef<(THREE.Group | null)[]>([]);
  const nodeGeo = useMemo(() => new THREE.BoxGeometry(0.16, 0.16, 0.16), []);
  const nodeMats = useMemo(
    () =>
      Array.from(
        { length: 7 },
        () =>
          new THREE.MeshStandardMaterial({
            transparent: true,
            roughness: 0.35,
            metalness: 0.1,
            emissiveIntensity: 0.6,
          }),
      ),
    [],
  );
  const treeEdges = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(6 * 6), 3));
    return new THREE.LineSegments(
      g,
      new THREE.LineBasicMaterial({ transparent: true, depthWrite: false, toneMapped: false }),
    );
  }, []);
  const treeAt = useMemo(() => {
    const leaves = [8, 9, 10, 11].map((i) => blockPos(i).add(new THREE.Vector3(0, 0.6, 0)));
    const mid = [
      leaves[0]!.clone().lerp(leaves[1]!, 0.5),
      leaves[2]!.clone().lerp(leaves[3]!, 0.5),
    ].map((v) => v.add(new THREE.Vector3(0, 0.42, 0)));
    const root = mid[0]!
      .clone()
      .lerp(mid[1]!, 0.5)
      .add(new THREE.Vector3(0, 0.42, 0));
    return [...leaves, ...mid, root];
  }, []);
  const geo = useMemo(() => new THREE.BoxGeometry(0.62, 0.44, 0.44), []);
  // The edited block's two halves (it cracks open along its middle when the row is tampered with).
  const half = useMemo(() => ({ g: new THREE.BoxGeometry(0.3, 0.44, 0.44) }), []);
  const whole = useRef<THREE.Group>(null);
  const halves = useRef<(THREE.Group | null)[]>([]);
  const pulse = useRef<THREE.Group>(null);
  const pulseMat = useMemo(
    () => new THREE.MeshBasicMaterial({ toneMapped: false, transparent: true }),
    [],
  );
  const haloMat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        toneMapped: false,
        transparent: true,
        opacity: 0.25,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    [],
  );
  const blocks = useRef<(THREE.Group | null)[]>([]);
  // Each block: a glass shell with a glowing seal inside; the edited block's halves burn red.
  const mats = useMemo(
    () =>
      Array.from({ length: N }, () => ({
        shell: glass(c.sig, { rim: 1.7, body: 0.06 }),
        seal: solid(c.sig, { glow: 1.1 }),
      })),
    [c],
  );
  const crackMat = useMemo(() => solid(c.danger, { glow: 0.8, edge: c.danger }), [c]);
  const sealGeo = useMemo(() => new THREE.OctahedronGeometry(0.11, 0), []);
  const tube = useMemo(() => makeDynamicTube(LINKS + 1, 8), []);
  const tubeMat = useMemo(() => energyTube(c.sig, { base: 0.9, vertexColors: true }), [c]);
  const tubeRgb = useMemo(() => new Float32Array((LINKS + 1) * 3), []);
  // The links: scratch arrays written each frame, copied into the thick line's own buffers.
  const linkGeo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(LINKS * 6), 3));
    g.setAttribute("color", new THREE.BufferAttribute(new Float32Array(LINKS * 6), 3));
    return g;
  }, []);
  const sweep = useRef<THREE.Mesh>(null);
  const sweepAt = useMemo(() => new THREE.Vector3(0, -10, 0), []);
  // The rope: block i is point i·SUB; the points between are the link's cord.
  const rope = useMemo(() => {
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i < N; i++) {
      const a = blockPos(i);
      pts.push(a);
      if (i < N - 1) {
        const b = blockPos(i + 1);
        for (let k = 1; k < SUB; k++) pts.push(a.clone().lerp(b, k / SUB));
      }
    }
    const r = new Rope(pts);
    r.gravity.set(0, -3, 0);
    r.damping = 0.975;
    return { r, rest: r.rest.slice() };
  }, []);
  /** Where each block was when the restore began (it springs from there back to its place). */
  const restoreFrom = useRef<{ at: number; pos: THREE.Vector3[] } | null>(null);
  const kicked = useRef(0);
  const arc = useMemo(() => new THREE.Vector3(), []);
  const p = useMemo(() => new THREE.Vector3(), []);
  const q = useMemo(() => new THREE.Vector3(), []);
  const col = useMemo(() => new THREE.Color(), []);
  const linkCol = useMemo(() => new THREE.Color(), []);
  const head = useMemo(() => blockPos(N - 1), []);
  const target = useMemo(() => blockPos(TARGET_INDEX), []);

  useFrame(({ clock, gl }, dt) => {
    if (!active) return;
    const now = performance.now();
    const reduce = state.reduce;
    const t = reduce ? 0 : clock.elapsedTime;
    sparks.u.uTime.value = t;
    sparks.u.uPR.value = gl.getPixelRatio();
    const broken = verify?.broken ?? -1;
    // The scan: one block every STEP_MS from the left; it stops at the break.
    const scanned = verify
      ? reduce
        ? N
        : Math.min(broken >= 0 ? broken + 1 : N, (now - verify.at) / STEP_MS)
      : -1;
    // The Merkle build: leaves rise from the newest blocks, pair up, hash to the root (Stage 4).
    const mt = merkle ? now - merkle.at : -1;
    treeAt.forEach((at, k) => {
      const g = nodes.current[k];
      if (!g) return;
      const delay = k < 4 ? k * 110 : k < 6 ? 650 + (k - 4) * 110 : 1000;
      const e = mt < 0 ? 0 : reduce ? 1 : easeToken(span(mt - delay, 0, 450));
      g.visible = e > 0;
      g.scale.setScalar(Math.max(0.001, e));
      if (k < 4) g.position.copy(blockPos(8 + k, q)).lerp(at, e);
      else g.position.copy(at);
      const flash = mt >= 0 && !reduce ? Math.max(0, 1 - Math.abs(mt - delay - 300) / 250) : 0;
      nodeMats[k]!.color.copy(c.sig).lerp(c.text, flash);
      nodeMats[k]!.emissive.copy(nodeMats[k]!.color);
      nodeMats[k]!.opacity = state.shot.id === "chain" ? 1 : 0.35;
    });
    const tp = treeEdges.geometry.attributes.position!.array as Float32Array;
    [
      [0, 4],
      [1, 4],
      [2, 5],
      [3, 5],
      [4, 6],
      [5, 6],
    ].forEach(([a, b], j) => {
      const A = nodes.current[a!]?.position;
      const B = nodes.current[b!]?.position;
      if (A && B) {
        set3(tp, j * 2, A.x, A.y, A.z);
        set3(tp, j * 2 + 1, B.x, B.y, B.z);
      }
    });
    treeEdges.geometry.attributes.position!.needsUpdate = true;
    const tm = treeEdges.material as THREE.LineBasicMaterial;
    tm.color.copy(c.sig);
    tm.opacity = mt > 700 ? (state.shot.id === "chain" ? 0.6 : 0.2) : 0;
    // ── The rope. ─────────────────────────────────────────────────────────────────────────
    const R_ = rope.r;
    const slack = tamperedAt ? now - tamperedAt - 300 : -1;
    // The break point: the edited block jolts on the edit, and again when the pulse hits it.
    const hitAt = verify && broken >= 0 ? verify.at + broken * STEP_MS : 0;
    const jolt = reduce
      ? 0
      : (tamperedAt ? wobble((now - tamperedAt) / 1000, 5, 6) * 0.12 : 0) +
        (hitAt ? wobble((now - hitAt) / 1000, 6, 7) * 0.07 : 0);
    if (restoredAt && !tamperedAt) {
      if (restoreFrom.current?.at !== restoredAt)
        restoreFrom.current = {
          at: restoredAt,
          pos: Array.from({ length: N }, (_, i) => R_.p[i * SUB]!.clone()),
        };
    } else restoreFrom.current = null;
    for (let i = 0; i < N; i++) {
      blockPos(i, arc);
      arc.y += reduce ? 0 : 0.03 * Math.sin(t * 0.8 + i * 0.6);
      const n = i * SUB;
      const after = i > TARGET_INDEX && i < N - 1;
      if (reduce) {
        // Reduced motion: the old composed state, no simulation.
        const j = i - TARGET_INDEX;
        const sag = i > TARGET_INDEX && tamperedAt ? 0.55 * (1 - Math.exp(-j / 2.2)) : 0;
        R_.pin(n, arc.setY(arc.y - (i < N - 1 ? sag : 0)));
      } else if (after && slack > 0) {
        if (R_.pinned[n]) {
          R_.release(n);
          // Let go with a sideways shove: the hanging part swings, not just drops.
          if (kicked.current !== tamperedAt && i === TARGET_INDEX + 1) {
            kicked.current = tamperedAt;
            R_.kick(n, { x: 0, y: -1.2, z: 1.6 });
          }
        }
      } else if (after && restoreFrom.current) {
        // Restore: each block springs from where it hung back to its place, last block first.
        const k = springIn((now - restoredAt - (N - 1 - i) * CASCADE_MS) / 1000, 0.45, 1.8);
        R_.pin(n, q.copy(restoreFrom.current.pos[i]!).lerp(arc, k));
      } else if (i === TARGET_INDEX) R_.pin(n, arc.setY(arc.y - jolt));
      else R_.pin(n, arc);
    }
    // Slack links after the break (the chain sags); taut everywhere else (restore pulls it in).
    for (let k = 0; k < R_.rest.length; k++) {
      const block = Math.floor(k / SUB);
      R_.rest[k] = rope.rest[k]! * (tamperedAt && block >= TARGET_INDEX + 1 ? 1.07 : 1.004);
    }
    if (reduce) {
      for (let i = 0; i < N - 1; i++)
        for (let k = 1; k < SUB; k++)
          R_.p[i * SUB + k]!.copy(R_.p[i * SUB]!).lerp(R_.p[(i + 1) * SUB]!, k / SUB);
    } else R_.step(Math.min(dt, 1 / 30));

    const pos = linkGeo.attributes.position!.array as Float32Array;
    const lc = linkGeo.attributes.color!.array as Float32Array;
    for (let i = 0; i < N; i++) {
      const g = blocks.current[i];
      const m = mats[i]!;
      p.copy(R_.p[i * SUB]!);
      const after = i > TARGET_INDEX;
      // How far this block has dropped from its place (for the dimming and the tip).
      const d = after ? Math.min(1, Math.max(0, (blockPos(i, q).y - p.y) / 0.5)) : 0;
      const j = i - TARGET_INDEX;
      const fresh = i === N - 1 && headAt ? easeToken(span(now - headAt, 0, 500)) : 1;
      if (g) {
        g.position.copy(p);
        g.lookAt(0, p.y, R * 0.6);
        // Hanging blocks tip with the rope's slope.
        if (after && d > 0) g.rotateZ(0.22 * d * Math.min(1, j / 3));
        g.scale.setScalar(Math.max(0.0001, fresh));
      }
      if (i === TARGET_INDEX) {
        // Crack: the edited block splits in two and the halves swing apart (restore closes it).
        const k = reduce
          ? tamperedAt
            ? 1
            : 0
          : tamperedAt
            ? easeToken(span(now - tamperedAt - 150, 0, CRACK_MS))
            : restoredAt
              ? 1 - easeToken(span(now - restoredAt, 0, 600))
              : 0;
        if (whole.current) whole.current.visible = k <= 0.001;
        // The halves burn at their broken edges (a red noise dissolve).
        crackMat.uniforms.uDissolve!.value = reduce ? 0.3 : 0.32 * k;
        halves.current.forEach((h, side) => {
          if (!h) return;
          const sgn = side === 0 ? -1 : 1;
          h.visible = k > 0.001;
          h.position.set(sgn * (0.155 + 0.12 * k), -0.05 * k, 0);
          h.rotation.set(0, sgn * 0.2 * k, -sgn * 0.32 * k);
        });
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
      // The sagging part of the chain flickers, as if losing power.
      const flick =
        after && tamperedAt && !reduce && i < N - 1
          ? 0.75 + 0.25 * Math.sin(now / 47 + i * 1.7) * Math.sin(now / 113 + i)
          : 1;
      (m.shell.uniforms.uColor!.value as THREE.Color).copy(col);
      (m.seal.uniforms.uColor!.value as THREE.Color).copy(col);
      m.seal.uniforms.uGlow!.value = (isBad ? 1.6 : 1.1) * flick;
      m.shell.uniforms.uOpacity!.value = (1 - 0.5 * d) * flick;
    }
    // The cord: every rope segment, coloured by the link it belongs to (the link into block b).
    for (let k = 0; k < LINKS; k++) {
      const a = R_.p[k]!;
      const b = R_.p[k + 1]!;
      set3(pos, k * 2, a.x, a.y, a.z);
      set3(pos, k * 2 + 1, b.x, b.y, b.z);
      const into = Math.floor(k / SUB) + 1;
      const gap = into === N / 2;
      const lcol = linkCol.copy(c.sig);
      // The link into a block is broken from the edit onward; the gap is drawn faint.
      if (tamperedAt && into > TARGET_INDEX) lcol.lerp(c.text3, 0.8);
      if (gap) lcol.multiplyScalar(0.25);
      set3(lc, k * 2, lcol.r, lcol.g, lcol.b);
      set3(lc, k * 2 + 1, lcol.r, lcol.g, lcol.b);
    }
    // The energy tube along the rope, coloured link by link (the colour of the link into each point).
    for (let k = 0; k <= LINKS; k++) {
      const src = Math.min(LINKS - 1, Math.max(0, k - 1));
      tubeRgb[k * 3] = lc[src * 6]!;
      tubeRgb[k * 3 + 1] = lc[src * 6 + 1]!;
      tubeRgb[k * 3 + 2] = lc[src * 6 + 2]!;
    }
    tube.update(R_.p, 0.045, tubeRgb);
    tubeMat.uniforms.uTime!.value = t;
    void pos;
    // The verification pulse: a point of light running along the rope block to block. It stops
    // dead at the first break (a recoil, a red flare, the block jolts) and fades; on an intact chain
    // it runs to the newest block.
    if (pulse.current) {
      const g = pulse.current;
      if (!verify || reduce) {
        g.visible = false;
        tubeMat.uniforms.uHeads!.value[0] = -1;
      } else {
        const run = (now - verify.at) / STEP_MS;
        const stop = broken >= 0 ? broken : N - 1;
        const f = Math.min(stop, Math.max(0, run)) * SUB;
        const i0 = Math.min(LINKS - 1, Math.floor(f));
        p.copy(R_.p[i0]!).lerp(R_.p[Math.min(LINKS, i0 + 1)]!, f - i0);
        const since = (run - stop) * STEP_MS; // ms since it reached the stop
        const fade = since > 0 ? Math.max(0, 1 - since / 1200) : 1;
        g.visible = fade > 0.01;
        const hit = broken >= 0 && since > 0;
        // The recoil: knocked back along the rope a touch, ringing down.
        if (hit && stop > 0) {
          q.copy(R_.p[Math.max(0, stop * SUB - 1)]!)
            .sub(p)
            .normalize();
          p.addScaledVector(q, 0.1 * Math.max(0, wobble(since / 1000, 4, 8)));
        }
        g.position.set(p.x, p.y + 0.05, p.z);
        // The pulse as a comet in the tube, and the slam into the break.
        tubeMat.uniforms.uHeads!.value[0] = fade > 0.01 ? f / LINKS : -1;
        if (hit && sparked.current !== verify.at) {
          sparked.current = verify.at;
          fx.hit(0.8);
        }
        pulseMat.color.copy(hit ? c.danger : c.ok);
        haloMat.color.copy(pulseMat.color);
        pulseMat.opacity = fade;
        haloMat.opacity = 0.3 * fade * (hit ? 1.6 : 1);
        g.scale.setScalar(hit ? 1 + 1.4 * easeToken(Math.min(1, since / 300)) : 1);
      }
    }
    // Sparks: a burst at the break, the moment the pulse reaches it.
    {
      const hitAt = verify && broken >= 0 ? verify.at + broken * STEP_MS : 0;
      const st = hitAt ? (now - hitAt) / 1000 : -1;
      if (hitAt) sparks.u.uCenter.value.copy(R_.p[broken * SUB]!);
      sparks.u.uBurst.value = !reduce && st >= 0 && st < 3 ? st + 0.001 : -1;
      sparks.u.uOpacity.value = !reduce && st >= 0 && st < 3 ? 1 - st / 3 : 0;
    }
    // The sweep ring: a small ring under the block being checked, springing block to block; --ok
    // while links pass, --danger where the chain breaks. Reduced motion: it sits at the break.
    if (sweep.current) {
      const done = verify && broken < 0 && scanned >= N && now - verify.at > N * STEP_MS + 500;
      const on = !!verify && scanned >= 0 && !done && (!reduce || broken >= 0);
      sweep.current.visible = on;
      const at = Math.min(
        N - 1,
        Math.max(0, broken >= 0 && scanned >= broken ? broken : Math.floor(scanned)),
      );
      q.copy(R_.p[at * SUB]!);
      q.y -= 0.34;
      if (reduce || sweepAt.y < -5) sweepAt.copy(q);
      else sweepAt.lerp(q, 1 - Math.exp(-dt * 16));
      sweep.current.position.copy(sweepAt);
      const hit = broken >= 0 && scanned >= broken;
      const m = sweep.current.material as THREE.MeshStandardMaterial;
      m.color.copy(hit ? c.danger : c.ok);
      m.emissive.copy(m.color);
      sweep.current.scale.setScalar(
        hit && !reduce
          ? 1 + 0.25 * Math.max(0, wobble((now - verify!.at - broken * STEP_MS) / 1000, 4, 6))
          : 1,
      );
      sweep.current.rotation.z = reduce ? 0 : t * 1.2;
    }
  });

  const id = state.shot.id;
  const show = state.settled;
  const broken = verify?.broken ?? -1;
  return (
    <Thicken>
      <DirectorCamera state={state} onSettled={onSettled} drift={0.02} />
      <fog attach="fog" args={[c.bg, 8, 20]} />
      {treeAt.map((_, k) => (
        <group key={k} ref={(g) => void (nodes.current[k] = g)} visible={false}>
          <mesh geometry={nodeGeo} material={nodeMats[k]} />
        </group>
      ))}
      <primitive object={treeEdges} />
      {merkle && (
        <Anchor
          position={[treeAt[6]!.x, treeAt[6]!.y + 0.35, treeAt[6]!.z]}
          label={`Merkle root ${merkle.root.slice(0, 10)}…`}
          value="SHA3-256 over the 4 newest entries"
          role="sig"
          show={show && id === "chain"}
        />
      )}
      <ambientLight intensity={0.5} />
      <directionalLight position={[2, 5, 5]} intensity={0.8} />
      <directionalLight position={[0, 2, -8]} intensity={0.3} color={c.sig} />
      <mesh geometry={tube.geometry} material={tubeMat} frustumCulled={false} />
      <primitive object={sparks.points} />
      <StageSet y={-1.3} coneColor={c.sig} coneAt={[0, -3.5]} coneStrength={0.1} />
      {Array.from({ length: N }, (_, i) => (
        <group
          key={i}
          ref={(g) => void (blocks.current[i] = g)}
          onClick={(e) => {
            e.stopPropagation();
            onPick?.(i);
          }}
          onPointerOver={() => onPick && (document.body.style.cursor = "pointer")}
          onPointerOut={() => (document.body.style.cursor = "")}
        >
          <group ref={i === TARGET_INDEX ? whole : undefined}>
            <mesh geometry={geo} material={mats[i]!.shell} />
            <mesh geometry={sealGeo} material={mats[i]!.seal} />
          </group>
          {i === TARGET_INDEX &&
            [0, 1].map((side) => (
              <group key={side} ref={(h) => void (halves.current[side] = h)} visible={false}>
                <mesh geometry={half.g} material={crackMat} />
              </group>
            ))}
        </group>
      ))}
      <group ref={pulse} visible={false}>
        <mesh material={pulseMat}>
          <sphereGeometry args={[0.07, 20, 14]} />
        </mesh>
        <mesh material={haloMat}>
          <sphereGeometry args={[0.24, 20, 14]} />
        </mesh>
      </group>
      <mesh ref={sweep} visible={false} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.42, 0.03, 10, 64]} />
        <meshStandardMaterial
          color={c.ok}
          emissive={c.ok}
          emissiveIntensity={0.8}
          roughness={0.3}
        />
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
    </Thicken>
  );
}
