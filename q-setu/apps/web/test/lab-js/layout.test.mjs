import assert from "node:assert/strict";
import { test } from "node:test";
import {
  boxEdges,
  buildChain,
  buildLattice,
  buildPlates,
  CHAIN,
  chainIndex,
  chainPos,
  focusPose,
  GEOM,
  LEVEL,
  overviewPose,
  planTicks,
  PLATE,
  transferables,
} from "../../public/lab/js/engine/layout.js";

const W = { critical: 40, high: 25, medium: 10, low: 3, info: 0 };
const f = (n, line, severity, extra = {}) => ({
  n,
  line,
  severity,
  weight: W[severity],
  algorithm: "RSA",
  ruleId: "rsa",
  quantumVulnerable: true,
  quantumSafe: false,
  ...extra,
});
const scene = {
  weights: W,
  files: [
    {
      name: "a.js",
      lines: 20,
      score: 0,
      grade: "Critical",
      findings: [
        f(0, 3, "critical"),
        f(1, 3, "low"),
        f(2, 18, "info", { quantumSafe: true, quantumVulnerable: false }),
      ],
    },
    { name: "b.crt", lines: 4000, score: 56, grade: "At risk", findings: [f(0, 2500, "high")] },
  ],
};
const L = buildLattice(scene);
const h = (g) => L.focus[g * 4 + 3];

test("pillar height follows the scanner weight exactly", () => {
  // GPU arrays are float32: compare against float32-rounded expectations
  const F = Math.fround;
  assert.equal(h(0), F(GEOM.pillarBase + 40 * GEOM.pillarPerWeight));
  assert.equal(h(1), F(GEOM.pillarBase + 3 * GEOM.pillarPerWeight));
  assert.equal(h(2), F(GEOM.pillarBase));
  assert.ok(h(0) > h(3) && h(3) > h(1));
});

test("x is the file, z grows with the line on one shared scale", () => {
  assert.equal(L.focus[3 * 4], GEOM.fileGap); // file 1
  assert.ok(L.focus[3 * 4 + 2] > L.focus[2 * 4 + 2]);
  assert.equal(L.focus[0 * 4 + 2], L.focus[1 * 4 + 2]); // same line, same depth
  assert.notEqual(L.focus[0], L.focus[4]); // same line: side by side, not stacked
});

test("quantum-safe findings go to the wireframe set; refs map back to file and index", () => {
  assert.equal(L.wire.levels.length, 1);
  assert.deepEqual([...L.wire.ref], [0, 2]);
  assert.equal(L.solid.levels.length, 3);
  assert.deepEqual([...L.solid.ref], [0, 0, 0, 1, 1, 0]);
  assert.deepEqual([...L.solid.levels], [LEVEL.critical, LEVEL.low, LEVEL.high].map(Math.fround));
  assert.deepEqual([...L.offsets], [0, 3]);
});

test("long files are capped at cellCap cells and report lines per cell", () => {
  assert.equal(L.cells.length / 3, 20 + GEOM.cellCap);
  assert.equal(L.linesPerCell[0], 1);
  assert.equal(L.linesPerCell[1], 4000 / GEOM.cellCap);
});

test("score gauge: fill height = score, every gauge has a base and a full 0-100 frame, null = no fill", () => {
  const F = Math.fround;
  assert.equal(L.gaugeFill[5], 0); // score 0 -> empty gauge (no fill), base and frame still drawn
  assert.equal(L.gaugeFill[16 + 5], F(56 * GEOM.gaugePerScore));
  assert.equal(L.gaugeBase[5], F(GEOM.gaugeBase));
  assert.equal(L.gaugePick[5], F(100 * GEOM.gaugePerScore + GEOM.gaugeBase));
  const ys = [...L.gaugeFrames.subarray(0, 72)].filter((_, i) => i % 3 === 1);
  assert.equal(Math.max(...ys), F(100 * GEOM.gaugePerScore + GEOM.gaugeBase));
  const pending = buildLattice({ files: [{ name: "x", lines: 5, score: null, findings: [] }] });
  assert.equal(pending.gaugeFill[5], 0);
});

test("box edges: 12 edges, 24 points, all on the box", () => {
  const out = new Float32Array(72);
  boxEdges(out, 0, 0, 0, 2, 3, 4);
  for (let i = 0; i < 72; i += 3) {
    assert.ok(
      [-1, 1].includes(out[i]) && [0, 3].includes(out[i + 1]) && [-2, 2].includes(out[i + 2]),
    );
  }
  assert.equal(L.wire.edges.length, L.wire.levels.length * 72);
});

test("live partial scene: findings without algorithm still place by line and weight", () => {
  const live = buildLattice({
    files: [
      {
        name: "a",
        lines: 10,
        score: 0,
        findings: [{ n: 0, line: 4, severity: "high", weight: 25, quantumSafe: false }],
      },
      { name: "b", lines: 0, score: null, findings: [] },
    ],
  });
  assert.equal(live.solid.levels.length, 1);
  assert.equal(live.focus[3], Math.fround(GEOM.pillarBase + 25 * GEOM.pillarPerWeight));
  assert.equal(live.cells.length / 3, 10);
});

test("chain: one slab per entry, columns of perCol, verify drives brightness, broken is inverted", () => {
  const entries = Array.from({ length: 70 }, (_, i) => ({
    id: i + 1,
    kind: i === 5 ? "lab-run" : "mesh",
    hash: "h",
    at: 0,
    subject: "",
  }));
  const chain = { count: 70, entries, tampered: [] };
  const none = buildChain(chain, null);
  assert.equal(none.n, 70);
  assert.equal(none.levels[0], Math.fround(0.5));
  assert.ok(none.levels[5] > none.levels[0]); // lab-run brighter
  assert.deepEqual(chainPos(CHAIN.perCol), [CHAIN.colGap, 0, 0]);
  const ok = buildChain(chain, { ok: true, checked: 70 });
  assert.ok(ok.levels[0] > none.levels[0]);
  const broken = buildChain(chain, { ok: false, checked: 41, broken: { id: 42 } });
  assert.equal(broken.levels[41], 1);
  assert.ok(broken.levels[0] < none.levels[0]);
  assert.deepEqual(buildChain({ ...chain, tampered: [3] }, null).bad, [3]);
  assert.equal(chainIndex(chain, 42), 41);
  assert.equal(none.rails.length, 2 * 6); // two columns
  const t = planTicks([{ priority: "P1" }, { priority: "P3" }], [0, 1, 0]);
  assert.deepEqual([...t.levels], [1, Math.fround(0.46)]);
});

test("plates: depth grows with bytes up to the limit, marks = lines (capped), rejected = edges, url = pole", () => {
  const P = buildPlates([
    { key: "a", kind: "file", bytes: 0, lines: 3, maxBytes: 1000 },
    { key: "b", kind: "file", bytes: 1000, lines: 500, maxBytes: 1000 },
    { key: "c", kind: "file", bytes: 500, lines: 2, rejected: true, maxBytes: 1000 },
    { key: "d", kind: "url" },
  ]);
  assert.equal(P.dims[0][2], PLATE.minD);
  assert.equal(P.dims[1][2], PLATE.maxD); // log scale: the limit is still full depth
  assert.ok(P.dims[2][2] > (PLATE.minD + PLATE.maxD) / 2); // half the limit is well past halfway on a log scale
  assert.equal(P.marks.length / 3, 3 + PLATE.markCap + 2); // a rejected plate still shows its lines
  assert.deepEqual([...P.wire.ref], [2]);
  assert.deepEqual([...P.solid.ref], [0, 1, 3]);
  assert.equal(P.dims[3][1], PLATE.poleH);
  assert.equal(buildPlates([]).n, 0);
});

test("poses: overview looks at the lattice from above and in front; focus targets the pillar", () => {
  const o = overviewPose(L.bounds, 38, 2.5);
  assert.ok(o.pos[1] > o.target[1] && o.pos[2] > L.bounds.max[2] * 0.5);
  const p = focusPose(L, 3);
  assert.equal(p.target[0], L.focus[12]);
  assert.equal(p.target[2], L.focus[14]);
});

test("every typed array is transferable and the empty scene is safe", () => {
  assert.ok(transferables(L).every((b) => b instanceof ArrayBuffer));
  const E = buildLattice({ files: [] });
  assert.equal(E.cells.length, 0);
  assert.equal(E.solid.levels.length, 0);
});
