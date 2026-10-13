"use client";

/**
 * WebGL draws `THREE.Line` 1 px wide whatever `linewidth` says, so structure lines look faint on a
 * projector. <Thicken> fixes that for a whole scene without touching its code: every Line /
 * LineSegments with a LineBasicMaterial inside it is drawn instead as a screen-space thick line
 * (three's LineSegments2: 1.5–3 px, scaled by distance) plus a soft additive glow pass in the same
 * colour. The original object stays in the graph (its transform, children, colour, opacity,
 * visibility, draw range and vertex updates are mirrored every frame), it just no longer renders.
 * Lines drawn with custom shaders (the globe's arcs) are left alone; they handle width themselves.
 */
import { useFrame, useThree } from "@react-three/fiber";
import { useLayoutEffect, useRef, type ReactNode } from "react";
import * as THREE from "three";
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial.js";
import { LineSegments2 } from "three/examples/jsm/lines/LineSegments2.js";
import { LineSegmentsGeometry } from "three/examples/jsm/lines/LineSegmentsGeometry.js";
import { gfx } from "@/lib/client/gfx";

interface Pair {
  src: THREE.Line;
  core: LineSegments2;
  glow: LineSegments2;
  posVersion: number;
  colVersion: number;
  start: number;
  count: number;
}

const tmp = new THREE.Vector3();

/** The source's vertices (or colours) within its draw range, as segment pairs. */
function segments(src: THREE.Line, attr: THREE.BufferAttribute, start: number, count: number) {
  const a = attr.array as ArrayLike<number>;
  const n = attr.count;
  const s = Math.max(0, start);
  const e = Math.min(n, count === Infinity ? n : s + count);
  const out: number[] = [];
  const isSegments = (src as THREE.LineSegments).isLineSegments;
  if (isSegments) {
    for (let i = s; i + 1 < e; i += 2)
      out.push(
        a[i * 3]!,
        a[i * 3 + 1]!,
        a[i * 3 + 2]!,
        a[i * 3 + 3]!,
        a[i * 3 + 4]!,
        a[i * 3 + 5]!,
      );
  } else {
    // A strip (or loop): consecutive vertices become segments.
    for (let i = s; i + 1 < e; i++)
      out.push(
        a[i * 3]!,
        a[i * 3 + 1]!,
        a[i * 3 + 2]!,
        a[i * 3 + 3]!,
        a[i * 3 + 4]!,
        a[i * 3 + 5]!,
      );
    if ((src as THREE.LineLoop).isLineLoop && e - s > 2)
      out.push(
        a[(e - 1) * 3]!,
        a[(e - 1) * 3 + 1]!,
        a[(e - 1) * 3 + 2]!,
        a[s * 3]!,
        a[s * 3 + 1]!,
        a[s * 3 + 2]!,
      );
  }
  return out;
}

function sync(p: Pair) {
  const g = p.src.geometry as THREE.BufferGeometry;
  const pos = g.attributes.position as THREE.BufferAttribute | undefined;
  if (!pos) return;
  const col = g.attributes.color as THREE.BufferAttribute | undefined;
  const { start, count } = g.drawRange;
  const moved = pos.version !== p.posVersion || start !== p.start || count !== p.count;
  const recoloured = !!col && col.version !== p.colVersion;
  if (!moved && !recoloured) return;
  p.posVersion = pos.version;
  p.colVersion = col?.version ?? 0;
  p.start = start;
  p.count = count;
  const geo = p.core.geometry as LineSegmentsGeometry;
  const v = segments(p.src, pos, start, count);
  if (moved) geo.setPositions(v.length ? v : [0, 0, 0, 0, 0, 0]);
  if (col) {
    const c = segments(p.src, col, start, count);
    if (c.length) geo.setColors(c);
  }
  // The glow shares the geometry.
  p.glow.geometry = geo;
}

function makePair(src: THREE.Line): Pair {
  const m = src.material as THREE.LineBasicMaterial;
  const vertexColors = !!m.vertexColors;
  const geo = new LineSegmentsGeometry();
  const core = new LineSegments2(
    geo,
    new LineMaterial({
      // With vertex colours the base colour multiplies them, so it's white.
      color: vertexColors ? 0xffffff : m.color.getHex(),
      linewidth: 2,
      transparent: true,
      depthWrite: false,
      vertexColors,
      worldUnits: false,
      toneMapped: false,
    }),
  );
  const glow = new LineSegments2(
    geo,
    new LineMaterial({
      color: vertexColors ? 0xffffff : m.color.getHex(),
      linewidth: 7,
      transparent: true,
      opacity: 0.12,
      depthWrite: false,
      vertexColors,
      worldUnits: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    }),
  );
  core.renderOrder = src.renderOrder;
  glow.renderOrder = src.renderOrder - 0.5;
  core.frustumCulled = glow.frustumCulled = false;
  core.raycast = glow.raycast = () => {};
  src.add(glow, core);
  // Keep the thin original in the graph (transforms, children) but stop it rendering itself:
  // the renderer only draws objects flagged isMesh / isLine / isPoints.
  (src as unknown as { isLine: boolean }).isLine = false;
  const pair: Pair = { src, core, glow, posVersion: -1, colVersion: -1, start: -1, count: -1 };
  return pair;
}

export function Thicken({
  children,
  width = 2,
  glow = true,
}: {
  children: ReactNode;
  /** Base width in CSS px at a distance of 4 units (1.5–3 px after distance scaling). */
  width?: number;
  glow?: boolean;
}) {
  // The nearest scene (a drei View's own portal scene, or the main canvas scene): children render
  // unwrapped, so `attach="fog"` and the like still reach the scene.
  const scene = useThree((st) => st.scene);
  const pairs = useRef<Pair[]>([]);
  const size = useThree((s) => s.size);
  const dpr = useThree((s) => s.viewport.dpr);

  // Find new lines each frame cheaply: only walk the tree when its object count changes.
  const seen = useRef(-1);
  const scan = () => {
    const r = scene;
    let n = 0;
    r.traverse(() => void n++);
    if (n === seen.current) return;
    const have = new Set(pairs.current.map((p) => p.src));
    r.traverse((o) => {
      const line = o as THREE.Line;
      if (have.has(line) || o instanceof LineSegments2) return;
      if (!line.isLine) return; // also skips originals already thickened (flag cleared)
      if (!(line.material instanceof THREE.LineBasicMaterial)) return;
      const p = makePair(line);
      pairs.current.push(p);
    });
    // The pair children added above change the count; record the final one.
    n = 0;
    r.traverse(() => void n++);
    seen.current = n;
  };

  useLayoutEffect(() => {
    scan();
    const list = pairs.current;
    return () => {
      for (const p of list) {
        p.src.remove(p.core, p.glow);
        (p.src as unknown as { isLine: boolean }).isLine = true;
        p.core.geometry.dispose();
        (p.core.material as LineMaterial).dispose();
        (p.glow.material as LineMaterial).dispose();
      }
      list.length = 0;
      seen.current = -1;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useFrame(({ camera }) => {
    scan();
    const w = size.width * dpr;
    const h = size.height * dpr;
    const showGlow = glow && gfx.quality < 3;
    for (const p of pairs.current) {
      const m = p.src.material as THREE.LineBasicMaterial;
      sync(p);
      const core = p.core.material as LineMaterial;
      const gm = p.glow.material as LineMaterial;
      core.resolution.set(w, h);
      gm.resolution.set(w, h);
      const on = m.visible && p.src.visible;
      p.core.visible = on;
      p.glow.visible = on && showGlow;
      if (!on) continue;
      if (!m.vertexColors) {
        core.color.copy(m.color);
        gm.color.copy(m.color);
      }
      const op = m.transparent ? m.opacity : 1;
      core.opacity = op;
      gm.opacity = op * 0.14;
      core.blending = m.blending;
      // Width: `width` px at 4 units from the camera, thinner far away, clamped to 1.5–3 px (× DPR).
      p.src.getWorldPosition(tmp);
      const d = Math.max(0.5, tmp.distanceTo(camera.position));
      const px = Math.min(3, Math.max(1.5, width * (4 / d)));
      core.linewidth = px * dpr;
      gm.linewidth = px * 3.5 * dpr;
    }
  });

  return <>{children}</>;
}
