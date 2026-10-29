import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildLattice,
  focusPose,
  GEOM,
  LEVEL,
  overviewPose,
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

test("score slab height follows the score", () => {
  assert.equal(L.slabs[5], Math.fround(GEOM.slabMin)); // score 0 -> minimum
  assert.equal(L.slabs[16 + 5], Math.fround(56 * GEOM.slabPerScore));
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
