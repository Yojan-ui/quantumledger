// Liquidity surface on live L2 data.
//
//   x = price, ±48 ticks around each snapshot's mid (bids left, asks right)
//   y = resting quantity at that price level, linear, in contracts
//   z = time: one row per 10 Hz L2 snapshot, newest at the front, 9.6 s deep
//
// Geometry is a single Float32Array position buffer (COLS × ROWS vertices)
// shared by a wire lattice (row + column line segments, no diagonals) and a
// faint fill. Each L2_DEPTH message shifts the quantity history one row and
// rewrites y and vertex colours in place; nothing re-renders through React.
// Executions from the trade feed are plotted as nodes at their (price, time)
// cell, at that cell's quantity.

import { CameraControls, Html } from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, type MutableRefObject } from "react";
import * as THREE from "three";
import { px as fmtPx } from "./fmt";
import { feed } from "./state/feed";
import type { L2Depth } from "./types";

const COLS = 96;
const ROWS = 96;
const SNAP_S = 0.1;
const SIZE_X = 26;
const SIZE_Z = 18;
const Z_FRONT = 2;
const HEIGHT = 5;               // world units at the top of the volume axis
const SCALE = 10_000;           // fixed-point quantity scale
const MAX_NODES = 384;
const PRICE_TICKS = [-40, -30, -20, -10, 0, 10, 20, 30, 40];
const TIME_TICKS = [0, 2, 4, 6, 8];
const N = COLS * ROWS;
const DZ = SIZE_Z / (ROWS - 1);

const BID = new THREE.Color("#059669");
const ASK = new THREE.Color("#DC2626");
const FLOOR = new THREE.Color("#1a1f26");

const colX = (c: number) => ((c + 0.5) / COLS - 0.5) * SIZE_X;
const rowZ = (r: number) => Z_FRONT - r * DZ;

/** 1/2/5 × 10^k ceiling, so the volume axis has round labels. */
function niceCeil(v: number): number {
  if (v <= 0) return 1;
  const p = 10 ** Math.floor(Math.log10(v));
  for (const m of [1, 2, 5, 10]) if (m * p >= v) return m * p;
  return 10 * p;
}

interface Node { col: number; snap: number; buy: boolean }

function Surface() {
  // live quantity history in contracts, row 0 = newest snapshot
  const qtyHist = useMemo(() => new Float32Array(N), []);
  const positions = useMemo(() => {
    const a = new Float32Array(N * 3);
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      const i = (r * COLS + c) * 3;
      a[i] = colX(c); a[i + 1] = 0; a[i + 2] = rowZ(r);
    }
    return a;
  }, []);
  const colors = useMemo(() => new Float32Array(N * 3), []);

  const { wireGeom, fillGeom } = useMemo(() => {
    const pos = new THREE.BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage);
    const col = new THREE.BufferAttribute(colors, 3).setUsage(THREE.DynamicDrawUsage);
    const lines: number[] = [];
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS - 1; c++) lines.push(r * COLS + c, r * COLS + c + 1);
    for (let c = 0; c < COLS; c++) for (let r = 0; r < ROWS - 1; r++) lines.push(r * COLS + c, (r + 1) * COLS + c);
    const tris: number[] = [];
    for (let r = 0; r < ROWS - 1; r++) for (let c = 0; c < COLS - 1; c++) {
      const a = r * COLS + c, b = a + 1, d = a + COLS, e = d + 1;
      tris.push(a, d, b, b, d, e);
    }
    const w = new THREE.BufferGeometry();
    w.setAttribute("position", pos); w.setAttribute("color", col); w.setIndex(lines);
    const f = new THREE.BufferGeometry();
    f.setAttribute("position", pos); f.setAttribute("color", col); f.setIndex(tris);
    return { wireGeom: w, fillGeom: f };
  }, [positions, colors]);

  const group = useRef<THREE.Group>(null!);
  const nodesMesh = useRef<THREE.InstancedMesh>(null!);
  const nodeCol = useMemo(() => new Float32Array(MAX_NODES * 3), []);
  const nodes = useRef<Node[]>([]);
  const st = useRef({ seq: -1, snapT: 0, snaps: 0, yMax: 0, below: 0 });
  const priceRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const volRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const m4 = useMemo(() => new THREE.Matrix4(), []);
  const tmp = useMemo(() => new THREE.Color(), []);

  const ingest = (l2: L2Depth) => {
    qtyHist.copyWithin(COLS, 0, N - COLS);
    qtyHist.fill(0, 0, COLS);
    if (l2.mid == null) return;
    const half = COLS / 2 - 0.5;
    for (const levels of [l2.bids, l2.asks]) for (const lv of levels) {
      const c = Math.round((lv.px - l2.mid) / l2.tick + half);
      if (c >= 0 && c < COLS) qtyHist[c] = lv.qty / SCALE;
    }
  };

  /** y = qty × (HEIGHT / axis max); colour = side colour scaled by relative quantity. */
  const rebuild = () => {
    const s = st.current;
    let max = 0;
    for (let i = 0; i < N; i++) if (qtyHist[i] > max) max = qtyHist[i];
    // axis max: grow immediately, shrink only after 3 s (30 snapshots) below the current scale
    const target = niceCeil(max);
    if (s.yMax === 0 || target > s.yMax) { s.yMax = target; s.below = 0; }
    else if (target < s.yMax && ++s.below >= 30) { s.yMax = target; s.below = 0; }
    else if (target === s.yMax) s.below = 0;
    const k = HEIGHT / s.yMax;
    for (let r = 0; r < ROWS; r++) {
      const fade = 1 - r / ROWS;
      for (let c = 0; c < COLS; c++) {
        const i = r * COLS + c;
        const q = qtyHist[i];
        positions[i * 3 + 1] = q * k;
        const rel = Math.min(1, q / s.yMax);
        tmp.copy(FLOOR).lerp(c < COLS / 2 ? BID : ASK, q > 0 ? 0.35 + 0.65 * Math.sqrt(rel) : 0).multiplyScalar(0.45 + 0.55 * fade);
        colors[i * 3] = tmp.r; colors[i * 3 + 1] = tmp.g; colors[i * 3 + 2] = tmp.b;
      }
    }
    (wireGeom.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    (wireGeom.attributes.color as THREE.BufferAttribute).needsUpdate = true;
  };

  useEffect(() => feed.onTrades((trades) => {
    const l2 = feed.state.l2;
    if (!l2?.mid) return;
    const snap = st.current.snaps;
    for (const t of trades) {
      nodes.current.push({ col: Math.round((t.px - l2.mid) / l2.tick + COLS / 2 - 0.5), snap, buy: t.aggr === "B" });
    }
    if (nodes.current.length > MAX_NODES) nodes.current.splice(0, nodes.current.length - MAX_NODES);
  }), []);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const s = st.current;
    const l2 = feed.state.l2;
    if (l2 && l2.seq !== s.seq) {
      s.seq = l2.seq;
      ingest(l2);
      s.snaps++;
      s.snapT = t;
      rebuild();
    }

    // between snapshots the lattice drifts back by up to one row, then snaps forward with the next shift
    const phase = Math.min(1, (t - s.snapT) / SNAP_S);
    group.current.position.z = -phase * DZ;

    // nodes: the trade printed after snapshot `snap`, so it lives in the next row written
    const list = nodes.current;
    while (list.length && s.snaps - list[0].snap > ROWS) list.shift();
    const mesh = nodesMesh.current;
    const k = s.yMax ? HEIGHT / s.yMax : 0;
    let n = 0;
    for (const nd of list) {
      if (nd.col < 0 || nd.col >= COLS) continue;
      const r = Math.max(0, s.snaps - nd.snap - 1);
      if (r >= ROWS) continue;
      const y = qtyHist[r * COLS + nd.col] * k;
      m4.makeScale(0.11, 0.11, 0.11).setPosition(colX(nd.col), y + 0.07, rowZ(r));
      mesh.setMatrixAt(n, m4);
      const fade = 1 - r / ROWS;
      const c = nd.buy ? BID : ASK;
      nodeCol[n * 3] = 0.25 + (c.r + 0.35) * fade;
      nodeCol[n * 3 + 1] = 0.25 + (c.g + 0.35) * fade;
      nodeCol[n * 3 + 2] = 0.25 + (c.b + 0.35) * fade;
      n++;
    }
    mesh.count = n;
    mesh.instanceMatrix.needsUpdate = true;
    mesh.instanceColor!.needsUpdate = true;

    if (l2?.mid != null) {
      PRICE_TICKS.forEach((d, i) => { const el = priceRefs.current[i]; if (el) el.textContent = fmtPx(l2.mid! + d * l2.tick, 2); });
    }
    [0.25, 0.5, 0.75, 1].forEach((f, i) => {
      const el = volRefs.current[i];
      if (el) el.textContent = s.yMax ? Math.round(f * s.yMax).toLocaleString("en-US") : "—";
    });
  });

  return (
    <>
      <group ref={group}>
        <lineSegments geometry={wireGeom} frustumCulled={false}>
          <lineBasicMaterial vertexColors transparent opacity={0.9} depthWrite={false} />
        </lineSegments>
        <mesh geometry={fillGeom} frustumCulled={false}>
          <meshBasicMaterial vertexColors transparent opacity={0.12} side={THREE.DoubleSide} depthWrite={false} />
        </mesh>
        <instancedMesh ref={nodesMesh} args={[undefined, undefined, MAX_NODES]} frustumCulled={false}>
          <boxGeometry args={[1, 1, 1]} />
          <instancedBufferAttribute attach="instanceColor" args={[nodeCol, 3]} />
          <meshBasicMaterial toneMapped={false} />
        </instancedMesh>
      </group>
      <Axes priceRefs={priceRefs} volRefs={volRefs} />
    </>
  );
}

/** Low-opacity Cartesian frame: floor grid (price × time), back wall (price × volume), side wall (time × volume). */
function Axes({ priceRefs, volRefs }: {
  priceRefs: MutableRefObject<(HTMLSpanElement | null)[]>; volRefs: MutableRefObject<(HTMLSpanElement | null)[]>;
}) {
  const geom = useMemo(() => {
    const v: number[] = [];
    const xL = -SIZE_X / 2, xR = SIZE_X / 2, zF = Z_FRONT, zB = Z_FRONT - SIZE_Z;
    const seg = (a: number[], b: number[]) => v.push(...a, ...b);
    for (const d of PRICE_TICKS) { const x = colX(COLS / 2 - 0.5 + d); seg([x, 0, zF], [x, 0, zB]); seg([x, 0, zB], [x, HEIGHT, zB]); }
    for (const s of [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]) { const z = rowZ(s / SNAP_S); if (z < zB) continue; seg([xL, 0, z], [xR, 0, z]); seg([xL, 0, z], [xL, HEIGHT, z]); }
    for (const f of [0.25, 0.5, 0.75, 1]) { const y = f * HEIGHT; seg([xL, y, zB], [xR, y, zB]); seg([xL, y, zF], [xL, y, zB]); }
    seg([xL, 0, zF], [xR, 0, zF]); seg([xL, 0, zF], [xL, HEIGHT, zF]);
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(v), 3));
    return g;
  }, []);
  const xL = -SIZE_X / 2 - 0.4;
  return (
    <>
      <lineSegments geometry={geom}>
        <lineBasicMaterial color="#2a313b" transparent opacity={0.55} />
      </lineSegments>
      {PRICE_TICKS.map((d, i) => (
        <Html key={d} position={[colX(COLS / 2 - 0.5 + d), -0.05, Z_FRONT + 0.8]} center zIndexRange={[4, 0]} className={`ax ${d === 0 ? "mid" : ""}`}>
          <span ref={(el) => { priceRefs.current[i] = el; }}>—</span>
        </Html>
      ))}
      {[0.25, 0.5, 0.75, 1].map((f, i) => (
        <Html key={f} position={[xL, f * HEIGHT, Z_FRONT - SIZE_Z]} center zIndexRange={[4, 0]} className="ax vol" style={{ transform: "translateX(-60%)" }}>
          <span ref={(el) => { volRefs.current[i] = el; }}>—</span>
        </Html>
      ))}
      {TIME_TICKS.map((s) => (
        <Html key={s} position={[xL - 0.4, 0, rowZ(s / SNAP_S)]} center zIndexRange={[4, 0]} className="ax">−{s}s</Html>
      ))}
      <Html position={[0, -0.05, Z_FRONT + 1.7]} center zIndexRange={[4, 0]} className="ax lbl">PX</Html>
      <Html position={[xL - 1.6, HEIGHT + 0.6, Z_FRONT - SIZE_Z]} center zIndexRange={[4, 0]} className="ax lbl">QTY</Html>
      <Html position={[xL - 1.8, 0, Z_FRONT - SIZE_Z * 0.5]} center zIndexRange={[4, 0]} className="ax lbl">T</Html>
    </>
  );
}

function CameraRig() {
  const cc = useRef<CameraControls>(null);
  useEffect(() => { cc.current?.setLookAt(-6, 13, 20, 0, 1.6, -6.5, false); }, []);
  return <CameraControls ref={cc} smoothTime={0.25} minDistance={8} maxDistance={60} maxPolarAngle={Math.PI * 0.48} />;
}

export function LiquiditySurface() {
  return (
    <Canvas dpr={[1, 2]} camera={{ position: [-6, 13, 20], fov: 40, near: 0.1, far: 300 }} gl={{ antialias: true }}
      onCreated={({ gl }) => gl.setClearColor("#08090C")}>
      <Surface />
      <CameraRig />
    </Canvas>
  );
}
