"use client";

/**
 * The Q-Shield pipeline in 3D. Atlas's stages sit on a curved track; one block per batch (system) glows by
 * its risk weight and travels along the track to the stage the run has reached. The stage in focus plays
 * its own motion: Detect a scan sweep, Proof Chain hash links forming, Plan the blocks sorting into wave
 * rows, Tie-break a real tied pair swapping into its final order (none is invented), Handshakes a
 * key-exchange pulse, Gates a pass / fail glow, QAOA a circuit shimmer, Seal ledger blocks locking into a
 * chain, Report everything lit. What moves and where it ends comes only from the model (lib/client/
 * atlas-flowviz: real SSE events and Atlas JSON); time only eases between those states. The camera eases
 * towards the focused stage; soft light, additive halos (bloom without a post pass in the shared
 * canvas) and depth fog. Rendered through LazyView (the site's single canvas).
 */
import { PerspectiveCamera } from "@react-three/drei";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { palette } from "@/components/world/palette";
import { stationDone, type FlowModel } from "@/lib/client/atlas-flowviz";

const MAX_BATCH = 160;
const MAX_LEDGER = 16;
const BOX = 0.34;
const QUBITS = 4;
const GATES = 12;

/** A soft radial alpha falloff (white; the instance colour tints it), built from pixels. */
function haloTexture() {
  const N = 64;
  const px = new Uint8Array(N * N * 4);
  for (let y = 0; y < N; y++)
    for (let x = 0; x < N; x++) {
      const d = Math.min(1, Math.hypot(x - N / 2 + 0.5, y - N / 2 + 0.5) / (N / 2));
      const a = d < 0.35 ? 0.9 - (d / 0.35) * 0.65 : 0.25 * (1 - (d - 0.35) / 0.65);
      px.set([255, 255, 255, Math.round(255 * a)], (y * N + x) * 4);
    }
  const t = new THREE.DataTexture(px, N, N, THREE.RGBAFormat);
  t.needsUpdate = true;
  return t;
}

/** A stage-name label as a sprite texture (the colour comes from the palette at runtime). */
function labelTexture(text: string, color: string) {
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 96;
  const g = c.getContext("2d")!;
  g.font = "600 44px ui-monospace, SFMono-Regular, Menlo, monospace";
  g.fillStyle = color;
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText(text, 256, 48);
  const t = new THREE.CanvasTexture(c);
  t.anisotropy = 4;
  return t;
}

const ease = (x: number) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));

export default function PipelineFlow({
  model,
  active,
  focus,
  onHover,
}: {
  model: FlowModel;
  active: boolean;
  /** The stage in focus: the live run's frontier, or the replay's current stage. */
  focus: number;
  onHover?: (station: number | null) => void;
}) {
  const c = useMemo(palette, []);
  const halo = useMemo(haloTexture, []);
  const n = model.stations.length;
  // the track: a gentle curve through the stations, left to right, receding in the middle
  const curve = useMemo(() => {
    const m = Math.max(2, n);
    const pts = Array.from(
      { length: m },
      (_, i) =>
        new THREE.Vector3((i - (m - 1) / 2) * 2.1, -2.2, -Math.sin((i / (m - 1)) * Math.PI) * 2.2),
    );
    return new THREE.CatmullRomCurve3(pts, false, "catmullrom", 0.4);
  }, [n]);
  const track = useMemo(() => new THREE.TubeGeometry(curve, 160, 0.025, 6, false), [curve]);
  const at = (i: number) => curve.getPoint(n > 1 ? Math.min(1, Math.max(0, i / (n - 1))) : 0);
  const labels = useMemo(
    () =>
      model.stations.map((s, i) => ({
        id: s.id,
        tex: labelTexture(`${i + 1} ${s.label.toUpperCase()}`, c.text.getStyle()),
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [model.stations.map((s) => s.label).join("|"), c],
  );
  // the whole scene: track, stations, wave rows above them and the ledger tower beside Seal
  const bounds = useMemo(() => {
    const a = at(0),
      b = at(n - 1);
    return { x0: a.x - 1.2, x1: b.x + 1.8, y0: -3.1, y1: 2.5, z: -1.1 };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [curve, n]);

  const st = useRef<THREE.InstancedMesh>(null);
  const bt = useRef<THREE.InstancedMesh>(null);
  const pt = useRef<THREE.InstancedMesh>(null);
  const lg = useRef<THREE.InstancedMesh>(null);
  const lk = useRef<THREE.InstancedMesh>(null);
  const hl = useRef<THREE.InstancedMesh>(null);
  const fx = useRef<THREE.InstancedMesh>(null);
  const ring = useRef<THREE.Mesh>(null);
  const sweep = useRef<THREE.Mesh>(null);
  const cam = useRef<THREE.PerspectiveCamera>(null);
  const o = useMemo(() => new THREE.Object3D(), []);
  const col = useMemo(() => new THREE.Color(), []);
  const v = useMemo(() => new THREE.Vector3(), []);
  const look = useRef(new THREE.Vector3(0, -0.5, -1));
  const cur = useRef(new Float32Array(MAX_BATCH * 3));
  const placed = useRef(false);
  const since = useRef<{ focus: number; t: number; seen: Record<string, number | null> }>({
    focus: -2,
    t: 0,
    seen: {},
  });

  useFrame(({ clock }, dt) => {
    if (!active) return;
    const t = clock.elapsedTime;
    const S = since.current;
    if (S.focus !== focus) {
      S.focus = focus;
      S.t = t;
    }
    const tf = t - S.t; // seconds since this stage came into focus
    const doneFor = (id: string) => {
      const d = stationDone(model, id);
      if (!d) S.seen[id] = null;
      else if (S.seen[id] == null) S.seen[id] = t;
      return d ? t - S.seen[id]! : -1;
    };
    const id = model.stations[focus]?.id ?? "";
    const F = Math.max(0, focus);
    const P = at(F);
    const si = model.stations.findIndex((s) => s.id === "schedule");
    const planned = stationDone(model, "schedule") && si >= 0 && si <= F;
    // sorting into rows plays while Plan is in focus; afterwards the rows hold
    const sortK = id === "schedule" ? ease(tf / 1.6) : planned ? 1 : 0;
    const tTie = doneFor("tiebreak");
    const tGates = doneFor("gates");
    const sealed = stationDone(model, "seal");
    const k = Math.min(1, dt * 2.5);

    // camera: fitted to the scene's bounds for the panel's aspect; while a stage runs it eases closer and
    // follows that stage, otherwise it frames everything (track, wave rows, ledger tower). Never cuts.
    if (cam.current) {
      const C = cam.current;
      const half = Math.tan((C.fov * Math.PI) / 180 / 2);
      const W = bounds.x1 - bounds.x0,
        H = bounds.y1 - bounds.y0;
      const fit = Math.max(H / 2 / half, W / 2 / (half * Math.max(0.5, C.aspect))) * 1.04 + 1;
      const running = model.stations.some((x) => x.status === "running");
      const cx = (bounds.x0 + bounds.x1) / 2,
        cy = (bounds.y0 + bounds.y1) / 2;
      const tx = running ? cx + (P.x - cx) * 0.6 : cx;
      const d = running ? fit * 0.72 : fit;
      v.set(tx, cy + 0.8, bounds.z + d);
      C.position.lerp(v, Math.min(1, dt * 1.8));
      look.current.lerp(v.set(tx, cy, bounds.z), Math.min(1, dt * 1.8));
      C.lookAt(look.current);
    }

    // stations on the track, coloured by status; the focused one breathes; halos give the glow
    let h = 0;
    model.stations.forEach((s, i) => {
      const q = at(i);
      const on = i === focus;
      o.position.copy(q);
      o.quaternion.identity();
      o.scale.set(on ? 1.5 : 1.25, 0.08, on ? 1.5 : 1.25);
      o.updateMatrix();
      st.current?.setMatrixAt(i, o.matrix);
      if (s.status === "done") col.copy(c.ok);
      else if (s.status === "failed") col.copy(c.danger);
      else if (s.status === "running") col.copy(c.warn);
      else col.copy(c.text3).lerp(c.text, on ? 0.5 : 0.25);
      st.current?.setColorAt(i, col);
      if (s.status !== "idle" && hl.current && cam.current) {
        const pulse = on ? 1 + 0.25 * Math.sin(t * 3) : 0.7;
        o.position.set(q.x, q.y + 0.05, q.z);
        o.quaternion.copy(cam.current.quaternion);
        o.scale.setScalar(2.2 * pulse);
        o.updateMatrix();
        hl.current.setMatrixAt(h, o.matrix);
        hl.current.setColorAt(h, col.multiplyScalar(on ? 0.55 : 0.25));
        h++;
      }
    });
    if (hl.current) hl.current.count = h;

    // batches: a cluster travelling along the track behind the focus, then wave rows above it
    const rows = Math.max(1, model.waves);
    const rowH = Math.min(0.5, 3.8 / rows);
    const tie = model.tiePair;
    let p = 0;
    const B = Math.min(MAX_BATCH, model.batches.length);
    const c3 = cur.current;
    for (let i = 0; i < B; i++) {
      const b = model.batches[i]!;
      const back = at(Math.max(0, F - 0.35 - Math.floor(i / 4) * 0.06));
      const cx = back.x + ((i % 4) - 1.5) * BOX * 1.5;
      const cy = back.y + 0.45 + Math.floor(i / 4) * 0.02;
      const cz = back.z + 0.3;
      let rx = P.x + (b.slot - 1) * BOX * 1.5;
      let ry = 1.9 - Math.max(0, b.wave) * rowH;
      let rz = P.z;
      // tie-break: a real tied pair starts in the other order and swaps (an arc) into its final order
      if (tie && id === "tiebreak" && (i === tie[0] || i === tie[1])) {
        const other = model.batches[i === tie[0] ? tie[1] : tie[0]]!;
        const u = ease((tf - 0.6) / 1.2);
        const from = P.x + (other.slot - 1) * BOX * 1.5;
        rx = from + (rx - from) * u;
        ry += Math.sin(u * Math.PI) * 0.45 * (i === tie[0] ? 1 : -1);
        rz += Math.sin(u * Math.PI) * 0.3;
      }
      const sk = b.wave >= 0 ? sortK : 0;
      const x = cx + (rx - cx) * sk;
      const y = cy + (ry - cy) * sk;
      const z = cz + (rz - cz) * sk;
      if (!placed.current) {
        c3[i * 3] = x;
        c3[i * 3 + 1] = y;
        c3[i * 3 + 2] = z;
      }
      c3[i * 3] = c3[i * 3]! + (x - c3[i * 3]!) * k;
      c3[i * 3 + 1] = c3[i * 3 + 1]! + (y - c3[i * 3 + 1]!) * k;
      c3[i * 3 + 2] = c3[i * 3 + 2]! + (z - c3[i * 3 + 2]!) * k;
      const X = c3[i * 3]!,
        Y = c3[i * 3 + 1]!,
        Z = c3[i * 3 + 2]!;
      o.position.set(X, Y, Z);
      o.rotation.set(0.45, 0.6 + t * 0.15, 0);
      o.scale.setScalar(BOX);
      o.updateMatrix();
      bt.current?.setMatrixAt(i, o.matrix);
      col.copy(c.danger).lerp(c.bg, 0.45 * (1 - b.risk));
      // Detect: the sweep plane lights each block as it passes
      if (id === "detect" && Math.abs(X - (P.x - 1.6 + ((tf * 1.2) % 3.2))) < 0.25)
        col.lerp(c.text, 0.6);
      if (id === "gates" && stationDone(model, "gates")) col.lerp(b.applied ? c.ok : c.text3, 0.35);
      if (focus < 0) col.lerp(c.bg, 0.5);
      bt.current?.setColorAt(i, col);
      // patch markers in tie-break order: dim once chosen, bright where the lab gates passed
      for (let j = 0; j < b.patches.length && p < MAX_BATCH * 2; j++) {
        const step = i * 0.08 + j * 0.04;
        const applied = b.applied && tGates > step;
        o.position.set(X + (j === 0 ? -1 : 1) * BOX * 0.55, Y + BOX * 0.8, Z + 0.05);
        o.rotation.set(0, 0, Math.PI / 4);
        o.scale.setScalar(applied ? BOX * 0.55 : tTie > step ? BOX * 0.38 : 0);
        o.updateMatrix();
        pt.current?.setMatrixAt(p, o.matrix);
        col.copy(b.patches[j] === "kem" ? c.kem : c.sig);
        if (!applied) col.lerp(c.bg, 0.55);
        pt.current?.setColorAt(p, col);
        p++;
      }
    }
    placed.current = true;
    if (bt.current) bt.current.count = B;
    if (pt.current) pt.current.count = p;

    // ledger column beside Seal: Proof Chain grows the hash links, Seal locks the blocks in
    const base = at(
      Math.max(
        0,
        model.stations.findIndex((s) => s.id === "seal"),
      ),
    );
    const L = Math.min(MAX_LEDGER, model.ledger.entries);
    const lockU = id === "seal" ? tf : sealed ? 99 : -1;
    const linkU = id === "ledger" ? tf : stationDone(model, "ledger") ? 99 : -1;
    let li = 0;
    for (let i = 0; i < L; i++) {
      const up = lockU >= 0 ? ease((lockU - i * 0.08) * 3) : 1;
      const y = base.y + 0.35 + i * 0.22;
      o.position.set(base.x + 0.9, y + (1 - up) * 0.8, base.z);
      o.rotation.set(0, 0.5 + (1 - up) * 1.2, 0);
      o.scale.set(0.34, 0.14, 0.34).multiplyScalar(0.3 + 0.7 * up);
      o.updateMatrix();
      lg.current?.setMatrixAt(i, o.matrix);
      if (sealed && up > 0.99) col.copy(model.ledger.verified ? c.ok : c.sig);
      else col.copy(c.text3);
      lg.current?.setColorAt(i, col);
      if (i > 0 && lk.current) {
        // the hash link h_i -> h_(i-1): a short bar growing between consecutive entries
        const g = linkU >= 0 ? ease((linkU - i * 0.1) * 2.5) : 0;
        o.position.set(base.x + 1.1, y - 0.11, base.z);
        o.rotation.set(0, 0, 0);
        o.scale.set(0.03, 0.18 * g, 0.03);
        o.updateMatrix();
        lk.current.setMatrixAt(li, o.matrix);
        lk.current.setColorAt(li, c.sig);
        li++;
      }
    }
    if (lg.current) lg.current.count = L;
    if (lk.current) lk.current.count = li;

    // per-stage effects at the focused station
    if (sweep.current) {
      sweep.current.visible = id === "detect";
      sweep.current.position.set(P.x - 1.6 + ((tf * 1.2) % 3.2), P.y + 0.9, P.z + 0.3);
    }
    if (ring.current) {
      ring.current.visible = id === "capture" || id === "gates";
      const u = (tf % 1.4) / 1.4;
      ring.current.position.set(P.x, P.y + 0.08, P.z);
      ring.current.scale.setScalar(0.4 + u * 2.4);
      const m = ring.current.material as THREE.MeshBasicMaterial;
      m.opacity = (1 - u) * 0.8;
      m.color.copy(
        id === "capture" ? c.kem : model.stations[focus]?.status === "failed" ? c.danger : c.ok,
      );
    }
    if (fx.current) {
      // QAOA: four qubit wires with gate blocks shimmering across them
      for (let g = 0; g < GATES; g++) {
        const shimmer = 0.5 + 0.5 * Math.sin(t * 5 + g * 1.7);
        o.position.set(P.x - 1.2 + (g / GATES) * 2.4, P.y + 0.7 + (g % QUBITS) * 0.32, P.z + 0.6);
        o.rotation.set(0, 0, 0);
        o.scale.setScalar(id === "qaoa" ? 0.12 + 0.06 * shimmer : 0);
        o.updateMatrix();
        fx.current.setMatrixAt(g, o.matrix);
        fx.current.setColorAt(g, col.copy(c.sig).lerp(c.kem, shimmer));
      }
    }

    for (const m of [
      st.current,
      bt.current,
      pt.current,
      lg.current,
      lk.current,
      hl.current,
      fx.current,
    ]) {
      if (!m) continue;
      m.instanceMatrix.needsUpdate = true;
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
    }
  });

  const hover = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    onHover?.(e.instanceId ?? null);
  };

  return (
    <>
      <PerspectiveCamera ref={cam} makeDefault position={[0, 1.4, 11.5]} fov={42} />
      <fog attach="fog" args={[c.bg.getStyle(), 22, 48]} />
      <ambientLight intensity={1.2} />
      <hemisphereLight args={[c.text.getStyle(), c.bg.getStyle(), 0.9]} />
      <directionalLight position={[3, 8, 6]} intensity={2} />
      <directionalLight position={[-6, 3, 4]} intensity={0.8} />
      {labels.map((l, i) => {
        const q = at(i);
        return (
          <sprite key={l.id} position={[q.x, q.y - 0.75, q.z + 0.6]} scale={[2, 0.375, 1]}>
            <spriteMaterial
              map={l.tex}
              transparent
              depthWrite={false}
              fog={false}
              toneMapped={false}
            />
          </sprite>
        );
      })}
      <mesh geometry={track}>
        <meshBasicMaterial color={c.text3} transparent opacity={0.35} />
      </mesh>
      <instancedMesh
        frustumCulled={false}
        ref={st}
        args={[undefined, undefined, Math.max(1, n)]}
        onPointerMove={hover}
        onPointerOut={() => onHover?.(null)}
      >
        <cylinderGeometry args={[0.55, 0.55, 1, 32]} />
        <meshBasicMaterial toneMapped={false} />
      </instancedMesh>
      <instancedMesh frustumCulled={false} ref={hl} args={[undefined, undefined, Math.max(1, n)]}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial
          map={halo}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </instancedMesh>
      <instancedMesh frustumCulled={false} ref={bt} args={[undefined, undefined, MAX_BATCH]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshLambertMaterial emissive={c.danger} emissiveIntensity={0.25} />
      </instancedMesh>
      <instancedMesh frustumCulled={false} ref={pt} args={[undefined, undefined, MAX_BATCH * 2]}>
        <octahedronGeometry args={[1, 0]} />
        <meshBasicMaterial toneMapped={false} />
      </instancedMesh>
      <instancedMesh frustumCulled={false} ref={lg} args={[undefined, undefined, MAX_LEDGER]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial toneMapped={false} />
      </instancedMesh>
      <instancedMesh frustumCulled={false} ref={lk} args={[undefined, undefined, MAX_LEDGER]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial toneMapped={false} />
      </instancedMesh>
      <instancedMesh frustumCulled={false} ref={fx} args={[undefined, undefined, GATES]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial toneMapped={false} />
      </instancedMesh>
      <mesh ref={sweep} frustumCulled={false} visible={false}>
        <planeGeometry args={[0.06, 2.2]} />
        <meshBasicMaterial
          color={c.text}
          transparent
          opacity={0.5}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
      <mesh ref={ring} frustumCulled={false} rotation={[-Math.PI / 2, 0, 0]} visible={false}>
        <ringGeometry args={[0.48, 0.52, 48]} />
        <meshBasicMaterial transparent depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
    </>
  );
}
