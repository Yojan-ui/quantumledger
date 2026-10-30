"use client";

/**
 * The Q-Shield pipeline in 3D: Atlas's stages as stations in a row, one small block per batch (system)
 * glowing by its risk weight, moving to the stage the run has reached. Once the plan exists the blocks line up
 * in wave rows (planned week), in tie-break order; once the lab gates pass for a wave, its blocks gain their
 * ML-KEM / ML-DSA markers one by one, in that order; at Seal the ledger column lights up. Every change follows
 * the model (lib/client/atlas-flowviz: real SSE events and Atlas JSON); the frames only ease between states.
 * Few objects, a fixed camera, no drift. Rendered through LazyView (the site's single canvas).
 */
import { PerspectiveCamera } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { palette } from "@/components/world/palette";
import { frontier, stationDone, type FlowModel } from "@/lib/client/atlas-flowviz";

const SP = 2.0; // station spacing
const MAX_BATCH = 160;
const MAX_LEDGER = 16;
const BOX = 0.3;

export default function PipelineFlow({ model, active }: { model: FlowModel; active: boolean }) {
  const c = useMemo(palette, []);
  const st = useRef<THREE.InstancedMesh>(null);
  const bt = useRef<THREE.InstancedMesh>(null);
  const pt = useRef<THREE.InstancedMesh>(null);
  const lg = useRef<THREE.InstancedMesh>(null);
  const o = useMemo(() => new THREE.Object3D(), []);
  const col = useMemo(() => new THREE.Color(), []);
  const cur = useRef(new Float32Array(MAX_BATCH * 3));
  const placed = useRef(false);
  const gatesAt = useRef<number | null>(null);

  const n = model.stations.length;
  const xOf = (i: number) => (i - (n - 1) / 2) * SP;
  const iOf = (id: string) => model.stations.findIndex((s) => s.id === id);

  useFrame(({ clock }, dt) => {
    if (!active) return;
    const t = clock.elapsedTime;
    const f = Math.max(0, frontier(model));
    const planned = stationDone(model, "schedule");
    const gatesDone = stationDone(model, "gates");
    if (gatesDone && gatesAt.current === null) gatesAt.current = t;
    if (!gatesDone) gatesAt.current = null;
    const sealed = stationDone(model, "seal");
    const k = Math.min(1, dt * 4); // ease towards the target (~250 ms)

    // stations: hairline plates coloured by status (running breathes softly)
    model.stations.forEach((s, i) => {
      o.position.set(xOf(i), -2.7, 0);
      o.rotation.set(0, 0, 0);
      o.scale.set(1.3, 0.06, 1.3);
      o.updateMatrix();
      st.current?.setMatrixAt(i, o.matrix);
      if (s.status === "done") col.copy(c.ok);
      else if (s.status === "failed") col.copy(c.danger);
      else if (s.status === "running") col.copy(c.warn).lerp(c.bg, 0.3 + 0.3 * Math.sin(t * 3));
      else col.copy(c.text3).lerp(c.bg, 0.4);
      st.current?.setColorAt(i, col);
    });

    // batches: a cluster at the reached station before the plan, then wave rows in tie-break order
    const rows = Math.max(1, model.waves);
    const rowH = Math.min(0.55, 4.8 / rows);
    let p = 0;
    model.batches.slice(0, MAX_BATCH).forEach((b, i) => {
      let x: number, y: number;
      if (planned && b.wave >= 0) {
        x = xOf(f) + (b.slot - 1) * (BOX * 1.6);
        y = 2.3 - b.wave * rowH;
      } else {
        x = xOf(f) + ((i % 4) - 1.5) * (BOX * 1.6);
        y = 2.3 - Math.floor(i / 4) * (BOX * 1.6);
      }
      const c3 = cur.current;
      if (!placed.current) {
        c3[i * 3] = x;
        c3[i * 3 + 1] = y;
      }
      c3[i * 3] = c3[i * 3]! + (x - c3[i * 3]!) * k;
      c3[i * 3 + 1] = c3[i * 3 + 1]! + (y - c3[i * 3 + 1]!) * k;
      o.position.set(c3[i * 3]!, c3[i * 3 + 1]!, 0);
      o.rotation.set(0.45, 0.6, 0);
      o.scale.setScalar(BOX);
      o.updateMatrix();
      bt.current?.setMatrixAt(i, o.matrix);
      // glow by risk: grey (low) to danger (high); dimmer before the run reaches Detect
      // risk -> brightness of the danger colour: high risk glows, low risk recedes towards the background
      col.copy(c.danger).lerp(c.bg, 0.7 * (1 - b.risk));
      if (frontier(model) < 0) col.lerp(c.bg, 0.5);
      bt.current?.setColorAt(i, col);
      // patch markers: in tie-break order, 90 ms apart, once the lab gates passed for this batch's wave
      b.patches.forEach((kind, j) => {
        if (p >= MAX_BATCH * 2) return;
        const due =
          gatesAt.current !== null && b.applied && t - gatesAt.current > i * 0.09 + j * 0.05;
        o.position.set(
          c3[i * 3]! + (j === 0 ? -1 : 1) * BOX * 0.55,
          c3[i * 3 + 1]! + BOX * 0.75,
          0.05,
        );
        o.rotation.set(0, 0, Math.PI / 4);
        o.scale.setScalar(due ? BOX * 0.5 : 0);
        o.updateMatrix();
        pt.current?.setMatrixAt(p, o.matrix);
        pt.current?.setColorAt(p, kind === "kem" ? c.kem : c.sig);
        p++;
      });
    });
    placed.current = true;
    if (bt.current) bt.current.count = Math.min(MAX_BATCH, model.batches.length);
    if (pt.current) pt.current.count = p;

    // ledger: a column of blocks at Seal, lit once the chain is sealed
    const si = iOf("seal");
    const L = Math.min(MAX_LEDGER, model.ledger.entries);
    for (let i = 0; i < L; i++) {
      o.position.set(xOf(si >= 0 ? si : n - 1) + 0.75, -2.35 + i * 0.22, 0);
      o.rotation.set(0, 0.5, 0);
      o.scale.set(0.34, 0.16, 0.34);
      o.updateMatrix();
      lg.current?.setMatrixAt(i, o.matrix);
      lg.current?.setColorAt(
        i,
        sealed ? (model.ledger.verified ? c.ok : c.sig) : col.copy(c.text3).lerp(c.bg, 0.5),
      );
    }
    if (lg.current) lg.current.count = L;

    for (const m of [st.current, bt.current, pt.current, lg.current]) {
      if (!m) continue;
      m.instanceMatrix.needsUpdate = true;
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
    }
  });

  return (
    <>
      <PerspectiveCamera makeDefault position={[0, 0, 10.5]} fov={42} />
      <instancedMesh ref={st} args={[undefined, undefined, Math.max(1, n)]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial toneMapped={false} />
      </instancedMesh>
      <instancedMesh ref={bt} args={[undefined, undefined, MAX_BATCH]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial toneMapped={false} />
      </instancedMesh>
      <instancedMesh ref={pt} args={[undefined, undefined, MAX_BATCH * 2]}>
        <octahedronGeometry args={[1, 0]} />
        <meshBasicMaterial toneMapped={false} />
      </instancedMesh>
      <instancedMesh ref={lg} args={[undefined, undefined, MAX_LEDGER]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial wireframe toneMapped={false} />
      </instancedMesh>
    </>
  );
}
