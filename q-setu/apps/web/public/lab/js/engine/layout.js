// Lattice layout: turns /api/lab/runs/:id/scene into GPU-ready typed arrays. Pure (no DOM, no three), so it
// runs in the prep worker and under node tests. Every coordinate maps to a field:
//   x = input file index, z = line number (one shared scale), pillar height = scanner SEVERITY_WEIGHT,
//   pillar grey = severity rank, wireframe = quantumSafe, back slab height = file score (0-100).
export const GEOM = {
  fileGap: 4,
  cellCap: 512, // cells per file; above this one cell stands for several lines (reported as linesPerCell)
  pillarBase: 0.12,
  pillarPerWeight: 0.065,
  footprint: 0.6,
  slabPerScore: 0.03,
  slabMin: 0.04,
  slabZ: -1.6,
};
export const LEVEL = { critical: 1, high: 0.8, medium: 0.62, low: 0.46, info: 0.32 };

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
/** Column-major translate+scale matrix for a unit box centred on the origin, base at y = 0. */
function box(out, i, x, z, w, h, d) {
  out.set([w, 0, 0, 0, 0, h, 0, 0, 0, 0, d, 0, x, h / 2, z, 1], i * 16);
}

export function buildLattice(scene) {
  const files = scene.files || [];
  const maxLines = Math.max(1, ...files.map((f) => f.lines || 1));
  const depth = clamp(maxLines * 0.18, 10, 56);
  const zPerLine = depth / maxLines;

  let nCells = 0;
  const cellsPer = files.map((f) => Math.max(1, Math.min(f.lines || 1, GEOM.cellCap)));
  cellsPer.forEach((c) => (nCells += c));
  const cells = new Float32Array(nCells * 3);
  let c = 0;
  files.forEach((f, fi) => {
    const lines = f.lines || 1;
    for (let k = 0; k < cellsPer[fi]; k++, c++) {
      cells[c * 3] = fi * GEOM.fileGap;
      cells[c * 3 + 2] = ((k + 0.5) / cellsPer[fi]) * lines * zPerLine;
    }
  });

  const total = files.reduce((s, f) => s + f.findings.length, 0);
  const offsets = new Int32Array(files.length);
  const focus = new Float32Array(total * 4); // x, y(top), z, height per global finding index
  const solidIdx = [];
  const wireIdx = [];
  let g = 0;
  files.forEach((f, fi) => {
    offsets[fi] = g;
    const perLine = new Map();
    for (const x of f.findings) perLine.set(x.line, (perLine.get(x.line) || 0) + 1);
    const slot = new Map();
    f.findings.forEach((x) => {
      const k = perLine.get(x.line);
      const s = slot.get(x.line) || 0;
      slot.set(x.line, s + 1);
      const w = Math.min(GEOM.footprint, 2.4 / k);
      const px = fi * GEOM.fileGap + (s - (k - 1) / 2) * w * 1.15;
      const pz = (x.line - 0.5) * zPerLine;
      const h = GEOM.pillarBase + (x.weight || 0) * GEOM.pillarPerWeight;
      focus.set([px, h, pz, h], g * 4);
      (x.quantumSafe ? wireIdx : solidIdx).push([g, fi, x.n, w]);
      g++;
    });
  });
  const pack = (list) => {
    const matrices = new Float32Array(list.length * 16);
    const levels = new Float32Array(list.length);
    const ref = new Int32Array(list.length * 2);
    const d = clamp(zPerLine * 0.9, 0.08, GEOM.footprint);
    list.forEach(([gi, fi, n, w], i) => {
      box(matrices, i, focus[gi * 4], focus[gi * 4 + 2], w, focus[gi * 4 + 3], d);
      levels[i] = LEVEL[files[fi].findings[n].severity] ?? LEVEL.info;
      ref[i * 2] = fi;
      ref[i * 2 + 1] = n;
    });
    return { matrices, levels, ref };
  };

  const slabs = new Float32Array(files.length * 16);
  files.forEach((f, fi) =>
    box(
      slabs,
      fi,
      fi * GEOM.fileGap,
      GEOM.slabZ,
      2,
      Math.max(GEOM.slabMin, (f.score ?? 0) * GEOM.slabPerScore),
      0.25,
    ),
  );

  const tallest = Math.max(
    GEOM.pillarBase,
    100 * GEOM.slabPerScore,
    ...Array.from({ length: total }, (_, i) => focus[i * 4 + 3]),
  );
  return {
    nFiles: files.length,
    zPerLine,
    linesPerCell: files.map((f, fi) => (f.lines || 1) / cellsPer[fi]),
    bounds: {
      min: [-1.2, 0, GEOM.slabZ - 0.3],
      max: [Math.max(0, files.length - 1) * GEOM.fileGap + 1.2, tallest, depth],
    },
    cells,
    offsets,
    focus,
    solid: pack(solidIdx),
    wire: pack(wireIdx),
    slabs,
  };
}

/** Typed arrays to transfer from the worker. */
export const transferables = (L) => [
  L.cells.buffer,
  L.offsets.buffer,
  L.focus.buffer,
  L.slabs.buffer,
  ...[L.solid, L.wire].flatMap((p) => [p.matrices.buffer, p.levels.buffer, p.ref.buffer]),
];

/** Camera that frames the whole lattice from a three-quarter view. fov in degrees, aspect = w/h. */
export function overviewPose(bounds, fovDeg, aspect) {
  const c = [0, 1, 2].map((i) => (bounds.min[i] + bounds.max[i]) / 2);
  const size = [0, 1, 2].map((i) => bounds.max[i] - bounds.min[i]);
  const halfV = (fovDeg * Math.PI) / 360;
  const halfH = Math.atan(Math.tan(halfV) * aspect);
  const across = Math.hypot(size[0], size[2]); // footprint diagonal, seen roughly side-on
  const fit = Math.max(
    across / 2 / Math.tan(halfH),
    (size[1] + across * 0.35) / 2 / Math.tan(halfV),
  );
  const dir = [0.5, 0.62, 0.6];
  const n = Math.hypot(...dir);
  const target = [c[0], Math.min(c[1] * 0.6, 1.2), c[2]];
  return { target, pos: target.map((v, i) => v + (dir[i] / n) * fit * 1.08) };
}

/** Camera close to one finding's pillar (global index into `focus`). */
export function focusPose(L, globalIndex) {
  const [x, , z, h] = L.focus.subarray(globalIndex * 4, globalIndex * 4 + 4);
  const target = [x, h * 0.5, z];
  const d = 7 + h * 1.4; // far enough to show the pillar and its neighbours on the same file rail
  return { target, pos: [x + d * 0.45, h * 0.5 + d * 0.55, z + d * 0.7] };
}
