// Layouts: data in, GPU-ready typed arrays out. Pure (no DOM, no three), so they run in the prep worker and
// under node tests. Every coordinate maps to a field (docs/ui_brief.md section d):
//   lattice: x = input file, z = line (one shared scale), pillar height = scanner SEVERITY_WEIGHT, grey = severity,
//            edges only = quantumSafe, score gauge = a 0-100 frame with a fill of height score (null = not scanned yet)
//   chain:   one slab per Proof Chain entry, oldest at the bottom, CHAIN_COL entries per column
//   plates:  one plate per staged input, depth = bytes, marks = lines, edges only = rejected
export const GEOM = {
  fileGap: 4,
  cellCap: 512, // cells per file; above this one cell stands for several lines (reported as linesPerCell)
  pillarBase: 0.12,
  pillarPerWeight: 0.065,
  footprint: 0.6,
  gaugePerScore: 0.03, // full gauge = 100 * 0.03 = 3 units
  gaugeW: 2,
  gaugeD: 0.25,
  gaugeBase: 0.06, // solid base plate every gauge has, so an empty (score 0) gauge still reads as a gauge
  gaugeZ: -1.6,
};
export const LEVEL = { critical: 1, high: 0.8, medium: 0.62, low: 0.46, info: 0.32 };

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
/** Column-major translate+scale matrix for a unit box centred on the origin, base at y = y0. */
function box(out, i, x, z, w, h, d, y0 = 0) {
  out.set([w, 0, 0, 0, 0, h, 0, 0, 0, 0, d, 0, x, y0 + h / 2, z, 1], i * 16);
}
/** The 12 edges of an axis-aligned box (base at y0) as 24 points, written at out[i * 72]. */
export function boxEdges(out, i, x, z, w, h, d, y0 = 0) {
  const X = [x - w / 2, x + w / 2],
    Y = [y0, y0 + h],
    Z = [z - d / 2, z + d / 2];
  const p = (a, b, c) => [X[a], Y[b], Z[c]];
  const E = [
    [p(0, 0, 0), p(1, 0, 0)],
    [p(1, 0, 0), p(1, 0, 1)],
    [p(1, 0, 1), p(0, 0, 1)],
    [p(0, 0, 1), p(0, 0, 0)],
    [p(0, 1, 0), p(1, 1, 0)],
    [p(1, 1, 0), p(1, 1, 1)],
    [p(1, 1, 1), p(0, 1, 1)],
    [p(0, 1, 1), p(0, 1, 0)],
    [p(0, 0, 0), p(0, 1, 0)],
    [p(1, 0, 0), p(1, 1, 0)],
    [p(1, 0, 1), p(1, 1, 1)],
    [p(0, 0, 1), p(0, 1, 1)],
  ];
  out.set(E.flat(2), i * 72);
}

export function buildLattice(scene) {
  const files = scene.files || [];
  const maxLines = Math.max(1, ...files.map((f) => f.lines || 1));
  const depth = clamp(maxLines * 0.18, 10, 56);
  const zPerLine = depth / maxLines;

  let nCells = 0;
  const cellsPer = files.map((f) => (f.lines ? Math.min(f.lines, GEOM.cellCap) : 0));
  cellsPer.forEach((c) => (nCells += c));
  const cells = new Float32Array(nCells * 3);
  const cellFile = new Uint16Array(nCells);
  let c = 0;
  files.forEach((f, fi) => {
    for (let k = 0; k < cellsPer[fi]; k++, c++) {
      cells[c * 3] = fi * GEOM.fileGap;
      cells[c * 3 + 2] = ((k + 0.5) / cellsPer[fi]) * f.lines * zPerLine;
      cellFile[c] = fi;
    }
  });

  const findingsOf = (f) => f.findings || [];
  const total = files.reduce((s, f) => s + findingsOf(f).length, 0);
  const offsets = new Int32Array(files.length);
  const focus = new Float32Array(total * 4); // x, y(top), z, height per global finding index
  const solidIdx = [];
  const wireIdx = [];
  let g = 0;
  files.forEach((f, fi) => {
    offsets[fi] = g;
    const perLine = new Map();
    for (const x of findingsOf(f)) perLine.set(x.line, (perLine.get(x.line) || 0) + 1);
    const slot = new Map();
    findingsOf(f).forEach((x, local) => {
      const k = perLine.get(x.line);
      const s = slot.get(x.line) || 0;
      slot.set(x.line, s + 1);
      const w = Math.min(GEOM.footprint, 2.4 / k);
      const px = fi * GEOM.fileGap + (s - (k - 1) / 2) * w * 1.15;
      const pz = (x.line - 0.5) * zPerLine;
      const h = GEOM.pillarBase + (x.weight || 0) * GEOM.pillarPerWeight;
      focus.set([px, h, pz, h], g * 4);
      (x.quantumSafe ? wireIdx : solidIdx).push([g, fi, x.n ?? local, w, local]);
      g++;
    });
  });
  const d = clamp(zPerLine * 0.9, 0.08, GEOM.footprint);
  const pack = (list) => {
    const matrices = new Float32Array(list.length * 16);
    const levels = new Float32Array(list.length);
    const ref = new Int32Array(list.length * 2);
    list.forEach(([gi, fi, n, w, local], i) => {
      box(matrices, i, focus[gi * 4], focus[gi * 4 + 2], w, focus[gi * 4 + 3], d);
      levels[i] = LEVEL[files[fi].findings[local].severity] ?? LEVEL.info;
      ref[i * 2] = fi;
      ref[i * 2 + 1] = n;
    });
    return { matrices, levels, ref };
  };
  const wire = pack(wireIdx);
  wire.edges = new Float32Array(wireIdx.length * 72);
  wireIdx.forEach(([gi, , , w], i) =>
    boxEdges(wire.edges, i, focus[gi * 4], focus[gi * 4 + 2], w, focus[gi * 4 + 3], d),
  );

  // score gauges: a frame for 0-100, a solid base plate, a fill of height score (none while not scanned)
  const full = 100 * GEOM.gaugePerScore;
  const gaugeFill = new Float32Array(files.length * 16);
  const gaugeBase = new Float32Array(files.length * 16);
  const gaugePick = new Float32Array(files.length * 16);
  const gaugeFrames = new Float32Array(files.length * 72);
  files.forEach((f, fi) => {
    const x = fi * GEOM.fileGap;
    const score = typeof f.score === "number" ? f.score : null;
    box(
      gaugeFill,
      fi,
      x,
      GEOM.gaugeZ,
      GEOM.gaugeW * 0.86,
      score ? score * GEOM.gaugePerScore : 0,
      GEOM.gaugeD * 0.86,
      GEOM.gaugeBase,
    );
    box(gaugeBase, fi, x, GEOM.gaugeZ, GEOM.gaugeW, GEOM.gaugeBase, GEOM.gaugeD);
    box(gaugePick, fi, x, GEOM.gaugeZ, GEOM.gaugeW, full + GEOM.gaugeBase, GEOM.gaugeD);
    boxEdges(gaugeFrames, fi, x, GEOM.gaugeZ, GEOM.gaugeW, full + GEOM.gaugeBase, GEOM.gaugeD);
  });

  const tallest = Math.max(
    full + GEOM.gaugeBase,
    ...Array.from({ length: total }, (_, i) => focus[i * 4 + 3]),
  );
  return {
    nFiles: files.length,
    zPerLine,
    linesPerCell: files.map((f, fi) => (cellsPer[fi] ? f.lines / cellsPer[fi] : 0)),
    bounds: {
      min: [-1.2, 0, GEOM.gaugeZ - 0.3],
      max: [Math.max(0, files.length - 1) * GEOM.fileGap + 1.2, tallest, depth],
    },
    cells,
    cellFile,
    offsets,
    focus,
    solid: pack(solidIdx),
    wire,
    gaugeFill,
    gaugeBase,
    gaugePick,
    gaugeFrames,
  };
}

/** Typed arrays to transfer from the worker. */
export const transferables = (L) => [
  L.cells.buffer,
  L.cellFile.buffer,
  L.offsets.buffer,
  L.focus.buffer,
  L.gaugeFill.buffer,
  L.gaugeBase.buffer,
  L.gaugePick.buffer,
  L.gaugeFrames.buffer,
  L.wire.edges.buffer,
  ...[L.solid, L.wire].flatMap((p) => [p.matrices.buffer, p.levels.buffer, p.ref.buffer]),
];

/** Camera that frames a box from a three-quarter view. fov in degrees, aspect = w/h. */
export function overviewPose(bounds, fovDeg, aspect, dir = [0.5, 0.62, 0.6]) {
  const c = [0, 1, 2].map((i) => (bounds.min[i] + bounds.max[i]) / 2);
  const size = [0, 1, 2].map((i) => bounds.max[i] - bounds.min[i]);
  const halfV = (fovDeg * Math.PI) / 360;
  const halfH = Math.atan(Math.tan(halfV) * aspect);
  const across = Math.hypot(size[0], size[2]); // footprint diagonal, seen roughly side-on
  const fit = Math.max(
    across / 2 / Math.tan(halfH),
    (size[1] + across * 0.35) / 2 / Math.tan(halfV),
  );
  const n = Math.hypot(...dir);
  const target = [c[0], Math.min(c[1] * 0.7, 1.6), c[2]];
  return { target, pos: target.map((v, i) => v + (dir[i] / n) * fit * 1.16) };
}

/** Camera close to one finding's pillar (global index into `focus`). */
export function focusPose(L, globalIndex) {
  const [x, , z, h] = L.focus.subarray(globalIndex * 4, globalIndex * 4 + 4);
  const target = [x, h * 0.5, z];
  const dd = 7 + h * 1.4; // far enough to show the pillar and its neighbours on the same file rail
  return { target, pos: [x + dd * 0.45, h * 0.5 + dd * 0.55, z + dd * 0.7] };
}

// ---------- Proof Chain ----------
export const CHAIN = { perCol: 64, colGap: 2.6, rowH: 0.16, slabH: 0.1, slabW: 1.6, slabD: 1.0 };

/** Position of the entry at `index` (0 = oldest listed) in the column stack: [x, y, z]. */
export function chainPos(index) {
  const col = Math.floor(index / CHAIN.perCol),
    row = index % CHAIN.perCol;
  return [col * CHAIN.colGap, row * CHAIN.rowH, 0];
}

/**
 * chain = /api/lab/chain response; verify = last POST /api/ledger/verify result or null.
 * levels: unknown (no verify yet) 0.5, verified 0.78, lab-run +0.22; broken entry = 1 (inverted, solid white)
 * and every other slab drops to 0.22; tampered ids (from the server) are treated like the broken entry.
 */
export function buildChain(chain, verify = null) {
  const es = chain.entries || [];
  const n = es.length;
  const matrices = new Float32Array(n * 16);
  const levels = new Float32Array(n);
  const brokenId = verify && !verify.ok && verify.broken ? verify.broken.id : null;
  const bad = new Set([...(chain.tampered || []), ...(brokenId ? [brokenId] : [])]);
  const base = verify ? (verify.ok ? 0.78 : 0.22) : 0.5;
  es.forEach((e, i) => {
    const [x, y, z] = chainPos(i);
    box(matrices, i, x, z, CHAIN.slabW, CHAIN.slabH, CHAIN.slabD, y);
    levels[i] = bad.has(e.id) ? 1 : Math.min(1, base + (e.kind === "lab-run" ? 0.22 : 0));
  });
  const cols = Math.max(1, Math.ceil(n / CHAIN.perCol));
  // the hash link: one rail per column through every slab
  const rails = new Float32Array(cols * 6);
  for (let k = 0; k < cols; k++) {
    const rows = Math.min(CHAIN.perCol, n - k * CHAIN.perCol);
    rails.set(
      [
        k * CHAIN.colGap,
        0,
        0,
        k * CHAIN.colGap,
        Math.max(0, rows - 1) * CHAIN.rowH + CHAIN.slabH,
        0,
      ],
      k * 6,
    );
  }
  const top = Math.min(n, CHAIN.perCol) * CHAIN.rowH;
  return {
    n,
    matrices,
    levels,
    rails,
    bad: [...bad],
    bounds: {
      min: [-CHAIN.slabW, 0, -CHAIN.slabD],
      max: [(cols - 1) * CHAIN.colGap + CHAIN.slabW, Math.max(top, 1), CHAIN.slabD],
    },
  };
}

/** Index of an entry id in the listing (entries are consecutive ids, oldest first). */
export const chainIndex = (chain, id) =>
  chain.entries && chain.entries.length ? id - chain.entries[0].id : -1;

/** Plan steps as ticks beside one slab: priority P1 brightest. */
export function planTicks(steps, at) {
  const m = new Float32Array(steps.length * 16);
  const lv = new Float32Array(steps.length);
  const [x, y, z] = at;
  steps.forEach((s, i) => {
    box(m, i, x + CHAIN.slabW / 2 + 0.5 + i * 0.32, z, 0.2, 0.42, 0.2, y);
    lv[i] = { P1: 1, P2: 0.7, P3: 0.46 }[s.priority] ?? 0.46;
  });
  return { matrices: m, levels: lv };
}

// ---------- input plates ----------
export const PLATE = { w: 2.2, gap: 3, minD: 0.3, maxD: 4.2, h: 0.14, markCap: 48, poleH: 2.2 };

/**
 * items: [{key, name, kind: "file"|"url", bytes, lines, rejected, maxBytes}] -> plates (solid or edges),
 * line marks (Points) and url poles. Depth is linear in bytes against the per-file limit.
 */
export function buildPlates(items) {
  const n = items.length;
  const solid = [],
    wire = [];
  const marks = [];
  const dims = [];
  items.forEach((it, i) => {
    const x = i * PLATE.gap;
    if (it.kind === "url") {
      dims.push([x, PLATE.poleH, 0.3]);
      (it.rejected ? wire : solid).push([i, x, 0.3, PLATE.poleH, 0.3]);
      return;
    }
    // log scale: real inputs span bytes to the 256 KB limit, so linear depth would flatten nearly every one
    const dpt =
      PLATE.minD +
      (PLATE.maxD - PLATE.minD) *
        clamp(Math.log10(1 + (it.bytes || 0)) / Math.log10(1 + (it.maxBytes || 262144)), 0, 1);
    dims.push([x, PLATE.h, dpt]);
    (it.rejected ? wire : solid).push([i, x, PLATE.w, PLATE.h, dpt]);
    const m = Math.min(it.lines || 0, PLATE.markCap);
    for (let k = 0; k < m; k++)
      marks.push(x - PLATE.w / 2 + 0.25, PLATE.h + 0.01, -dpt / 2 + ((k + 0.5) / m) * dpt);
  });
  const mats = (list) => {
    const out = new Float32Array(list.length * 16);
    const ref = new Int32Array(list.length);
    list.forEach(([i, x, w, h, d], k) => {
      box(out, k, x, 0, w, h, d);
      ref[k] = i;
    });
    return { matrices: out, ref };
  };
  const edges = new Float32Array(wire.length * 72);
  wire.forEach(([, x, w, h, d], k) => boxEdges(edges, k, x, 0, w, h, d));
  const w = Math.max(1, n) * PLATE.gap;
  return {
    n,
    solid: mats(solid),
    wire: { ...mats(wire), edges },
    marks: new Float32Array(marks),
    dims,
    bounds: {
      min: [-PLATE.gap / 2, 0, -PLATE.maxD / 2],
      max: [w - PLATE.gap / 2, PLATE.poleH, PLATE.maxD / 2],
    },
  };
}
